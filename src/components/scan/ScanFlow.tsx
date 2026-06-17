"use client";

import { useState } from "react";
import { detectFace, type Pt } from "@/lib/landmarks";
import { computeMeasurements } from "@/lib/measurements";
import type { Measurements } from "@/lib/measurements-schema";
import { baselineAssessment } from "@/lib/baseline";
import { buildAnnotations, type Marker } from "@/lib/annotations";
import type { Assessment } from "@/lib/assessment-schema";
import { PhotoCapture } from "./PhotoCapture";
import { FaceCanvas } from "./FaceCanvas";
import { AssessmentResult } from "./AssessmentResult";
import { ConsentDialog } from "./ConsentDialog";
import { BookConsult } from "./BookConsult";

type Step = "capture" | "analyzing" | "result" | "book";

interface Photo {
  dataUrl: string;
  width: number;
  height: number;
}
interface Analysis {
  landmarks: Pt[];
  measurements: Measurements;
  assessment: Assessment;
  source: "ai" | "baseline";
  markers: Marker[];
  numberByArea: Record<string, number>;
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
  const [step, setStep] = useState<Step>("capture");
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [active, setActive] = useState<string | null>(null);
  const [consentOpen, setConsentOpen] = useState(false);
  const [deeperLoading, setDeeperLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onCapture(dataUrl: string) {
    setError(null);
    setStep("analyzing");
    try {
      const img = await loadImage(dataUrl);
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      setPhoto({ dataUrl, width: w, height: h });

      const result = await detectFace(img, w, h);
      if (result.status === "no-face") {
        setError(
          "We couldn't find a face. Try a straight-on photo in better light.",
        );
        setStep("capture");
        return;
      }
      if (result.status === "multiple-faces" || !result.landmarks) {
        setError("We see more than one face — try a solo selfie.");
        setStep("capture");
        return;
      }

      const measurements = computeMeasurements(result.landmarks);
      const assessment = baselineAssessment(measurements);
      const { markers, numberByArea } = buildAnnotations(
        assessment.areas,
        result.landmarks,
      );
      setAnalysis({
        landmarks: result.landmarks,
        measurements,
        assessment,
        source: "baseline",
        markers,
        numberByArea,
      });
      setStep("result");
    } catch {
      setError("Something went wrong reading that photo. Please try again.");
      setStep("capture");
    }
  }

  async function runDeeper() {
    if (!analysis || !photo) return;
    setConsentOpen(false);
    setDeeperLoading(true);
    try {
      const imageBase64 = photo.dataUrl.split(",")[1];
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          measurements: analysis.measurements,
          imageBase64,
        }),
      });
      if (!res.ok) throw new Error();
      const data: { assessment: Assessment; source: "ai" | "baseline" } =
        await res.json();
      const { markers, numberByArea } = buildAnnotations(
        data.assessment.areas,
        analysis.landmarks,
      );
      setAnalysis({
        ...analysis,
        assessment: data.assessment,
        source: data.source,
        markers,
        numberByArea,
      });
    } catch {
      // Keep the baseline result; surface a gentle note only.
      setError("We couldn't take a closer look just now — here's your initial read.");
    } finally {
      setDeeperLoading(false);
    }
  }

  function reset() {
    setPhoto(null);
    setAnalysis(null);
    setActive(null);
    setError(null);
    setStep("capture");
  }

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-6">
      {step === "capture" && (
        <>
          {error && (
            <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
              {error}
            </p>
          )}
          <PhotoCapture onCapture={onCapture} />
        </>
      )}

      {step === "analyzing" && (
        <p className="py-12 text-center text-neutral-500">Taking a look…</p>
      )}

      {step === "result" && photo && analysis && (
        <>
          <FaceCanvas
            dataUrl={photo.dataUrl}
            imageWidth={photo.width}
            imageHeight={photo.height}
            markers={analysis.markers}
            active={active}
          />
          {error && <p className="text-sm text-amber-700">{error}</p>}
          {deeperLoading && (
            <div className="flex items-center gap-3 rounded-xl border border-[var(--accent)]/40 bg-[var(--accent)]/5 px-4 py-3">
              <span className="size-4 animate-spin rounded-full border-2 border-[var(--accent)] border-t-transparent" />
              <p className="text-sm text-neutral-600">
                Taking a closer look at your photo — just a moment…
              </p>
            </div>
          )}
          <AssessmentResult
            assessment={analysis.assessment}
            numberByArea={analysis.numberByArea}
            active={active}
            onSetActive={setActive}
            onBook={() => setStep("book")}
            onDeeper={
              analysis.source === "baseline"
                ? () => setConsentOpen(true)
                : undefined
            }
            deeperLoading={deeperLoading}
          />
        </>
      )}

      {step === "book" && analysis && (
        <BookConsult
          interests={[...new Set(analysis.assessment.areas.map((a) => a.area))]}
          onDone={reset}
        />
      )}

      <ConsentDialog
        open={consentOpen}
        onAccept={runDeeper}
        onDecline={() => setConsentOpen(false)}
      />
    </div>
  );
}
