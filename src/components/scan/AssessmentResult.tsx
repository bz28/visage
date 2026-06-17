"use client";

import type { Assessment } from "@/lib/assessment-schema";
import { AREA_LABELS, DISCLAIMER } from "@/lib/assessment-schema";

interface Props {
  assessment: Assessment;
  /** area key → marker number, matching the dots on the photo. */
  numberByArea: Record<string, number>;
  active: string | null;
  onSetActive: (area: string | null) => void;
  onBook: () => void;
  onDeeper?: () => void;
  deeperLoading?: boolean;
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
  onDeeper,
  deeperLoading,
}: Props) {
  // Unique areas in marker order, for the chip row.
  const uniqueAreas = assessment.areas.filter(
    (a, i) => assessment.areas.findIndex((b) => b.area === a.area) === i,
  );
  const activeItems = assessment.areas.filter((a) => a.area === active);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <div className="mb-1 text-xs font-medium uppercase tracking-wide text-neutral-400">
          What we&apos;d talk through
        </div>
        <p className="text-[15px] leading-relaxed text-neutral-700">
          {assessment.summary}
        </p>
      </div>

      {uniqueAreas.length > 0 && (
        <>
          {/* Compact numbered chips — tap to expand (mirrors the dots on the photo). */}
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
            <div className="flex flex-col gap-3 rounded-xl border border-[var(--accent)]/50 bg-[var(--accent)]/5 p-4">
              {activeItems.map((a, i) => (
                <div key={i}>
                  <h3 className="font-semibold">{a.title}</h3>
                  <p className="mt-1.5 text-sm text-neutral-700">
                    {a.observation}
                  </p>
                  <p className="mt-2 text-sm text-neutral-500">
                    <span className="font-medium text-neutral-600">Why: </span>
                    {a.why}
                  </p>
                  <div className="mt-2 text-xs text-neutral-400">
                    {confidenceLabel[a.confidence]}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="rounded-xl border border-dashed border-neutral-300 px-4 py-3 text-sm text-neutral-400">
              Tap a number — on your photo or above — to see what an injector
              might discuss there.
            </p>
          )}
        </>
      )}

      <div className="flex flex-col gap-3">
        <button
          onClick={onBook}
          className="rounded-full bg-foreground px-7 py-3 font-medium text-background"
        >
          Book a consultation
        </button>
        {onDeeper && (
          <button
            onClick={onDeeper}
            disabled={deeperLoading}
            className="rounded-full border border-neutral-300 px-7 py-3 font-medium disabled:opacity-50"
          >
            {deeperLoading ? "One moment…" : "Take a closer look"}
          </button>
        )}
      </div>

      <p className="text-xs leading-relaxed text-neutral-400">{DISCLAIMER}</p>
    </div>
  );
}
