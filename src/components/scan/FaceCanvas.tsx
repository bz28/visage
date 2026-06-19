"use client";

import { useEffect, useRef, useState } from "react";
import type { Marker } from "@/lib/annotations";
import { AREA_LABELS } from "@/lib/assessment-schema";

interface Props {
  dataUrl: string;
  imageWidth: number;
  imageHeight: number;
  markers: Marker[];
  /** Area to emphasize (hovered/tapped in the list). */
  active?: string | null;
  /** Called when a marker on the photo is tapped (null if tapped empty space). */
  onSelectArea?: (area: string | null) => void;
}

// The user's own photo with numbered markers — never a fabricated "after".
// Sizes to its container with a height cap so it fits a desktop column or a
// capped mobile block without forcing scroll.
export function FaceCanvas({
  dataUrl,
  imageWidth,
  imageHeight,
  markers,
  active,
  onSelectArea,
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [loaded, setLoaded] = useState(0);

  function handleClick(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!onSelectArea) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scale = rect.width / imageWidth;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    let hit: string | null = null;
    let best = 24; // px touch radius
    for (const m of markers) {
      const d = Math.hypot(m.point.x * scale - x, m.point.y * scale - y);
      if (d < best) {
        best = d;
        hit = m.area;
      }
    }
    onSelectArea(hit && hit === active ? null : hit);
  }

  // Load (or reload) the image only when the source changes.
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      setLoaded((n) => n + 1);
    };
    img.src = dataUrl;
    return () => {
      imgRef.current = null;
    };
  }, [dataUrl]);

  // Draw on load / marker change / resize.
  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;

    function draw() {
      const img = imgRef.current;
      if (!wrap || !canvas || !img) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const availW = wrap.clientWidth || imageWidth;
      // Let the photo breathe on desktop (immersive read); stay capped on mobile
      // so it never forces scroll past the fold.
      const desktop = window.innerWidth >= 768;
      const maxH = Math.min(
        desktop ? 640 : 460,
        window.innerHeight * (desktop ? 0.72 : 0.5),
      );
      const scale = Math.min(availW / imageWidth, maxH / imageHeight);
      const cssW = imageWidth * scale;
      const cssH = imageHeight * scale;
      const dpr = window.devicePixelRatio || 1;

      canvas.width = cssW * dpr;
      canvas.height = cssH * dpr;
      canvas.style.width = `${cssW}px`;
      canvas.style.height = `${cssH}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      ctx.clearRect(0, 0, cssW, cssH);
      ctx.drawImage(img, 0, 0, cssW, cssH);

      const accent =
        getComputedStyle(document.documentElement)
          .getPropertyValue("--accent")
          .trim() || "#b8895f";

      for (const m of markers) {
        const x = m.point.x * scale;
        const y = m.point.y * scale;
        const isActive = active === m.area;
        const r = isActive ? 15 : 12;

        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fillStyle = accent;
        ctx.globalAlpha = isActive ? 1 : 0.9;
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.lineWidth = isActive ? 3 : 2;
        ctx.strokeStyle = "#fff";
        ctx.stroke();

        ctx.fillStyle = "#fff";
        ctx.font = `700 ${isActive ? 15 : 12}px ui-sans-serif, system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(String(m.n), x, y + 0.5);

        if (isActive) {
          const label = AREA_LABELS[m.area];
          ctx.font = "600 13px ui-sans-serif, system-ui, sans-serif";
          ctx.textAlign = "left";
          const w = ctx.measureText(label).width + 16;
          ctx.fillStyle = "rgba(15,15,15,0.9)";
          ctx.fillRect(x + r + 4, y - 13, w, 26);
          ctx.fillStyle = "#fff";
          ctx.fillText(label, x + r + 12, y + 1);
        }
      }
    }

    draw();
    const ro = new ResizeObserver(() => draw());
    ro.observe(wrap);
    // ResizeObserver only watches width; also redraw on viewport-height changes
    // (mobile URL bar show/hide) so the height cap stays current.
    window.addEventListener("resize", draw);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", draw);
    };
  }, [markers, active, loaded, imageWidth, imageHeight]);

  return (
    <div ref={wrapRef} className="flex justify-center">
      <canvas
        ref={canvasRef}
        onClick={handleClick}
        className={`rounded-2xl shadow-sm ${onSelectArea ? "cursor-pointer" : ""}`}
        aria-label="Your photo with the areas an injector might discuss marked"
      />
    </div>
  );
}
