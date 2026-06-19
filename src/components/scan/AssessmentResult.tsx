"use client";

import type { Assessment } from "@/lib/assessment-schema";
import { AREA_LABELS, DISCLAIMER } from "@/lib/assessment-schema";
import { CLINIC } from "@/lib/clinic";

interface Props {
  assessment: Assessment;
  /** area key → marker number, matching the dots on the photo. */
  numberByArea: Record<string, number>;
  active: string | null;
  onSetActive: (area: string | null) => void;
  onBook: () => void;
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
            {uniqueAreas.length} area{uniqueAreas.length > 1 ? "s" : ""} we&apos;d
            talk through
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
                        Roughly:{" "}
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
            </div>
          ) : (
            <p className="rounded-2xl border border-dashed border-neutral-300 px-4 py-3.5 text-sm text-neutral-400">
              Tap a number — on your photo or above — to see what we&apos;d
              discuss there, and why.
            </p>
          )}
        </>
      ) : (
        <p className="rounded-2xl border border-[var(--accent)]/30 bg-[var(--accent)]/5 px-4 py-3.5 text-sm leading-relaxed text-neutral-600">
          Your features read beautifully balanced — there&apos;s nothing we&apos;d
          push. If you&apos;re curious, a consultation is the best place to explore
          subtle refinements.
        </p>
      )}

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

      <p className="text-xs leading-relaxed text-neutral-400">{DISCLAIMER}</p>
    </div>
  );
}
