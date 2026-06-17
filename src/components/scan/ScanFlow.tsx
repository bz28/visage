"use client";

import { useState } from "react";
import { detectFace } from "@/lib/landmarks";
import { computeMeasurements } from "@/lib/measurements";
import { baselineAssessment } from "@/lib/baseline";
import { buildAnnotations, type Marker } from "@/lib/annotations";
import type { Assessment } from "@/lib/assessment-schema";
import type { Intake as IntakeData } from "@/lib/intake-schema";
import { Intake } from "./Intake";
import { Capture, type CapturedImage } from "./Capture";
import { FaceCanvas } from "./FaceCanvas";
import { AssessmentResult } from "./AssessmentResult";
import { BookConsult } from "./BookConsult";

type Step = "intake" | "capture" | "analyzing" | "result" | "book";

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
  const [front, setFront] = useState<Photo | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [active, setActive] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function analyze(images: CapturedImage[]) {
    setError(null);
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
        setError("We couldn't find a face in the front photo. Try better light, straight on.");
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
    setFront(null);
    setAnalysis(null);
    setActive(null);
    setError(null);
    setStep("intake");
  }

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-6">
      {step === "intake" && (
        <Intake
          onSubmit={(i) => {
            setIntake(i);
            setStep("capture");
          }}
        />
      )}

      {step === "capture" && (
        <>
          {error && (
            <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
              {error}
            </p>
          )}
          <Capture onDone={analyze} />
        </>
      )}

      {step === "analyzing" && (
        <div className="relative">
          {front ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={front.dataUrl}
                alt=""
                className="w-full rounded-2xl opacity-80"
              />
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-2xl bg-black/10">
                <span className="size-6 animate-spin rounded-full border-2 border-white border-t-transparent" />
                <p className="text-sm font-medium text-white drop-shadow">
                  Reading your features…
                </p>
              </div>
            </>
          ) : (
            <p className="py-12 text-center text-neutral-500">
              Reading your features…
            </p>
          )}
        </div>
      )}

      {step === "result" && front && analysis && (
        <>
          <FaceCanvas
            dataUrl={front.dataUrl}
            imageWidth={front.width}
            imageHeight={front.height}
            markers={analysis.markers}
            active={active}
            onSelectArea={setActive}
          />
          <AssessmentResult
            assessment={analysis.assessment}
            numberByArea={analysis.numberByArea}
            active={active}
            onSetActive={setActive}
            onBook={() => setStep("book")}
          />
        </>
      )}

      {step === "book" && analysis && (
        <BookConsult
          interests={[...new Set(analysis.assessment.areas.map((a) => a.area))]}
          onDone={reset}
        />
      )}
    </div>
  );
}
