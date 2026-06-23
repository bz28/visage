"use client";

import { useRef, useState } from "react";
import { detectFace, type Pt } from "@/lib/landmarks";
import { computeMeasurements } from "@/lib/measurements";
import { baselineAssessment } from "@/lib/baseline";
import { buildAnnotations, type Marker } from "@/lib/annotations";
import { compositeAreas, isMouthOpen } from "@/lib/composite";
import { isSimulatable, type SimulatableArea } from "@/lib/simulation";
import type { Assessment } from "@/lib/assessment-schema";
import type { Intake as IntakeData } from "@/lib/intake-schema";
import type { ViewKey } from "@/lib/views";
import { Intake } from "./Intake";
import { Capture, type CapturedImage } from "./Capture";
import { Analyzing } from "./Analyzing";
import { FaceCanvas } from "./FaceCanvas";
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
        });
        if (res.ok) {
          const data: { assessment: Assessment } = await res.json();
          assessment = data.assessment;
        }
      } catch {
        // keep baseline
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
      const simAreas = [
        ...new Set(assessment.areas.map((a) => a.area)),
      ].filter(isSimulatable);
      void generateCombined(
        { dataUrl: frontImg.dataUrl, width: w, height: h },
        landmarks,
        simAreas,
        ++genId.current,
      );
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
    genId.current++; // invalidate any in-flight combined generation
    setCombinedSrc(null);
    setCombinedFailed(false);
    setCombinedLoading(false);
    setGeneratedRaw(null);
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

      <div className={`w-full ${shell}`}>
        {step === "intake" && (
          <div className="flex flex-col gap-8">
            <header className="text-center">
              <h1 className="font-display text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl">
                See your features
                <br />
                the way we do
              </h1>
              <p className="mx-auto mt-4 max-w-md text-[15px] leading-relaxed text-neutral-500">
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
              <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
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

        {step === "result" && front && analysis && (
          <div className="flex flex-col gap-7">
            <header className="text-center md:text-left">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
                Your read
              </p>
              <h1 className="mt-2 font-display text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
                Here&apos;s what we&apos;d explore together
              </h1>
              <p className="mx-auto mt-3 max-w-2xl text-[15px] leading-relaxed text-neutral-600 md:mx-0">
                {analysis.assessment.summary}
              </p>
            </header>

            {/* Side-by-side before / after — the combined optimal result. */}
            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              <figure className="flex flex-col gap-2">
                <FaceCanvas
                  dataUrl={front.dataUrl}
                  imageWidth={front.width}
                  imageHeight={front.height}
                  markers={analysis.markers.filter((m) => selected.has(m.area))}
                />
                <figcaption className="text-center text-xs font-medium uppercase tracking-wide text-neutral-400">
                  Now
                </figcaption>
              </figure>
              <figure className="flex flex-col gap-2">
                <div className="relative flex aspect-square items-center justify-center overflow-hidden rounded-2xl bg-neutral-100 shadow-sm">
                  {combinedSrc ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={combinedSrc}
                      alt="Simulated result with the recommended treatment"
                      className="size-full object-cover"
                    />
                  ) : combinedLoading ? (
                    <div className="flex flex-col items-center gap-2 text-center">
                      <span className="size-5 animate-spin rounded-full border-2 border-[var(--accent)] border-t-transparent" />
                      <span className="px-3 text-xs text-neutral-500">
                        Creating your preview…
                      </span>
                    </div>
                  ) : (
                    <span className="px-3 text-center text-xs text-neutral-400">
                      {combinedFailed
                        ? "Preview unavailable — your read still stands."
                        : ![...selected].some(isSimulatable)
                          ? "Select an area below to preview it."
                          : "Preview"}
                    </span>
                  )}
                  {combinedSrc && (
                    <span className="absolute left-2 top-2 rounded-full bg-black/75 px-2 py-0.5 text-[10px] font-semibold text-white">
                      Simulated
                    </span>
                  )}
                </div>
                <figcaption className="text-center text-xs font-medium uppercase tracking-wide text-[var(--accent)]">
                  With treatment
                </figcaption>
              </figure>
            </div>

            <AssessmentResult
              assessment={analysis.assessment}
              selected={selected}
              onToggle={toggleArea}
              onBook={() => setStep("book")}
            />
          </div>
        )}

        {step === "book" && analysis && (
          <BookConsult
            interests={[...new Set(analysis.assessment.areas.map((a) => a.area))]}
            onDone={reset}
          />
        )}
      </div>
    </div>
  );
}
