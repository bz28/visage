"use client";

import type { Assessment } from "@/lib/assessment-schema";
import { AREA_LABELS, DISCLAIMER } from "@/lib/assessment-schema";
import { CLINIC } from "@/lib/clinic";
import { Button } from "@/components/ui/Button";

interface Props {
  assessment: Assessment;
  /** Areas currently included in the preview. */
  selected: Set<string>;
  /** Toggle an area in/out of the preview. */
  onToggle: (area: string) => void;
  /** Highlight an area's pin on the photo (null clears). */
  onHighlight: (area: string | null) => void;
  onBook: () => void;
}

// How sure the read is, in the patient's language — anchored to OUR read, not a
// verdict on them. Low confidence leans into "confirm in person", which is both
// honest and the right see-a-provider nudge.
const CONFIDENCE_LABEL: Record<"low" | "medium" | "high", string> = {
  high: "Clear from your photo",
  medium: "A fairly clear read",
  low: "Best confirmed in person",
};

/**
 * The patient result is deliberately simple (surgeon's direction): a short
 * treatment-plan list, then the booking CTA. Each area shows its explanation
 * (always visible) with an explicit "In preview" switch — the switch is the only
 * thing that adds/removes the area from the before/after (we re-paste a subset of
 * the same generation, no new render). Hovering/tapping a card highlights that
 * area's pin on the photo. Per-area amount editing is the clinician tool.
 */
export function AssessmentResult({
  assessment,
  selected,
  onToggle,
  onHighlight,
  onBook,
}: Props) {
  const uniqueAreas = assessment.areas
    .filter((a, i) => assessment.areas.findIndex((b) => b.area === a.area) === i)
    // Lead with what we'd most want to talk through (priority 1 = first).
    .sort((a, b) => a.priority - b.priority);

  return (
    <div className="flex flex-col gap-5">
      {uniqueAreas.length > 0 ? (
        <>
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-400">
              Areas we&apos;d explore
            </p>
            {uniqueAreas.length > 1 && (
              <p className="text-xs text-ink-400">
                Tap an area to find it on your photo
              </p>
            )}
          </div>
          <ul className="flex flex-col gap-3">
            {uniqueAreas.map((a, i) => {
              const on = selected.has(a.area);
              const label = AREA_LABELS[a.area];
              return (
                // Hover / tap / keyboard-focus highlights this area's pin on the
                // photo (focus bubbles up from the switch inside). Staggered
                // entrance so the plan settles in rather than snapping.
                <li
                  key={a.area}
                  style={{ animationDelay: `${i * 55}ms` }}
                  onMouseEnter={() => onHighlight(a.area)}
                  onMouseLeave={() => onHighlight(null)}
                  onClick={() => onHighlight(a.area)}
                  onFocus={() => onHighlight(a.area)}
                  onBlur={() => onHighlight(null)}
                  className={`animate-rise flex items-start justify-between gap-3 rounded-2xl border p-4 transition-colors ${
                    on
                      ? "border-border bg-surface hover:border-ink-300"
                      : "border-dashed border-ink-300 bg-transparent"
                  }`}
                >
                  <div className={`min-w-0 ${on ? "" : "opacity-55"}`}>
                    <p className="flex items-center gap-2 font-medium">
                      {/* A dot that matches this area's pin on the photo, so the
                          card↔pin link is obvious. Only when it's in the preview
                          (= a pin is actually shown). */}
                      {on && (
                        <span
                          className="size-2 shrink-0 rounded-full bg-[var(--accent)]"
                          aria-hidden
                        />
                      )}
                      {label}
                    </p>
                    <p className="mt-0.5 text-sm leading-relaxed text-ink-500">
                      {a.why}
                    </p>
                    <span
                      className={`mt-2 inline-flex w-fit items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${
                        a.confidence === "low"
                          ? "bg-[var(--accent)]/10 text-[var(--accent)]"
                          : "bg-ink-100 text-ink-500"
                      }`}
                    >
                      {CONFIDENCE_LABEL[a.confidence]}
                    </span>
                  </div>
                  <Switch on={on} label={label} onToggle={() => onToggle(a.area)} />
                </li>
              );
            })}
          </ul>
        </>
      ) : (
        <p className="rounded-2xl border border-[var(--accent)]/30 bg-[var(--accent)]/5 px-4 py-3.5 text-sm leading-relaxed text-ink-600">
          Your features read beautifully balanced — there&apos;s nothing we&apos;d
          push. If you&apos;re curious, a consultation is the best place to explore
          subtle refinements.
        </p>
      )}

      <p className="text-xs leading-relaxed text-ink-400">{DISCLAIMER}</p>

      <div className="sticky bottom-4 z-10 flex flex-col gap-2.5 rounded-2xl border border-border bg-surface/95 p-3 shadow-pop backdrop-blur">
        <Button onClick={onBook} className="px-7 py-3.5">
          Book a consultation
        </Button>
        <p className="flex items-center justify-center gap-1.5 text-center text-xs text-ink-500">
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

function Switch({
  on,
  label,
  onToggle,
}: {
  on: boolean;
  label: string;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={`${label} in preview`}
      onClick={(e) => {
        e.stopPropagation(); // don't also trigger the card's highlight
        onToggle();
      }}
      className="flex shrink-0 items-center gap-2 rounded-full p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
    >
      <span
        className={`text-[11px] font-medium uppercase tracking-wide ${
          on ? "text-[var(--accent)]" : "text-ink-400"
        }`}
      >
        {on ? "In preview" : "Off"}
      </span>
      <span
        className={`relative h-5 w-9 rounded-full transition-colors ${
          on ? "bg-[var(--accent)]" : "bg-ink-300"
        }`}
      >
        <span
          className={`absolute top-0.5 size-4 rounded-full bg-white shadow-card transition-all ${
            on ? "left-[18px]" : "left-0.5"
          }`}
        />
      </span>
    </button>
  );
}
