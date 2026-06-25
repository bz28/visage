"use client";

import { useState } from "react";
import type { Marker } from "@/lib/annotations";
import { AREA_LABELS } from "@/lib/assessment-schema";

interface Props {
  beforeSrc: string;
  afterSrc: string | null;
  imageWidth: number;
  imageHeight: number;
  /** Pins drawn over the "now" photo (already filtered to selected areas). */
  markers: Marker[];
  /** Area to emphasize (hovered/tapped in the plan); dims the others. */
  highlightedArea?: string | null;
  /** Tapping a dot on the photo highlights that area (reveals its label). */
  onPinClick?: (area: string) => void;
  loading: boolean;
  /** Shown in the right panel when there's no "after" and we're not loading. */
  placeholder?: string;
}

/**
 * The hero before/after — Now | With treatment, side by side. The "now" photo
 * carries pin + label markers; tapping a dot (or a plan row) reveals its label.
 * The right panel shows a ghost (skeleton + status) until the result lands, so
 * the two-up layout doesn't jump in. Plain <img> + positioned HTML so labels
 * stay crisp and never obscure the face.
 */
export function BeforeAfter({
  beforeSrc,
  afterSrc,
  imageWidth,
  imageHeight,
  markers,
  highlightedArea,
  onPinClick,
  loading,
  placeholder,
}: Props) {
  const showAfter = !!afterSrc;
  // Two full photos side by side → the frame is twice as wide, so each column
  // keeps the photo's own aspect (object-cover doesn't crop, pins line up).
  const aspect = `${imageWidth * 2} / ${imageHeight}`;

  return (
    <div
      className="mx-auto grid w-full max-w-2xl grid-cols-2 overflow-hidden rounded-3xl bg-neutral-100 shadow-lg ring-1 ring-black/5"
      style={{ aspectRatio: aspect }}
    >
      <div className="relative overflow-hidden border-r border-white/60">
        <Photo src={beforeSrc} />
        <Pins
          markers={markers}
          imageWidth={imageWidth}
          imageHeight={imageHeight}
          highlightedArea={highlightedArea}
          onPinClick={onPinClick}
        />
        <Caption side="left">Now</Caption>
      </div>
      <div className="relative overflow-hidden bg-neutral-100">
        {showAfter ? (
          <>
            <Photo
              src={afterSrc}
              alt="Simulated result with the recommended treatment"
              reveal
            />
            <Badge />
          </>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2.5 px-3 text-center">
            {loading ? (
              <>
                <span className="size-6 animate-spin rounded-full border-2 border-[var(--accent)] border-t-transparent" />
                <span className="text-xs text-neutral-500">
                  Creating your preview…
                </span>
              </>
            ) : (
              <span className="text-xs text-neutral-400">{placeholder}</span>
            )}
          </div>
        )}
        <Caption side="right" accent>
          With treatment
        </Caption>
      </div>
    </div>
  );
}

function Photo({
  src,
  alt = "",
  reveal,
}: {
  src: string;
  alt?: string;
  reveal?: boolean;
}) {
  const [loaded, setLoaded] = useState(false);
  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src={src}
      alt={alt}
      draggable={false}
      onLoad={() => setLoaded(true)}
      className={`absolute inset-0 size-full object-cover transition-opacity duration-500 ${
        reveal && !loaded ? "opacity-0" : "opacity-100"
      }`}
    />
  );
}

function Pins({
  markers,
  imageWidth,
  imageHeight,
  highlightedArea,
  onPinClick,
}: {
  markers: Marker[];
  imageWidth: number;
  imageHeight: number;
  highlightedArea?: string | null;
  onPinClick?: (area: string) => void;
}) {
  // Only dim siblings when the highlighted area is actually shown as a pin (it
  // may have just been toggled off — then nothing should dim).
  const active = markers.some((m) => m.area === highlightedArea);
  const dotClass = (hi: boolean) =>
    `block rounded-full bg-[var(--accent)] transition-all ${
      hi ? "size-2.5 ring-4 ring-[var(--accent)]/30" : "size-2 ring-2 ring-white/90"
    }`;
  return (
    <>
      {markers.map((m) => {
        const hi = m.area === highlightedArea;
        const dim = active && !hi;
        const label = AREA_LABELS[m.area];
        return (
          <div
            key={m.area}
            className={`pointer-events-none absolute flex -translate-x-1/2 flex-col items-center gap-1 transition-all duration-200 ${
              dim ? "opacity-30" : "opacity-100"
            } ${hi ? "z-10 scale-110" : ""}`}
            style={{
              left: `${(m.point.x / imageWidth) * 100}%`,
              top: `${(m.point.y / imageHeight) * 100}%`,
            }}
          >
            {onPinClick ? (
              <button
                type="button"
                aria-label={label}
                onClick={() => onPinClick(m.area)}
                className="pointer-events-auto flex size-6 items-center justify-center"
              >
                <span className={dotClass(hi)} />
              </button>
            ) : (
              <span className={dotClass(hi)} />
            )}
            {/* Label only for the highlighted pin — keeps the photo uncluttered. */}
            {hi && (
              <span className="whitespace-nowrap rounded-full bg-black/75 px-2 py-0.5 text-[11px] font-semibold text-white">
                {label}
              </span>
            )}
          </div>
        );
      })}
    </>
  );
}

function Badge() {
  return (
    <span className="absolute left-3 top-3 rounded-full bg-black/75 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-white">
      Simulated
    </span>
  );
}

function Caption({
  side,
  accent,
  children,
}: {
  side: "left" | "right";
  accent?: boolean;
  children: React.ReactNode;
}) {
  return (
    <span
      className={`absolute bottom-3 ${side === "left" ? "left-3" : "right-3"} rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-white ${
        accent ? "bg-[var(--accent)]" : "bg-black/60"
      }`}
    >
      {children}
    </span>
  );
}
