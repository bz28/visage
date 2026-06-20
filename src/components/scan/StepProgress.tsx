interface Props {
  /** 0-based index of the current stage. */
  current: number;
}

// The guided journey, shown across the flow so the patient always knows where
// they are and how little is left — a small thing that makes it feel considered.
const STAGES = ["Tell us", "Your photos", "Your read", "Book"] as const;

export function StepProgress({ current }: Props) {
  return (
    <ol className="mx-auto flex w-full max-w-md items-center gap-2" aria-label="Progress">
      {STAGES.map((label, i) => {
        const state =
          i < current ? "done" : i === current ? "current" : "upcoming";
        return (
          <li
            key={label}
            aria-current={state === "current" ? "step" : undefined}
            className="flex flex-1 flex-col items-center gap-1.5"
          >
            <span
              className={`h-1 w-full rounded-full transition-colors ${
                state === "upcoming" ? "bg-border" : "bg-[var(--accent)]"
              } ${state === "current" ? "" : "opacity-70"}`}
            />
            <span
              className={`text-[11px] tracking-wide transition-colors ${
                state === "current"
                  ? "font-semibold text-foreground"
                  : state === "done"
                    ? "font-medium text-[var(--accent)]"
                    : "font-medium text-neutral-400"
              }`}
            >
              {label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
