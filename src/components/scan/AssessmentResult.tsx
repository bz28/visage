"use client";

import type { Assessment } from "@/lib/assessment-schema";
import { AREA_LABELS, DISCLAIMER } from "@/lib/assessment-schema";
import { CLINIC } from "@/lib/clinic";
import {
  LOOKS,
  DEFAULT_LOOK,
  isSimulatable,
  type LookKey,
  type SimulatableArea,
} from "@/lib/simulation";

interface Props {
  assessment: Assessment;
  /** area key → marker number, matching the dots on the photo. */
  numberByArea: Record<string, number>;
  active: string | null;
  onSetActive: (area: string | null) => void;
  onBook: () => void;
  /** Preview wiring (before/after simulation). */
  canPreview: boolean;
  previewArea: SimulatableArea | null;
  previewLook: LookKey | null;
  previewLoading: boolean;
  previewFailed: boolean;
  onPreview: (area: SimulatableArea, look: LookKey) => void;
}

const confidenceLabel: Record<string, string> = {
  low: "Subtle — best judged in person",
  medium: "Worth discussing",
  high: "Clearly worth a look",
};

export function AssessmentResult({
  assessment,
  numberByArea,
  active,
  onSetActive,
  onBook,
  canPreview,
  previewArea,
  previewLook,
  previewLoading,
  previewFailed,
  onPreview,
}: Props) {
  // Unique areas in marker order, for the chip row.
  const uniqueAreas = assessment.areas.filter(
    (a, i) => assessment.areas.findIndex((b) => b.area === a.area) === i,
  );
  const activeItems = assessment.areas.filter((a) => a.area === active);

  return (
    <div className="flex flex-col gap-5">
      {uniqueAreas.length > 0 ? (
        <>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-400">
            {`${uniqueAreas.length} ${
              uniqueAreas.length > 1 ? "areas" : "area"
            } we'd talk through`}
          </p>

          {/* Numbered chips — tap to expand (mirrors the dots on the photo). */}
          <div className="flex flex-wrap gap-2">
            {uniqueAreas.map((a) => {
              const isActive = active === a.area;
              return (
                <button
                  key={a.area}
                  onClick={() => onSetActive(isActive ? null : a.area)}
                  className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors ${
                    isActive
                      ? "border-[var(--accent)] bg-[var(--accent)]/10"
                      : "border-neutral-300 hover:border-neutral-400"
                  }`}
                >
                  <span className="flex size-5 items-center justify-center rounded-full bg-[var(--accent)] text-[11px] font-bold text-white">
                    {numberByArea[a.area]}
                  </span>
                  {AREA_LABELS[a.area]}
                </button>
              );
            })}
          </div>

          {/* Expanding detail for the tapped number. */}
          {activeItems.length > 0 ? (
            <div className="flex flex-col gap-3 rounded-2xl border border-[var(--accent)]/40 bg-[var(--accent)]/5 p-5">
              {activeItems.map((a, i) => (
                <div key={i}>
                  <h3 className="font-display text-lg font-semibold">
                    {a.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-neutral-700">
                    {a.observation}
                  </p>
                  <p className="mt-2.5 text-sm leading-relaxed text-neutral-500">
                    <span className="font-medium text-neutral-600">Why: </span>
                    {a.why}
                  </p>
                  {a.roughAmount && (
                    <p className="mt-2.5 text-sm leading-relaxed text-neutral-500">
                      <span className="font-medium text-neutral-600">
                        Very roughly:{" "}
                      </span>
                      {a.roughAmount}
                    </p>
                  )}
                  <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/70 px-2.5 py-1 text-xs text-neutral-500">
                    <span className="size-1.5 rounded-full bg-[var(--accent)]" />
                    {confidenceLabel[a.confidence]}
                  </div>
                </div>
              ))}

              {active && isSimulatable(active) && canPreview && (
                <div className="flex flex-col gap-2.5 rounded-xl border border-border bg-surface p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">See your preview</p>
                    <span className="rounded-full bg-[var(--accent)]/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--accent)]">
                      Simulated
                    </span>
                  </div>

                  {previewFailed ? (
                    <p className="text-sm text-neutral-500">
                      Preview isn&apos;t available right now — your read still
                      stands.
                    </p>
                  ) : previewArea === active ? (
                    <>
                      <div className="flex gap-2">
                        {LOOKS.map((l) => {
                          const on = previewLook === l.key;
                          return (
                            <button
                              key={l.key}
                              disabled={previewLoading}
                              onClick={() => onPreview(active, l.key)}
                              className={`flex-1 rounded-full border px-3 py-2 text-sm transition-colors disabled:opacity-50 ${
                                on
                                  ? "border-[var(--accent)] bg-[var(--accent)]/10 font-medium"
                                  : "border-neutral-300 hover:border-neutral-400"
                              }`}
                            >
                              {l.label}
                            </button>
                          );
                        })}
                      </div>
                      <p className="text-xs text-neutral-400">
                        {previewLoading
                          ? "Rendering your preview…"
                          : "Press and hold the photo to compare to before."}
                      </p>
                    </>
                  ) : (
                    <>
                      <button
                        disabled={previewLoading}
                        onClick={() => onPreview(active, DEFAULT_LOOK)}
                        className="rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-transform active:scale-[0.99] disabled:opacity-50"
                      >
                        {previewLoading
                          ? "Rendering your preview…"
                          : `See your ${AREA_LABELS[active].toLowerCase()} preview`}
                      </button>
                      <p className="text-xs text-neutral-400">
                        A simulated look at the difference — a starting point, not
                        a promise.
                      </p>
                    </>
                  )}
                </div>
              )}

              {active && !isSimulatable(active) && (
                <p className="rounded-xl border border-dashed border-neutral-300 bg-surface px-4 py-3 text-xs leading-relaxed text-neutral-500">
                  This area is a delicate one we read best in person — we&apos;d
                  rather walk you through it together than show a rough preview.
                </p>
              )}
            </div>
          ) : (
            <p className="rounded-2xl border border-dashed border-neutral-300 px-4 py-3.5 text-sm text-neutral-400">
              Tap a number — on your photo or above — to see what we&apos;d
              discuss there, and why.
            </p>
          )}
        </>
      ) : null}

      {/* Disclaimer sits ABOVE the (desktop-)sticky CTA so it can't slide under it. */}
      <p className="text-xs leading-relaxed text-neutral-400">{DISCLAIMER}</p>

      <div className="z-10 flex flex-col gap-2.5 rounded-2xl border border-border bg-surface/95 p-3 shadow-lg backdrop-blur md:sticky md:bottom-4">
        <button
          onClick={onBook}
          className="rounded-full bg-foreground px-7 py-3.5 font-medium text-background transition-transform active:scale-[0.99]"
        >
          Book a consultation
        </button>
        <p className="flex items-center justify-center gap-1.5 text-center text-xs text-neutral-500">
          <svg
            viewBox="0 0 24 24"
            className="size-3.5 shrink-0 text-[var(--accent)]"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
            />
          </svg>
          A licensed injector at {CLINIC.name} reviews your photos before your
          visit.
        </p>
      </div>
    </div>
  );
}
