"use client";

import { useEffect, useRef, useState } from "react";

interface Props {
  onCapture: (dataUrl: string) => void;
}

/**
 * Phone-first photo input: live camera, or upload an existing selfie. Nothing
 * is uploaded here — the photo stays on the device for the baseline read.
 */
export function PhotoCapture({ onCapture }: Props) {
  const [mode, setMode] = useState<"choose" | "camera">("choose");
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => streamRef.current?.getTracks().forEach((t) => t.stop());
  }, []);

  async function startCamera() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: 1280, height: 1280 },
      });
      streamRef.current = stream;
      setMode("camera");
      // wait a tick for the video element to mount
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
        <video
          ref={videoRef}
          playsInline
          muted
          className="w-full max-w-sm -scale-x-100 rounded-2xl bg-black"
        />
        <button
          onClick={snap}
          className="rounded-full bg-foreground px-8 py-3 font-medium text-background"
        >
          Take photo
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-5 text-center">
      <p className="max-w-xs text-sm text-neutral-500">
        Look straight at the camera, somewhere bright, with a relaxed
        expression. Your photo is only used to create your result — we
        don&apos;t keep it.
      </p>
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
          Upload a selfie
        </button>
      </div>
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
