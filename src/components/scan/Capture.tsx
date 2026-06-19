"use client";

import { useState } from "react";
import { VIEWS, type ViewKey } from "@/lib/views";
import { PhotoCapture } from "./PhotoCapture";
import { PoseIllustration } from "./PoseIllustration";

export interface CapturedImage {
  view: ViewKey;
  dataUrl: string;
}

interface Props {
  /** Restore previously-captured photos (e.g. after a detection error). */
  initialPhotos?: Partial<Record<ViewKey, string>>;
  onDone: (images: CapturedImage[]) => void;
}

// Front is required; side & angle are optional but make the read more accurate.
export function Capture({ initialPhotos, onDone }: Props) {
  const [photos, setPhotos] =
    useState<Partial<Record<ViewKey, string>>>(initialPhotos ?? {});
  // Start at the review screen if we already have a front photo; else capture it.
  const [capturing, setCapturing] = useState<ViewKey | null>(
    initialPhotos?.front ? null : "front",
  );

  if (capturing) {
    const v = VIEWS.find((x) => x.key === capturing)!;
    return (
      <PhotoCapture
        view={v.key}
        label={v.label}
        instruction={v.instruction}
        onCapture={(dataUrl) => {
          setPhotos((p) => ({ ...p, [v.key]: dataUrl }));
          setCapturing(null);
        }}
        onCancel={photos.front ? () => setCapturing(null) : undefined}
      />
    );
  }

  function done() {
    const images = VIEWS.filter((v) => photos[v.key]).map((v) => ({
      view: v.key,
      dataUrl: photos[v.key]!,
    }));
    onDone(images);
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-semibold">Your photos</h2>
        <p className="mt-1 text-sm text-neutral-500">
          The front photo is all we need. Adding a side and angle gives us a
          sharper, more accurate read.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {VIEWS.map((v) => {
          const url = photos[v.key];
          return (
            <div
              key={v.key}
              className="flex items-center gap-3 rounded-xl border border-neutral-200 p-3"
            >
              <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-neutral-100">
                {url ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={url} alt="" className="size-full object-cover" />
                ) : (
                  <PoseIllustration
                    view={v.key}
                    size={44}
                    className="text-[var(--accent)]"
                  />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-medium">
                  {v.label}
                  {!v.required && (
                    <span className="ml-2 text-xs text-neutral-400">
                      optional
                    </span>
                  )}
                </div>
                <p className="truncate text-xs text-neutral-400">
                  {v.instruction}
                </p>
              </div>
              <button
                onClick={() => setCapturing(v.key)}
                className="shrink-0 rounded-full border border-neutral-300 px-4 py-1.5 text-sm font-medium"
              >
                {url ? "Retake" : "Add"}
              </button>
            </div>
          );
        })}
      </div>

      <button
        onClick={done}
        disabled={!photos.front}
        className="rounded-full bg-foreground px-7 py-3 font-medium text-background disabled:opacity-40"
      >
        See my read
      </button>
      <p className="text-center text-xs text-neutral-400">
        We use your photos only to create your result — we don&apos;t store
        them.
      </p>
    </div>
  );
}
