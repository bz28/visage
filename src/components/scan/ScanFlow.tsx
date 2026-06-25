"use client";

import { useRef, useState } from "react";
import { detectFace, type Pt } from "@/lib/landmarks";
import { computeMeasurements } from "@/lib/measurements";
import { baselineAssessment } from "@/lib/baseline";
import { buildAnnotations, type Marker } from "@/lib/annotations";
import { compositeAreas, isMouthOpen } from "@/lib/composite";
import {
  isSimulatable,
  isProfileArea,
  type SimulatableArea,
  type ProfileArea,
} from "@/lib/simulation";
import type { Assessment } from "@/lib/assessment-schema";
import type { Intake as IntakeData } from "@/lib/intake-schema";
import type { ViewKey } from "@/lib/views";
import { Intake } from "./Intake";
import { Capture, type CapturedImage } from "./Capture";
import { Analyzing } from "./Analyzing";
import { BeforeAfter } from "./BeforeAfter";
import { AssessmentResult } from "./AssessmentResult";
import { BookConsult } from "./BookConsult";
import { StepProgress } from "./StepProgress";

type Step = "intake" | "capture" | "analyzing" | "result" | "book";

// Map each internal step to a stage in the patient-facing progress indicator.
const STAGE_INDEX: Record<Step, number> = {
  intake: 0,
  capture: 1,
  analyzing: 1,
  result: 2,
  book: 3,
};

interface Photo {
  dataUrl: string;
  width: number;
  height: number;
}
interface Analysis {
  assessment: Assessment;
  markers: Marker[];
  landmarks: Pt[];
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export function ScanFlow() {
  const [step, setStep] = useState<Step>("intake");
  const [intake, setIntake] = useState<IntakeData | null>(null);
  const [photos, setPhotos] = useState<Partial<Record<ViewKey, string>>>({});
  const [front, setFront] = useState<Photo | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Area whose pin is emphasized on the photo (hovered/tapped in the plan).
  const [highlightedArea, setHighlightedArea] = useState<string | null>(null);

  // The patient's combined before/after. We generate ONE "after" with every
  // recommended area at the optimal amount, cache the raw AI output (the one
  // that passed the harness), and composite the regions back. Because we paste
  // per-region, the patient can toggle which areas to include and we re-paste a
  // subset of the SAME generation — no new API call. (Per-area Subtle/Natural/
  // Fuller editing is the clinician tool, not the patient flow.)
  const [combinedSrc, setCombinedSrc] = useState<string | null>(null);
  const [combinedLoading, setCombinedLoading] = useState(false);
  const [combinedFailed, setCombinedFailed] = useState(false);
  const [generatedRaw, setGeneratedRaw] = useState<string | null>(null);

  // The optional PROFILE (side-view) before/after — projection areas (chin / jaw
  // / nose) shown from the side, where their real effect reads. Only when a
  // usable profile photo was provided; generated once, no toggling.
  const [profile, setProfile] = useState<Photo | null>(null);
  const [profileSrc, setProfileSrc] = useState<string | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileFailed, setProfileFailed] = useState(false);
  // The cached profile generation (the raw output that passed the harness, its
  // landmarks, the photo, and the projection areas it covered) — so toggling a
  // chin/jaw/nose area re-pastes a subset of the SAME generation, just like the
  // front. Refs (not state) because the async paths read the current values.
  const profileRawRef = useRef<string | null>(null);
  const profileLmRef = useRef<Pt[] | null>(null);
  const profilePhotoRef = useRef<Photo | null>(null);
  const profileAreasRef = useRef<ProfileArea[]>([]);
  const profileRecomposeId = useRef(0);
  // The preview (photo) column — so toggling can scroll it back into view on
  // mobile, where it's stacked above the plan and easily scrolled past.
  const previewRef = useRef<HTMLDivElement>(null);
  // Areas the patient currently wants included (defaults to all recommended).
  // A ref mirrors it so async paths (a slow generation completing) read the
  // CURRENT selection, not the value captured when they started.
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const selectedRef = useRef<Set<string>>(new Set());
  // Bumped on each analyze/reset so a slow background generation can't write its
  // result onto a flow the user has already moved on from (Book → Start over).
  const genId = useRef(0);
  // Bumped on each recompose so that when toggles overlap, only the latest one
  // writes the image (composites can resolve out of order).
  const recomposeId = useRef(0);

