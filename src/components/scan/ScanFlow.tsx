"use client";

import { useRef, useState } from "react";
import { detectFace, type Pt } from "@/lib/landmarks";
import { computeMeasurements } from "@/lib/measurements";
import { baselineAssessment } from "@/lib/baseline";
import { buildAnnotations, type Marker } from "@/lib/annotations";
import { buildAreaMask } from "@/lib/mask";
import type { LookKey, SimulatableArea } from "@/lib/simulation";
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
  numberByArea: Record<string, number>;
}
interface Preview {
  area: SimulatableArea;
  look: LookKey;
  src: string;
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
  const [landmarks, setLandmarks] = useState<Pt[] | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [active, setActive] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Before/after preview state. `preview` is the after image currently shown;
  // generated images are cached by `${area}:${look}` so flipping back is instant.
  const [preview, setPreview] = useState<Preview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewFailed, setPreviewFailed] = useState(false);
  const previewCache = useRef<Record<string, string>>({});

  async function requestPreview(area: SimulatableArea, look: LookKey) {
    if (!landmarks || !front) return;
    const key = `${area}:${look}`;
    const cached = previewCache.current[key];
    if (cached) {
      setPreviewFailed(false);
      setPreview({ area, look, src: cached });
      return;
    }
    setPreviewFailed(false);
    setPreviewLoading(true);
    try {
      const mask = buildAreaMask(landmarks, area, front.width, front.height);
      const res = await fetch("/api/simulate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ image: front.dataUrl, mask, area, look }),
      });
      const data: { image?: string; fallback?: boolean } = await res.json();
      if (data.image) {
        previewCache.current[key] = data.image;
        setPreview({ area, look, src: data.image });
      } else {
        setPreviewFailed(true);
      }
    } catch {
      setPreviewFailed(true);
    } finally {
      setPreviewLoading(false);
    }
  }

  // Switching the active area drops back to the real photo for the new area.
  function selectActive(area: string | null) {
    setActive(area);
    if (area !== preview?.area) {
      setPreview(null);
      setPreviewFailed(false);
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
      setLandmarks(landmarks);
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

      const { markers, numberByArea } = buildAnnotations(
        assessment.areas,
        landmarks,
      );
      setAnalysis({ assessment, markers, numberByArea });
      setStep("result");
    } catch {
      setError("Something went wrong reading that photo. Please try again.");
      setStep("capture");
    }
  }

  function reset() {
    setIntake(null);
    setPhotos({});
    setFront(null);
    setLandmarks(null);
    setAnalysis(null);
    setActive(null);
    setError(null);
    setPreview(null);
    setPreviewFailed(false);
    previewCache.current = {};
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
            <Capture initialPhotos={photos} onDone={analyze} />
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

            <div className="flex flex-col gap-7 md:flex-row md:items-start md:gap-10">
              <div className="md:sticky md:top-6 md:w-[52%] md:shrink-0">
                <FaceCanvas
                  dataUrl={front.dataUrl}
                  imageWidth={front.width}
                  imageHeight={front.height}
                  markers={analysis.markers}
                  active={active}
                  onSelectArea={selectActive}
                  previewSrc={preview?.src ?? null}
                />
              </div>
              <div className="md:flex-1">
                <AssessmentResult
                  assessment={analysis.assessment}
                  numberByArea={analysis.numberByArea}
                  active={active}
                  onSetActive={selectActive}
                  onBook={() => setStep("book")}
                  canPreview={!!landmarks}
                  previewLook={preview?.look ?? null}
                  previewArea={preview?.area ?? null}
                  previewLoading={previewLoading}
                  previewFailed={previewFailed}
                  onPreview={requestPreview}
                />
              </div>
            </div>
          </div>
        )}

        {step === "book" && analysis && (
          <BookConsult
            interests={[...new Set(analysis.assessment.areas.map((a) => a.area))]}
            previewedLook={
              preview
                ? { area: preview.area, look: preview.look }
                : undefined
            }
            onDone={reset}
          />
        )}
      </div>
    </div>
  );
}
