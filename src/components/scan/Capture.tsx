"use client";

import { useState } from "react";
import { VIEWS, type ViewKey } from "@/lib/views";
import { PhotoCapture } from "./PhotoCapture";
import { PoseIllustration } from "./PoseIllustration";
import { Button } from "@/components/ui/Button";

export interface CapturedImage {
  view: ViewKey;
  dataUrl: string;
}

interface Props {
  /** Restore previously-captured photos (e.g. after a detection error). */
  initialPhotos?: Partial<Record<ViewKey, string>>;
  /** Patient's free-text concern — drives the side-photo recommendation. */
  concern?: string;
  onDone: (images: CapturedImage[]) => void;
}

// The side photo reads what the front can't: projection (jaw / chin / nose — how
// far things sit forward). We detect interest from the patient's free text and
// nudge for it. CLINICAL assumption — flagged for surgeon review (docs).
const VIEW_HINTS: { re: RegExp; view: ViewKey; area: string }[] = [
  { re: /\b(jaw|jawline|jowl)/i, view: "profile", area: "jawline" },
  { re: /\bchins?\b/i, view: "profile", area: "chin" }, // \b both sides so "chinese" doesn't trip it
  { re: /\b(nose|nostril|bridge)/i, view: "profile", area: "nose" },
];

// What the side photo reads best — shown as a STATIC note so anyone curious about
// those areas knows to add it, regardless of what they typed.
const VIEW_GOOD_FOR: Partial<Record<ViewKey, string>> = {
  profile: "jawline, chin & nose",
};

// Front is required; the side photo is optional but unlocks the profile preview.
export function Capture({ initialPhotos, concern = "", onDone }: Props) {
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

  // Areas the concern suggests would read better from a given optional angle.
  // Encouraged, never required.
  const hintedAreas = (view: ViewKey) =>
    view === "front"
      ? []
      : [
          ...new Set(
            VIEW_HINTS.filter(
              (h) => h.view === view && h.re.test(concern),
            ).map((h) => h.area),
          ),
        ];

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="font-display text-xl font-semibold">Your photos</h2>
        <p className="mt-1.5 text-sm leading-relaxed text-ink-500">
          The front photo is all we need. Adding a side photo lets us preview
          your chin, jaw, and nose from the side too.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {VIEWS.map((v) => {
          const url = photos[v.key];
          const areas = hintedAreas(v.key);
          const recommended = areas.length > 0 && !url;
          return (
            <div
              key={v.key}
              className={`flex items-center gap-3 rounded-xl border p-3 ${
                recommended
                  ? "border-[var(--accent)]/50 bg-[var(--accent)]/5"
                  : "border-ink-200"
              }`}
            >
              <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-ink-100">
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
                  {recommended ? (
                    <span className="ml-2 rounded-full bg-[var(--accent)]/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--accent)]">
                      Recommended
                    </span>
                  ) : (
                    !v.required && (
                      <span className="ml-2 text-xs text-ink-400">
                        optional
                      </span>
                    )
                  )}
                </div>
                <p className="truncate text-xs text-ink-400">
                  {recommended
                    ? `The clearest way to read your ${areas.join(" and ")}.`
                    : VIEW_GOOD_FOR[v.key]
                      ? `Best for your ${VIEW_GOOD_FOR[v.key]}.`
                      : v.instruction}
                </p>
              </div>
              <button
                onClick={() => setCapturing(v.key)}
                className="shrink-0 rounded-full border border-ink-300 px-4 py-1.5 text-sm font-medium"
              >
                {url ? "Retake" : "Add"}
              </button>
            </div>
          );
        })}
      </div>

      <Button onClick={done} disabled={!photos.front} className="px-7 py-3">
        See my read
      </Button>
      <p className="text-center text-xs text-ink-400">
        We use your photos only to create your result — we don&apos;t store
        them.
      </p>
    </div>
  );
}
