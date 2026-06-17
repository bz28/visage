"use client";

import { useEffect, useRef, useState } from "react";
import type { ViewKey } from "@/lib/views";

interface Props {
  view: ViewKey;
  label: string;
  instruction: string;
  onCapture: (dataUrl: string) => void;
  onCancel?: () => void;
}

/**
 * Captures one view (camera or upload) with an on-screen guide + instruction so
 * the photo is usable. Nothing uploads here — the parent collects the shots.
 */
export function PhotoCapture({
  view,
  label,
  instruction,
  onCapture,
  onCancel,
}: Props) {
  const [mode, setMode] = useState<"choose" | "camera">("choose");
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  async function startCamera() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: 1280, height: 1280 },
      });
      if (!mountedRef.current) {
        // unmounted while awaiting permission — don't leave the camera on
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      streamRef.current = stream;
      setMode("camera");
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      });
    } catch {
      setError("Couldn't access the camera. You can upload a photo instead.");
    }
  }

  function snap() {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    onCapture(canvas.toDataURL("image/jpeg", 0.92));
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => onCapture(reader.result as string);
    reader.readAsDataURL(file);
  }

  const guideClass =
    view === "front"
      ? "h-[72%] w-[58%] rounded-[48%]"
      : "h-[72%] w-[46%] rounded-[44%]"; // narrower oval for side/angle

  if (mode === "camera") {
    return (
      <div className="flex flex-col items-center gap-4">
        <div className="relative w-full max-w-sm">
          <video
            ref={videoRef}
            playsInline
            muted
            className="w-full -scale-x-100 rounded-2xl bg-black"
          />
          {/* guide outline */}
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div
              className={`border-2 border-white/70 ${guideClass}`}
              style={{ boxShadow: "0 0 0 9999px rgba(0,0,0,0.15)" }}
            />
          </div>
          <p className="absolute bottom-3 left-0 right-0 text-center text-sm font-medium text-white drop-shadow">
            {instruction}
          </p>
        </div>
        <div className="flex gap-3">
          {onCancel && (
            <button
              onClick={() => {
                streamRef.current?.getTracks().forEach((t) => t.stop());
                onCancel();
              }}
              className="rounded-full border border-neutral-300 px-6 py-3 font-medium"
            >
              Back
            </button>
          )}
          <button
            onClick={snap}
            className="rounded-full bg-foreground px-8 py-3 font-medium text-background"
          >
            Take photo
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-5 text-center">
      <div>
        <h2 className="font-semibold">{label} photo</h2>
        <p className="mx-auto mt-1 max-w-xs text-sm text-neutral-500">
          {instruction} Your photo is only used to create your result — we
          don&apos;t keep it.
        </p>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          onClick={startCamera}
          className="rounded-full bg-foreground px-7 py-3 font-medium text-background"
        >
          Use camera
        </button>
        <button
          onClick={() => fileRef.current?.click()}
          className="rounded-full border border-neutral-300 px-7 py-3 font-medium"
        >
          Upload a photo
        </button>
      </div>
      {onCancel && (
        <button onClick={onCancel} className="text-sm text-neutral-400 underline">
          Back
        </button>
      )}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={onFile}
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
