"use client";

import { useRef, useState } from "react";
import { detectFace, type Pt } from "@/lib/landmarks";
import { computeMeasurements } from "@/lib/measurements";
import { baselineAssessment } from "@/lib/baseline";
import { buildAnnotations, type Marker } from "@/lib/annotations";
import {
  prepareComposite,
  pasteComposite,
  isMouthOpen,
  type CompositePrep,
} from "@/lib/composite";
import {
  isSimulatable,
  isProfileArea,
  isFrontWarpArea,
  type SimulatableArea,
  type ProfileArea,
} from "@/lib/simulation";
import { warpAreas, warpLips } from "@/lib/warp";
import { loadImage } from "@/lib/image";
import { AREA_LABELS, type Assessment } from "@/lib/assessment-schema";
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
  // The prepared front generation (loaded images + gen landmarks + transform),
  // computed ONCE when the generation lands. Toggling areas re-pastes a subset
  // from this — a pure canvas op, no face-detect — so it's instant.
  const frontPrepRef = useRef<CompositePrep | null>(null);
  // The front photo + its landmarks, cached so chin/jaw can be WARPED on the
  // front (projection that reads head-on) on top of the generative lips/cheeks —
  // mirrors profileWarpRef. dataUrl is the untouched original (the warp base).
  const frontWarpRef = useRef<{
    img: HTMLImageElement;
    lm: Pt[];
    width: number;
    height: number;
    dataUrl: string;
  } | null>(null);
  // Bumped on every recompose AND on reset()/analyze(), so a slow paste+warp or
  // background finish from an old toggle/photo can't land after a newer one —
  // critical because these async paths handle face photos (a stale finish from
  // photo A must never composite onto photo B).
  const recomposeId = useRef(0);
  // The background texture-finish: a debounce timer + the cached generative
  // texture output for THIS photo (fetched at most once; re-applied locally on
  // every toggle). Cleared on re-analyze + reset.
  // finishInFlightRef latches a paid call so concurrent toggles can't fire a
  // second one; finishAbortRef lets reset()/analyze() actually cancel an
  // in-flight request rather than just ignore its result.
  const finishTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // { image } = cached texture to re-apply; { image: null } = gave up (don't
  // re-call); null = not yet attempted for this photo.
  const finishCacheRef = useRef<{ image: string | null } | null>(null);
  const finishInFlightRef = useRef(false);
  const finishAbortRef = useRef<AbortController | null>(null);

  // The optional PROFILE (side-view) before/after — projection areas (chin / jaw
  // / nose) shown from the side, where their real effect reads. Only when a
  // usable profile photo was provided; generated once, no toggling.
  const [profile, setProfile] = useState<Photo | null>(null);
  const [profileSrc, setProfileSrc] = useState<string | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileFailed, setProfileFailed] = useState(false);
  // The profile is now a deterministic geometric WARP (not a generative paste):
  // we cache the side photo + its landmarks + the areas it covers, and re-warp a
  // subset on toggle. The patient's own pixels, projected — no API, identity-safe,
  // and correct at an angle (the generative paste distorted the lips on profiles).
  const profileWarpRef = useRef<{
    img: HTMLImageElement;
    lm: Pt[];
    width: number;
    height: number;
  } | null>(null);
  const profileAreasRef = useRef<ProfileArea[]>([]);
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

  function applySelection(next: Set<string>) {
    selectedRef.current = next;
    setSelected(next);
  }

  // Recompose the front "after" for the current selection: paste the generative
  // areas (lips / cheeks / folds) from the cached prep, then WARP chin / jaw on
  // top (their projection reads head-on too). Both are pure on-device ops; the
  // warp loads the pasted result, so this is async + guarded against a newer
  // toggle landing first.
  async function recompose(sel: Set<string>) {
    const src = frontWarpRef.current;
    // Bump FIRST, so clearing the selection (or any newer toggle) invalidates a
    // warp still suspended on its loadImage — otherwise that stale warp resumes
    // and clobbers the blank the user just asked for.
    const rid = ++recomposeId.current;
    const simSel = [...sel].filter(isSimulatable);
    if (simSel.length === 0) {
      setCombinedSrc(null);
      return;
    }
    // Split by how each area is rendered: lips + chin/jaw are GEOMETRIC warps
    // (reshape the patient's own pixels, identity-locked); cheeks/folds are the
    // generative model (flat-area volume, no border to evert).
    const genSel = simSel.filter((a) => !isFrontWarpArea(a) && a !== "lips");
    const projSel = simSel.filter(isFrontWarpArea); // chin / jaw
    const lipsOn = simSel.includes("lips");

    // Generative base (cheeks/folds) pasted onto the original — or the untouched
    // original if nothing generative is selected / it's not ready yet.
    let base = src?.dataUrl ?? null;
    const prep = frontPrepRef.current;
    if (genSel.length && prep) {
      const pasted = pasteComposite(prep, genSel);
      if (pasted) base = pasted;
    }
    if (!base || !src) {
      if (base) setCombinedSrc(base);
      return;
    }

    // Lips are only warped on a relaxed CLOSED mouth. Everting the lip border on
    // an open/parted mouth pushes the lower lip down into the teeth and distorts
    // it — and lip filler is assessed on a closed mouth anyway (we nudge for one
    // at capture). On an open mouth we skip the lip preview rather than show a
    // distortion; chin/jaw + cheeks/folds still apply.
    const lipsWarpable = lipsOn && !isMouthOpen(src.lm);

    // Apply the geometric warps in sequence: fuller lips, then chin/jaw
    // projection. Each pastes only its own region back onto the original, so the
    // rest stays exact. (loadImage decodes the prior step's result.)
    if (lipsWarpable) {
      const img = await loadImage(base);
      const w = warpLips(img, src.lm, src.width, src.height);
      if (w) base = w;
    }
    if (projSel.length) {
      const img = await loadImage(base);
      const w = warpAreas(img, src.lm, projSel, src.width, src.height);
      if (w) base = w;
    }
    if (rid !== recomposeId.current) return; // a newer toggle superseded us
    setCombinedSrc(base);

    // Progressive enhancement: the warp shape is shown instantly above; now add
    // the photoreal filler TEXTURE (sheen/highlight) the warp can't synthesize,
    // as a background pass that swaps in when ready. Lips only — the everted lip
    // is where flat geometry reads least real; chin/jaw projection is structural
    // (no filler sheen) and cheeks already go through the generative model.
    // Same closed-mouth gate as the warp: on an open mouth there's no lip warp to
    // finish, and the texture pass would nudge the smile (harness rejects it).
    if (lipsWarpable) void finishFront(base, rid);
  }

  // Background "+finish": add the photoreal lip texture the warp can't, and swap
  // it in. The expensive part — the generative texture — is fetched at most ONCE
  // per photo and cached: the lip warp is deterministic and the texture only
  // depends on the lips, so toggling cheeks/chin re-applies the cached texture
  // LOCALLY (no API). Fail-silent: any error/refusal/timeout keeps the warp.
  async function finishFront(warpResult: string, rid: number) {
    // One attempt per photo, whatever the outcome: { image } caches a usable
    // texture to re-apply locally; { image: null } latches "gave up" (fallback /
    // refusal / error) so a persistent failure can't re-fire a paid call on every
    // toggle. Either way, a non-null cache entry means "don't call Gemini again".
    const cache = finishCacheRef.current;
    if (cache) {
      if (cache.image) void applyFinish(warpResult, cache.image, rid);
      return;
    }
    if (finishInFlightRef.current) return; // a paid call already running this photo
    if (finishTimerRef.current) clearTimeout(finishTimerRef.current);
    finishTimerRef.current = setTimeout(async () => {
      // Re-check both guards at fire time (a newer toggle or a reset/analyze may
      // have landed during the debounce).
      if (rid !== recomposeId.current || finishInFlightRef.current) return;
      finishInFlightRef.current = true;
      // Abortable so reset()/analyze() can cancel the prior photo's call outright
      // (not just ignore its result); 65s ceiling on a hung request.
      const controller = new AbortController();
      finishAbortRef.current = controller;
      try {
        const res = await fetch("/api/simulate", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            image: warpResult,
            finishAreas: ["lips"],
            // So the texture pass keeps the exact mouth/teeth — else the harness
            // rejects it (the warp preserves the original mouth state).
            mouthOpen: frontWarpRef.current
              ? isMouthOpen(frontWarpRef.current.lm)
              : undefined,
          }),
          signal: AbortSignal.any([
            controller.signal,
            AbortSignal.timeout(65_000),
          ]),
        });
        // A non-2xx (e.g. a platform 500 returning HTML) would make res.json()
        // throw — treat it as a give-up like any other failure.
        const data: { image?: string } = res.ok ? await res.json() : {};
        // Guard BEFORE any write: if the user moved on (toggle / Start over /
        // re-scan) the cache + frontWarpRef now belong to a DIFFERENT photo, and
        // writing this photo's texture into them would bleed one face onto another.
        if (rid !== recomposeId.current) return;
        if (!data.image) {
          finishCacheRef.current = { image: null }; // give up — don't retry
          return;
        }
        finishCacheRef.current = { image: data.image };
        await applyFinish(warpResult, data.image, rid);
      } catch {
        // Transient (timeout/network/abort) — latch give-up to bound paid calls,
        // but only for the photo that's still current. The warp is already shown;
        // a re-analyze clears the latch for a retry.
        if (rid === recomposeId.current) finishCacheRef.current = { image: null };
      } finally {
        // Only release the latch if we still OWN it. After a reset/re-scan,
        // teardownFinish already cleared it (and a newer photo's finish may have
        // re-latched) — clearing unconditionally here would free the new photo's
        // latch and let a duplicate paid call slip through.
        if (finishAbortRef.current === controller) {
          finishInFlightRef.current = false;
          finishAbortRef.current = null;
        }
      }
    }, 450);
  }

  // Identity-lock a (cached or fresh) texture output onto the current warp base:
  // paste ONLY its lip region over the warp, so it adds sheen but cannot move the
  // shape we already set. The mouth-drift harness rejects expression drift — on a
  // relaxed closed mouth the texture lands; otherwise we keep the warp.
  async function applyFinish(warpResult: string, aiImage: string, rid: number) {
    const src = frontWarpRef.current;
    if (!src) return;
    try {
      const wimg = await loadImage(warpResult);
      const det = await detectFace(wimg, src.width, src.height);
      if (det.status !== "ok" || !det.landmarks) return;
      const prep = await prepareComposite(
        warpResult,
        det.landmarks,
        ["lips"],
        aiImage,
        src.width,
        src.height,
      );
      if (!prep.ok || !prep.prep) {
        // Expected on an open/smiling mouth — keep the warp, note for QA only.
        console.debug(`[finish] kept warp: ${prep.reason}`);
        return;
      }
      const locked = pasteComposite(prep.prep, ["lips"]);
      if (!locked || rid !== recomposeId.current) return;
      setCombinedSrc(locked);
    } catch {
      // fail-silent — the warp result is already on screen
    }
  }

  // Generate the combined "after" once, retrying if the harness rejects it
  // (e.g. the mouth drifted on a lip edit). On success we cache the PREPARED
  // generation (detect + transform done once) so toggling re-pastes instantly.
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
      let prep: CompositePrep | null = null;
      for (let attempt = 0; attempt < 3 && !prep; attempt++) {
        const res = await fetch("/api/simulate", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ image: f.dataUrl, areas, mouthOpen }),
        });
        // A non-2xx body isn't our JSON contract — treat as a fallback.
        const data: { image?: string; fallback?: boolean } = res.ok
          ? await res.json()
          : {};
        if (!data.image) break; // server fell back (no key / refusal / error)
        // Prepare once: this runs the harness (mouth-drift) + caches the detect.
        const prepared = await prepareComposite(
          f.dataUrl,
          lm,
          areas,
          data.image,
          f.width,
          f.height,
        );
        if (prepared.ok && prepared.prep) prep = prepared.prep;
        else console.warn(`[combined] rejected, retrying: ${prepared.reason}`);
        if (gen !== genId.current) return; // superseded — drop the result
      }
      if (gen !== genId.current) return;
      if (prep) {
        frontPrepRef.current = prep;
        // Paste for the CURRENT selection (the user may have toggled while the
        // generation was running), not just the areas we generated.
        await recompose(selectedRef.current);
      } else {
        setCombinedFailed(true);
      }
    } catch {
      if (gen === genId.current) setCombinedFailed(true);
    } finally {
      // One teardown for every path (mirrors generateProfile); the guard keeps a
      // superseded generation from clearing the new flow's spinner.
      if (gen === genId.current) setCombinedLoading(false);
    }
  }

  function toggleArea(area: string) {
    const next = new Set(selectedRef.current);
    if (next.has(area)) next.delete(area);
    else next.add(area);
    applySelection(next);
    if (frontWarpRef.current) void recompose(next);
    // The profile preview (chin / jaw / nose) re-pastes too — but only when a
    // projection area was toggled, so a lips/cheeks toggle doesn't needlessly
    // re-paste the profile panel.
    if (profileWarpRef.current && isProfileArea(area)) recomposeProfile(next);
    // On mobile the preview can be scrolled out of view while toggling below it;
    // bring it back so the change is actually seen (no-op when it's visible).
    const el = previewRef.current;
    if (el && el.getBoundingClientRect().bottom < 80) {
      el.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }

  // The optional profile before/after: detect landmarks on the side photo, then
  // WARP the projection areas (chin / jaw / nose) — moving the patient's own
  // pixels along the face's 3D surface direction. No API, identity-safe, and
  // correct at an angle. If the side photo can't be landmarked (a hard profile
  // MediaPipe can't read), we show no profile result — the front stands alone.
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
      setProfile({ dataUrl, width: w, height: h });
      // Cache the warp source (photo + landmarks) so toggling a projection area
      // re-warps a subset instantly — and warp for the CURRENT selection (the
      // patient may have toggled one off while we were detecting).
      profileWarpRef.current = { img, lm: det.landmarks, width: w, height: h };
      profileAreasRef.current = areas;
      if (!recomposeProfile(selectedRef.current)) setProfileFailed(true);
    } catch {
      if (gen === genId.current) setProfileFailed(true);
    } finally {
      if (gen === genId.current) setProfileLoading(false);
    }
  }

  // Re-warp the profile down to the selected projection areas (chin / jaw / nose)
  // — a free, deterministic, on-device op. If no projection area is selected the
  // profile preview drops away (it exists only to show projection).
  function recomposeProfile(sel: Set<string>): boolean {
    const src = profileWarpRef.current;
    if (!src) return false;
    const picked = profileAreasRef.current.filter((a) => sel.has(a));
    if (picked.length === 0) {
      setProfileSrc(null);
      return true; // nothing selected is a valid (empty) state, not a failure
    }
    const dataUrl = warpAreas(src.img, src.lm, picked, src.width, src.height);
    if (dataUrl) {
      setProfileSrc(dataUrl);
      return true;
    }
    return false;
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
        // Cap just past the route's maxDuration (60s) — the function is killed
        // server-side at 60s anyway, so a slightly-longer client cap lets that
        // failure surface and fall through to the baseline read, rather than
        // aborting a still-valid response early.
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
          signal: AbortSignal.timeout(65_000),
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
      frontPrepRef.current = null;
      // New photo → invalidate any suspended recompose/finish from a prior scan
      // (so it can't composite the old face onto this one) and drop the prior
      // photo's cached lip texture + any in-flight call.
      recomposeId.current++;
      teardownFinish();
      setCombinedSrc(null);
      setStep("result");

      // Kick off the combined before/after in the background so it's rendering
      // while they read the plan.
      const gen = ++genId.current;
      const uniqueAreas = [...new Set(assessment.areas.map((a) => a.area))];
      // Cache the front warp source so chin/jaw can project on the front too.
      frontWarpRef.current = {
        img,
        lm: landmarks,
        width: w,
        height: h,
        dataUrl: frontImg.dataUrl,
      };
      // The generative model handles only the flat-area volume (cheeks / folds);
      // lips and chin/jaw are geometric warps. If nothing generative is
      // recommended (e.g. the lips-only wedge) there's no API call at all —
      // just the instant, free, identity-locked warp.
      const genFront = uniqueAreas
        .filter(isSimulatable)
        .filter((a) => !isFrontWarpArea(a) && a !== "lips");
      if (genFront.length > 0) {
        void generateCombined(
          { dataUrl: frontImg.dataUrl, width: w, height: h },
          landmarks,
          genFront,
          gen,
        );
      } else {
        void recompose(selectedRef.current);
      }

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

  // Cancel + clear all background texture-finish state. Aborting the in-flight
  // request (not just ignoring it) is what stops a prior photo's call from
  // resolving into a new scan.
  function teardownFinish() {
    if (finishTimerRef.current) clearTimeout(finishTimerRef.current);
    finishTimerRef.current = null;
    finishAbortRef.current?.abort();
    finishAbortRef.current = null;
    finishInFlightRef.current = false;
    finishCacheRef.current = null;
  }

  function reset() {
    setIntake(null);
    setPhotos({});
    setFront(null);
    setAnalysis(null);
    setError(null);
    setHighlightedArea(null);
    genId.current++; // invalidate any in-flight combined generation
    recomposeId.current++; // invalidate any suspended recompose/finish too
    setCombinedSrc(null);
    setCombinedFailed(false);
    setCombinedLoading(false);
    frontPrepRef.current = null;
    frontWarpRef.current = null;
    teardownFinish();
    setProfile(null);
    setProfileSrc(null);
    setProfileLoading(false);
    setProfileFailed(false);
    profileWarpRef.current = null;
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
                          {/* When the generative pass fails but the lip/chin/jaw
                              warp still rendered, the preview shows SOME selected
                              areas and silently omits the generative ones (cheeks/
                              folds). Say so — never present a partial after as the
                              whole plan. */}
                          {combinedFailed &&
                            combinedSrc &&
                            (() => {
                              const missing = [...selected].filter(
                                (a) =>
                                  isSimulatable(a) &&
                                  !isFrontWarpArea(a) &&
                                  a !== "lips",
                              );
                              if (missing.length === 0) return null;
                              const names = missing
                                .map((a) => AREA_LABELS[a] ?? a)
                                .join(" and ");
                              return (
                                <p className="text-xs text-ink-400">
                                  Your {names} preview couldn&apos;t be generated
                                  this time — {missing.length > 1 ? "they're" : "it's"}{" "}
                                  still part of your read to discuss with a provider.
                                </p>
                              );
                            })()}
                          {/* Lips were recommended but the mouth is open — we skip
                              the lip warp (everting a parted mouth distorts it), so
                              tell the patient how to get the lip preview. */}
                          {selected.has("lips") &&
                            frontWarpRef.current &&
                            isMouthOpen(frontWarpRef.current.lm) && (
                              <p className="text-xs text-ink-400">
                                For a lip preview, retake with a relaxed, closed
                                mouth — lips read truest that way. Your read still
                                includes them.
                              </p>
                            )}
                        </div>
                      )}

                      {/* Profile before/after — only when a usable side photo
                          was given. Shows projection the front can't. (Same
                          `showProfile` that drives the grid, so they can't drift.) */}
                      {showProfile && profile && (
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
