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
          <li key={label} className="flex flex-1 flex-col items-center gap-1.5">
            <div className="flex w-full items-center">
              <span
                aria-current={state === "current" ? "step" : undefined}
                className={`h-1 w-full rounded-full transition-colors ${
                  state === "upcoming"
                    ? "bg-border"
                    : "bg-[var(--accent)]"
                }`}
              />
            </div>
            <span
              className={`text-[11px] font-medium tracking-wide transition-colors ${
                state === "upcoming" ? "text-neutral-400" : "text-[var(--accent)]"
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
