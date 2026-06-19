"use client";

import { useEffect, useRef, useState } from "react";
import type { ViewKey } from "@/lib/views";
import { PoseIllustration } from "./PoseIllustration";

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
    // Reset on (re)mount — Strict Mode mounts twice, and the first cleanup
    // would otherwise leave this false and bail out of startCamera.
    mountedRef.current = true;
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
          {/* Pose cue overlay */}
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            {view === "front" ? (
              // Front: an oval to fit the face in.
              <div
                className="h-[72%] w-[58%] rounded-[48%] border-2 border-white/70"
                style={{ boxShadow: "0 0 0 9999px rgba(0,0,0,0.15)" }}
              />
            ) : (
              // Side / angle: a centered oval would mislead, so show a
              // translucent ghost of the target pose instead.
              <PoseIllustration
                view={view}
                size={180}
                className="text-white/40"
              />
            )}
          </div>
          {/* Label / instruction — always legible over the video. */}
          <div className="absolute bottom-0 left-0 right-0 rounded-b-2xl bg-gradient-to-t from-black/60 to-transparent px-4 pb-3 pt-8 text-center">
            <p className="text-sm font-medium text-white drop-shadow">
              {view === "front" ? "Fit your face in the oval." : instruction}
            </p>
          </div>
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
      <div
        className="flex size-24 items-center justify-center rounded-full text-[var(--accent)]"
        style={{ backgroundColor: "color-mix(in srgb, var(--accent) 10%, transparent)" }}
      >
        <PoseIllustration view={view} size={80} />
      </div>
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
