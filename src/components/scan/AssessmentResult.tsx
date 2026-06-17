"use client";

import type { Assessment } from "@/lib/assessment-schema";
import { AREA_LABELS, DISCLAIMER } from "@/lib/assessment-schema";

interface Props {
  assessment: Assessment;
  source: "ai" | "baseline";
  onHoverArea: (area: string | null) => void;
  onBook: () => void;
  onDeeper?: () => void;
  deeperLoading?: boolean;
}

const confidenceLabel: Record<string, string> = {
  low: "Worth confirming in person",
  medium: "Moderate signal",
  high: "Clear signal",
};

export function AssessmentResult({
  assessment,
  source,
  onHoverArea,
  onBook,
  onDeeper,
  deeperLoading,
}: Props) {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <div className="mb-1 text-xs font-medium uppercase tracking-wide text-neutral-400">
          {source === "ai" ? "Expert AI read" : "On-device read"}
        </div>
        <p className="text-[15px] leading-relaxed text-neutral-700">
          {assessment.summary}
        </p>
      </div>

      <ul className="flex flex-col gap-3">
        {assessment.areas.map((a, i) => (
          <li
            key={`${a.area}-${i}`}
            onMouseEnter={() => onHoverArea(a.area)}
            onMouseLeave={() => onHoverArea(null)}
            className="rounded-xl border border-neutral-200 p-4 transition-colors hover:border-neutral-400"
          >
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="font-semibold">{a.title}</h3>
              <span className="shrink-0 text-xs text-neutral-400">
                {AREA_LABELS[a.area]}
              </span>
            </div>
            <p className="mt-1.5 text-sm text-neutral-700">{a.observation}</p>
            <p className="mt-2 text-sm text-neutral-500">
              <span className="font-medium text-neutral-600">Why: </span>
              {a.why}
            </p>
            <div className="mt-2 text-xs text-neutral-400">
              {confidenceLabel[a.confidence]}
            </div>
          </li>
        ))}
      </ul>

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
            {deeperLoading ? "Analyzing…" : "Get a deeper expert read"}
          </button>
        )}
      </div>

      <p className="text-xs leading-relaxed text-neutral-400">{DISCLAIMER}</p>
    </div>
  );
}
