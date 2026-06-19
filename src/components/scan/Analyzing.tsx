"use client";

import { useEffect, useState } from "react";

interface Props {
  /** The front photo to show under the reading overlay, if we have it. */
  dataUrl?: string;
}

// The AI read takes a real moment. Rather than a bare spinner, walk the patient
// through what's happening — it reframes the wait as care, not lag.
const STATUSES = [
  "Mapping your facial proportions…",
  "Comparing against balanced ratios…",
  "Reading soft-tissue and contour…",
  "Noting what an injector would discuss…",
  "Writing up your read…",
] as const;

export function Analyzing({ dataUrl }: Props) {
  const [i, setI] = useState(0);

  useEffect(() => {
    const id = setInterval(
      () => setI((n) => Math.min(n + 1, STATUSES.length - 1)),
      4000,
    );
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex flex-col items-center gap-5">
      <div className="relative w-full max-w-sm overflow-hidden rounded-3xl">
        {dataUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={dataUrl} alt="" className="w-full" />
        ) : (
          <div className="aspect-square w-full bg-neutral-100" />
        )}
        {/* Sweeping scan line over a soft scrim. */}
        <div className="absolute inset-0 bg-black/15" />
        <div className="scan-sweep absolute inset-x-0 h-1/3 bg-gradient-to-b from-transparent via-white/25 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 flex items-center gap-2.5 bg-gradient-to-t from-black/55 to-transparent px-5 pb-5 pt-10">
          <span className="size-4 shrink-0 animate-spin rounded-full border-2 border-white/70 border-t-transparent" />
          <p className="text-sm font-medium text-white drop-shadow">
            {STATUSES[i]}
          </p>
        </div>
      </div>
      <p className="max-w-xs text-center text-xs text-neutral-400">
        Reading carefully — a considered look takes a few seconds.
      </p>
    </div>
  );
}