  function applySelection(next: Set<string>) {
    selectedRef.current = next;
    setSelected(next);
  }

  // Composite the cached generation down to the currently-selected regions.
  // Pasting a subset is a fast local canvas op — toggling never re-calls the
  // model. `gen` guards against a flow the user has left; `req` against an
  // overlapping later recompose.
  async function recompose(sel: Set<string>, raw: string, gen: number, f: Photo, lm: Pt[]) {
    const req = ++recomposeId.current;
    const live = () => gen === genId.current && req === recomposeId.current;
    const simSel = [...sel].filter(isSimulatable);
    if (simSel.length === 0) {
      if (live()) {
        setCombinedSrc(null);
        setCombinedLoading(false);
      }
      return;
    }
    setCombinedLoading(true);
    try {
      const r = await compositeAreas(f.dataUrl, lm, simSel, raw, f.width, f.height);
      if (!live()) return; // superseded by a newer recompose / flow
      if (r.ok && r.dataUrl) setCombinedSrc(r.dataUrl);
    } finally {
      if (live()) setCombinedLoading(false);
    }
  }

  // Generate the combined "after" once, retrying if the harness rejects it
  // (e.g. the mouth drifted on a lip edit). On success we cache the raw output
  // so toggling areas can re-paste a subset without a new generation.
  async function generateCombined(
    f: Photo,
    lm: Pt[],
    areas: SimulatableArea[],
    gen: number,
  ) {
    if (areas.length === 0) return;
    setCombinedFailed(false);
    setCombinedLoading(true);
    try {
      const mouthOpen = isMouthOpen(lm);
      let raw: string | null = null;
      for (let attempt = 0; attempt < 3 && !raw; attempt++) {
        const res = await fetch("/api/simulate", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ image: f.dataUrl, areas, mouthOpen }),
        });
        const data: { image?: string; fallback?: boolean } = await res.json();
        if (!data.image) break; // server fell back (no key / refusal / error)
        // Composite once to run the harness; keep the raw output if it passes.
        const result = await compositeAreas(
          f.dataUrl,
          lm,
          areas,
          data.image,
          f.width,
          f.height,
        );
        if (result.ok) raw = data.image;
        else console.warn(`[combined] rejected, retrying: ${result.reason}`);
        if (gen !== genId.current) return; // superseded — drop the result
      }
      if (gen !== genId.current) return;
      if (raw) {
        setGeneratedRaw(raw);
        // Composite for the CURRENT selection (the user may have toggled while
        // the generation was running), not just the areas we generated.
        await recompose(selectedRef.current, raw, gen, f, lm);
      } else {
        setCombinedFailed(true);
        setCombinedLoading(false);
      }
    } catch {
      if (gen === genId.current) {
        setCombinedFailed(true);
        setCombinedLoading(false);
      }
    }
  }

  function toggleArea(area: string) {
    const next = new Set(selectedRef.current);
    if (next.has(area)) next.delete(area);
    else next.add(area);
    applySelection(next);
    if (front && analysis && generatedRaw) {
      void recompose(next, generatedRaw, genId.current, front, analysis.landmarks);
    }
    // The profile preview (chin / jaw / nose) re-pastes too — but only when a
    // projection area was toggled, so a lips/cheeks toggle doesn't needlessly
    // re-composite (and flicker) the profile panel.
    if (profileRawRef.current && isProfileArea(area)) void recomposeProfile(next);
    // On mobile the preview can be scrolled out of view while toggling below it;
    // bring it back so the change is actually seen (no-op when it's visible).
    const el = previewRef.current;
    if (el && el.getBoundingClientRect().bottom < 80) {
      el.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }

  // Generate the optional profile before/after: detect landmarks on the side
  // photo, edit the projection areas, composite the regions back. If the side
  // photo can't be landmarked (a hard profile MediaPipe can't read), we simply
  // don't show a profile result — the front stands on its own.
  async function generateProfile(
    dataUrl: string,
    areas: ProfileArea[],
    gen: number,
  ) {
    if (areas.length === 0) return;
    setProfileFailed(false);
    setProfileLoading(true);
    try {
      const img = await loadImage(dataUrl);
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      const det = await detectFace(img, w, h);
      if (det.status !== "ok" || !det.landmarks) return; // no usable profile
      if (gen !== genId.current) return; // superseded while detecting
      const photo: Photo = { dataUrl, width: w, height: h };
      setProfile(photo);
      // Generate once (retrying on harness rejection) and cache the raw output
      // that passes, so toggling re-pastes a subset for free — like the front.
      let raw: string | null = null;
      for (let attempt = 0; attempt < 3 && !raw; attempt++) {
        const res = await fetch("/api/simulate", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ image: dataUrl, profileAreas: areas }),
        });
        const data: { image?: string } = await res.json();
        if (!data.image) break;
        const result = await compositeAreas(
          dataUrl,
          det.landmarks,
          areas,
          data.image,
          w,
          h,
        );
        if (result.ok) raw = data.image;
        else console.warn(`[profile] rejected, retrying: ${result.reason}`);
        if (gen !== genId.current) return;
      }
      if (gen !== genId.current) return;
      // The panel is already mounted (setProfile ran); if generation didn't
      // produce a usable output, mark it failed so it shows a note instead of an
      // endless spinner that then vanishes.
      if (raw) {
        profileRawRef.current = raw;
        profileLmRef.current = det.landmarks;
        profilePhotoRef.current = photo;
        profileAreasRef.current = areas;
        // Paste for the CURRENT selection (the patient may have toggled a
        // projection area off while this was generating).
        await recomposeProfile(selectedRef.current);
      } else {
        setProfileFailed(true);
      }
    } catch {
      if (gen === genId.current) setProfileFailed(true);
    } finally {
      if (gen === genId.current) setProfileLoading(false);
    }
  }

  // Profile equivalent of recompose: re-paste the cached profile generation down
  // to the selected projection areas (chin / jaw / nose). Same free local canvas
  // op; if no projection area is selected, the profile preview drops away (it
  // exists only to show projection). Separate from `recompose` rather than a
  // param-heavy shared helper — the two read different state and stay readable.
  async function recomposeProfile(sel: Set<string>) {
    const raw = profileRawRef.current;
    const lm = profileLmRef.current;
    const photo = profilePhotoRef.current;
    if (!raw || !lm || !photo) return;
    const req = ++profileRecomposeId.current;
    const gen = genId.current;
    const live = () => gen === genId.current && req === profileRecomposeId.current;
    const picked = profileAreasRef.current.filter((a) => sel.has(a));
    if (picked.length === 0) {
      if (live()) {
        setProfileSrc(null);
        setProfileLoading(false);
      }
      return;
    }
    setProfileLoading(true);
    try {
      const r = await compositeAreas(
        photo.dataUrl,
        lm,
        picked,
        raw,
        photo.width,
        photo.height,
      );
      if (!live()) return;
      if (r.ok && r.dataUrl) setProfileSrc(r.dataUrl);
    } finally {
      if (live()) setProfileLoading(false);
    }
  }

  async function analyze(images: CapturedImage[]) {
    setError(null);
    // Remember the shots so a detection error doesn't wipe them.
    setPhotos(
      Object.fromEntries(images.map((i) => [i.view, i.dataUrl])) as Partial<
        Record<ViewKey, string>
      >,
    );
    setStep("analyzing");
    try {
      const frontImg = images.find((i) => i.view === "front");
      if (!frontImg) {
        setError("We need a front photo to start.");
        setStep("capture");
        return;
      }

      const img = await loadImage(frontImg.dataUrl);
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      setFront({ dataUrl: frontImg.dataUrl, width: w, height: h });

      const result = await detectFace(img, w, h);
      if (result.status === "no-face") {
        setError("We couldn't quite find a face in that photo. A bit more light, facing straight on, usually does it.");
        setStep("capture");
        return;
      }
      if (result.status === "multiple-faces" || !result.landmarks) {
        setError("We see more than one face — try a solo photo.");
        setStep("capture");
        return;
      }

      const landmarks = result.landmarks;
      const measurements = computeMeasurements(landmarks);
      const baseline = baselineAssessment(measurements, intake ?? undefined);

      let assessment = baseline;
      try {
        // Cap the wait so a hung AI call can't strand the patient on the
        // analyzing screen — on timeout we fall through to the baseline read.
        const res = await fetch("/api/analyze", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            measurements,
            intake: intake ?? undefined,
            images: images.map((i) => ({
              view: i.view,
              base64: i.dataUrl.split(",")[1],
            })),
          }),
          signal: AbortSignal.timeout(120_000),
        });
        if (res.ok) {
          const data: { assessment: Assessment } = await res.json();
          assessment = data.assessment;
        }
      } catch {
        // timed out or failed — keep the baseline read
      }

      const { markers } = buildAnnotations(assessment.areas, landmarks);
      setAnalysis({ assessment, markers, landmarks });
      // Start with every recommended area selected (the full plan).
      applySelection(new Set(assessment.areas.map((a) => a.area)));
      setGeneratedRaw(null);
      setCombinedSrc(null);
      setStep("result");

      // Kick off the combined before/after in the background so it's rendering
      // while they read the plan.
      const gen = ++genId.current;
      const uniqueAreas = [...new Set(assessment.areas.map((a) => a.area))];
      void generateCombined(
        { dataUrl: frontImg.dataUrl, width: w, height: h },
        landmarks,
        uniqueAreas.filter(isSimulatable),
        gen,
      );

      // If a side photo was provided, also generate a profile before/after for
      // the projection areas (chin / jaw / nose) it covers.
      const profileImg = images.find((i) => i.view === "profile");
      const profileAreas = uniqueAreas.filter(isProfileArea);
      if (profileImg && profileAreas.length > 0) {
        void generateProfile(profileImg.dataUrl, profileAreas, gen);
      }
    } catch {
      setError("Something went wrong reading that photo. Please try again.");
      setStep("capture");
    }
  }

  function reset() {
    setIntake(null);
    setPhotos({});
    setFront(null);
    setAnalysis(null);
    setError(null);
    setHighlightedArea(null);
    genId.current++; // invalidate any in-flight combined generation
    setCombinedSrc(null);
    setCombinedFailed(false);
    setCombinedLoading(false);
    setGeneratedRaw(null);
    setProfile(null);
    setProfileSrc(null);
    setProfileLoading(false);
    setProfileFailed(false);
    profileRawRef.current = null;
    profileLmRef.current = null;
    profilePhotoRef.current = null;
    profileAreasRef.current = [];
    applySelection(new Set());
    setStep("intake");
  }

  const shell =
    step === "result"
      ? "max-w-6xl"
      : step === "intake" || step === "book"
        ? "max-w-xl"
        : "max-w-lg";

  return (
    <div className="mx-auto flex w-full flex-col items-center gap-8 sm:gap-10">
      <StepProgress current={STAGE_INDEX[step]} />

      {/* key={step} re-mounts on each transition so the entrance replays. */}
      <div key={step} className={`w-full ${shell} animate-rise`}>
        {step === "intake" && (
          <div className="flex flex-col gap-8">
            <header className="text-center">
              <h1 className="font-display text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl">
                See your features
                <br />
                the way we do
              </h1>
              <p className="mx-auto mt-4 max-w-md text-[15px] leading-relaxed text-ink-500">
                A quick, private look at the areas we might explore together — and
                why. Think of it as the start of a conversation, best continued in
                person.
              </p>
            </header>
            <Intake
              onSubmit={(i) => {
                setIntake(i);
                setStep("capture");
              }}
            />
          </div>
        )}

        {step === "capture" && (
          <div className="flex flex-col gap-6">
            {error && (
              <p
                role="alert"
                className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"
              >
                {error}
              </p>
            )}
            <Capture
              initialPhotos={photos}
              concern={intake?.concern}
              onDone={analyze}
            />
          </div>
        )}

        {step === "analyzing" && <Analyzing dataUrl={front?.dataUrl} />}

        {step === "result" &&
          front &&
          analysis &&
          (() => {
            const showProfile = !!(
              profile &&
              (profileSrc || profileLoading || profileFailed)
            );
            const hasFront = analysis.assessment.areas.length > 0;
            const hasPreview = hasFront || showProfile;
            return (
              <div className="flex flex-col gap-7">
                <header className="text-center md:text-left">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
                    Your read
                  </p>
                  <h1 className="mt-2 font-display text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
                    Here&apos;s what we&apos;d explore together
                  </h1>
                  <p className="mx-auto mt-3 max-w-2xl text-[15px] leading-relaxed text-ink-600 md:mx-0">
                    {analysis.assessment.summary}
                  </p>
                </header>

                {/* On desktop: photos on the left (sticky, stays in view while
                    the plan scrolls), plan + CTA on the right — so toggling an
                    area updates a photo you can still see. Mobile stacks. */}
                <div
                  className={`flex flex-col gap-7 ${
                    hasPreview
                      ? "lg:grid lg:grid-cols-[1.05fr_0.95fr] lg:gap-10 lg:items-start"
                      : ""
                  }`}
                >
                  {hasPreview && (
                    <div
                      ref={previewRef}
                      className="flex flex-col gap-5 lg:sticky lg:top-6"
                    >
                      {/* Front before/after (the hero). Labelled "Front" only
                          when a profile result is also shown. Keyed by the photo
                          so per-scan UI state resets on a new scan. */}
                      {hasFront && (
                        <div className="flex flex-col gap-2">
                          {showProfile && (
                            <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">
                              Front
                            </p>
                          )}
                          <BeforeAfter
                            key={front.dataUrl}
                            beforeSrc={front.dataUrl}
                            afterSrc={combinedSrc}
                            imageWidth={front.width}
                            imageHeight={front.height}
                            markers={analysis.markers.filter((m) =>
                              selected.has(m.area),
                            )}
                            highlightedArea={highlightedArea}
                            onPinClick={(area) =>
                              setHighlightedArea((cur) =>
                                cur === area ? null : area,
                              )
                            }
                            loading={combinedLoading}
                            placeholder={
                              combinedFailed
                                ? "Preview unavailable — your read still stands."
                                : ![...selected].some(isSimulatable)
                                  ? "Switch an area on below to see your preview."
                                  : undefined
                            }
                          />
                        </div>
                      )}

                      {/* Profile before/after — only when a usable side photo
                          was given. Shows projection the front can't. */}
                      {profile &&
                        (profileSrc || profileLoading || profileFailed) && (
                          <div className="flex flex-col gap-2">
                            <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">
                              Profile
                            </p>
                            <BeforeAfter
                              key={profile.dataUrl}
                              beforeSrc={profile.dataUrl}
                              afterSrc={profileSrc}
                              imageWidth={profile.width}
                              imageHeight={profile.height}
                              markers={[]}
                              loading={profileLoading}
                              placeholder={
                                profileFailed
                                  ? "Profile preview wasn't available — your front read still stands."
                                  : undefined
                              }
                            />
                          </div>
                        )}
                    </div>
                  )}

                  <AssessmentResult
                    assessment={analysis.assessment}
                    selected={selected}
                    onToggle={toggleArea}
                    onHighlight={setHighlightedArea}
                    onBook={() => setStep("book")}
                  />
                </div>
              </div>
            );
          })()}

        {step === "book" && analysis && (
          <BookConsult
            // The areas the patient actually KEPT in their preview (in priority
            // order), not the full recommended set — that's what they're telling
            // the clinic they care about.
            interests={[...new Set(analysis.assessment.areas.map((a) => a.area))].filter(
              (area) => selected.has(area),
            )}
            onDone={reset}
          />
        )}
      </div>
    </div>
  );
}
