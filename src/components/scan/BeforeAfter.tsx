"use client";

import { useRef, useState } from "react";
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
  loading: boolean;
  /** Shown over the photo when there's no "after" and we're not loading. */
  placeholder?: string;
}

type Mode = "slider" | "side";

/**
 * The hero before/after. Defaults to side-by-side (both photos at once); a
 * toggle switches to a drag-to-reveal slider (the divider wipes open when the
 * result lands). The "now" photo carries pin + label markers. Everything is plain
 * <img> + positioned HTML so the labels stay crisp and never obscure the face.
 */
export function BeforeAfter({
  beforeSrc,
  afterSrc,
  imageWidth,
  imageHeight,
  markers,
  highlightedArea,
  loading,
  placeholder,
}: Props) {
  // Default to side-by-side (the surgeon's explicit ask + immediately legible);
  // the slider is the interactive enhancement behind the toggle.
  const [mode, setMode] = useState<Mode>("side");
  const [split, setSplit] = useState(100); // start fully on "now"
  // `isDragging` drives the render (transition on/off); `draggingRef` is read
  // synchronously inside pointer handlers so no move events are missed.
  const [isDragging, setIsDragging] = useState(false);
  const draggingRef = useRef(false);
  const revealedRef = useRef(false); // wipe-reveal happens once, on first result
  const frameRef = useRef<HTMLDivElement>(null);

  const setDrag = (v: boolean) => {
    draggingRef.current = v;
    setIsDragging(v);
  };

  // Fired when the "after" image finishes loading: the first time, wipe the
  // divider open to reveal it (later re-composites from toggling keep the user's
  // slider position).
  function onAfterReady() {
    if (!revealedRef.current) {
      revealedRef.current = true;
      setSplit(55);
    }
  }

  function moveTo(clientX: number) {
    const rect = frameRef.current?.getBoundingClientRect();
    if (!rect) return;
    const pct = ((clientX - rect.left) / rect.width) * 100;
    setSplit(Math.max(0, Math.min(100, pct)));
  }

  const showAfter = !!afterSrc;
  const sliderMode = mode === "slider" && showAfter;
  // Side-by-side shows two full photos, so the frame is twice as wide — that
  // keeps each column at the photo's own aspect, so object-cover doesn't crop
  // and the pins line up.
  const aspect =
    mode === "side" && showAfter
      ? `${imageWidth * 2} / ${imageHeight}`
      : `${imageWidth} / ${imageHeight}`;
  // With no "after", the before must fill the frame regardless of slider state.
  const effSplit = showAfter ? split : 100;

  return (
    <div className="flex flex-col gap-3">
      <div
        ref={frameRef}
        className="relative mx-auto w-full max-w-2xl select-none overflow-hidden rounded-3xl bg-neutral-100 shadow-lg ring-1 ring-black/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)]"
        style={{ aspectRatio: aspect }}
        {...(sliderMode && {
          role: "slider" as const,
          tabIndex: 0,
          "aria-label": "Drag to compare before and after",
          "aria-valuemin": 0,
          "aria-valuemax": 100,
          "aria-valuenow": Math.round(effSplit),
          onKeyDown: (e: React.KeyboardEvent) => {
            if (e.key === "ArrowLeft") setSplit((s) => Math.max(0, s - 4));
            else if (e.key === "ArrowRight") setSplit((s) => Math.min(100, s + 4));
          },
        })}
        onPointerDown={
          sliderMode
            ? (e) => {
                setDrag(true);
                try {
                  e.currentTarget.setPointerCapture(e.pointerId);
                } catch {
                  // pointer may no longer be active — capture is best-effort
                }
                moveTo(e.clientX);
              }
            : undefined
        }
        onPointerMove={(e) => draggingRef.current && moveTo(e.clientX)}
        onPointerUp={() => setDrag(false)}
        onPointerCancel={() => setDrag(false)}
        onLostPointerCapture={() => setDrag(false)}
      >
        {mode === "side" && showAfter ? (
          // Side-by-side: now | with treatment.
          <div className="grid size-full grid-cols-2">
            <div className="relative overflow-hidden border-r border-white/60">
              <Photo src={beforeSrc} />
              <Pins markers={markers} imageWidth={imageWidth} imageHeight={imageHeight} highlightedArea={highlightedArea} />
              <Caption side="left">Now</Caption>
            </div>
            <div className="relative overflow-hidden">
              <Photo src={afterSrc} alt="Simulated result with the recommended treatment" reveal onReady={onAfterReady} />
              <Badge />
              <Caption side="right" accent>
                With treatment
              </Caption>
            </div>
          </div>
        ) : (
          // Slider (or before-only while loading): after underneath, now on top
          // clipped to the divider.
          <>
            {showAfter && <Photo src={afterSrc} alt="Simulated result with the recommended treatment" reveal onReady={onAfterReady} />}
            {showAfter && <Badge />}
            <div
              className="absolute inset-0"
              style={{
                clipPath: `inset(0 ${100 - effSplit}% 0 0)`,
                transition: isDragging ? "none" : "clip-path 0.7s cubic-bezier(0.4,0,0.2,1)",
              }}
            >
              <Photo src={beforeSrc} />
              <Pins markers={markers} imageWidth={imageWidth} imageHeight={imageHeight} highlightedArea={highlightedArea} />
            </div>

            {showAfter && (
              <>
                <Caption side="left">Now</Caption>
                <Caption side="right" accent>
                  With treatment
                </Caption>
                {/* Divider + handle */}
                <div
                  className="pointer-events-none absolute inset-y-0"
                  style={{
                    left: `${effSplit}%`,
                    transition: isDragging ? "none" : "left 0.7s cubic-bezier(0.4,0,0.2,1)",
                  }}
                >
                  <div className="absolute inset-y-0 -ml-px w-0.5 bg-white/90 shadow" />
                  <div className="absolute top-1/2 -ml-4 -mt-4 flex size-8 items-center justify-center rounded-full bg-white text-neutral-700 shadow-md ring-1 ring-black/5">
                    <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7 4 12l4 5M16 7l4 5-4 5" />
                    </svg>
                  </div>
                </div>
              </>
            )}

            {/* Loading / placeholder overlays (no "after" yet) */}
            {!showAfter && (loading || placeholder) && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2.5 bg-black/30 text-center backdrop-blur-[1px]">
                {loading ? (
                  <>
                    <span className="size-6 animate-spin rounded-full border-2 border-white/80 border-t-transparent" />
                    <span className="px-4 text-sm font-medium text-white drop-shadow">
                      Creating your preview…
                    </span>
                  </>
                ) : (
                  <span className="px-6 text-sm font-medium text-white drop-shadow">
                    {placeholder}
                  </span>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Mode toggle (only once there's something to compare) */}
      {showAfter && (
        <div className="mx-auto flex items-center gap-1 rounded-full bg-neutral-100 p-1 text-sm">
          <ModeButton active={mode === "slider"} onClick={() => setMode("slider")}>
            Slider
          </ModeButton>
          <ModeButton active={mode === "side"} onClick={() => setMode("side")}>
            Side by side
          </ModeButton>
        </div>
      )}
    </div>
  );
}

function Photo({
  src,
  alt = "",
  reveal,
  onReady,
}: {
  src: string;
  alt?: string;
  reveal?: boolean;
  onReady?: () => void;
}) {
  const [loaded, setLoaded] = useState(false);
  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src={src}
      alt={alt}
      draggable={false}
      onLoad={() => {
        setLoaded(true);
        onReady?.();
      }}
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
}: {
  markers: Marker[];
  imageWidth: number;
  imageHeight: number;
  highlightedArea?: string | null;
}) {
  // Only dim siblings when the highlighted area is actually shown as a pin (it
  // may have just been toggled off — then nothing should dim).
  const active = markers.some((m) => m.area === highlightedArea);
  return (
    <>
      {markers.map((m) => {
        const hi = m.area === highlightedArea;
        const dim = active && !hi;
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
            <span
              className={`rounded-full bg-[var(--accent)] transition-all ${
                hi ? "size-2.5 ring-4 ring-[var(--accent)]/30" : "size-2 ring-2 ring-white/90"
              }`}
            />
            <span className="whitespace-nowrap rounded-full bg-black/75 px-2 py-0.5 text-[11px] font-semibold text-white">
              {AREA_LABELS[m.area]}
            </span>
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

function ModeButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-4 py-1.5 font-medium transition-colors ${
        active ? "bg-white text-foreground shadow-sm" : "text-neutral-500 hover:text-neutral-700"
      }`}
    >
      {children}
    </button>
  );
}
