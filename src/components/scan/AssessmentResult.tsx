"use client";

import type { Assessment } from "@/lib/assessment-schema";
import { AREA_LABELS, DISCLAIMER } from "@/lib/assessment-schema";
import { CLINIC } from "@/lib/clinic";

interface Props {
  assessment: Assessment;
  /** area key → marker number, matching the dots on the photo. */
  numberByArea: Record<string, number>;
  onBook: () => void;
}

/**
 * The patient result is deliberately simple (surgeon's direction): a short
 * treatment-plan checklist tied to the numbered markers on the photo, then the
 * booking CTA. The detailed per-area editing lives in the future clinician tool.
 */
export function AssessmentResult({ assessment, numberByArea, onBook }: Props) {
  const uniqueAreas = assessment.areas.filter(
    (a, i) => assessment.areas.findIndex((b) => b.area === a.area) === i,
  );

  return (
    <div className="flex flex-col gap-5">
      {uniqueAreas.length > 0 ? (
        <>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-400">
            Your treatment plan
          </p>
          <ul className="flex flex-col gap-3">
            {uniqueAreas.map((a) => (
              <li
                key={a.area}
                className="flex gap-3 rounded-2xl border border-border bg-surface p-4"
              >
                <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-[11px] font-bold text-white">
                  {numberByArea[a.area]}
                </span>
                <div>
                  <p className="font-medium">{AREA_LABELS[a.area]}</p>
                  <p className="mt-0.5 text-sm leading-relaxed text-neutral-500">
                    {a.why}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="rounded-2xl border border-[var(--accent)]/30 bg-[var(--accent)]/5 px-4 py-3.5 text-sm leading-relaxed text-neutral-600">
          Your features read beautifully balanced — there&apos;s nothing we&apos;d
          push. If you&apos;re curious, a consultation is the best place to explore
          subtle refinements.
        </p>
      )}

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
