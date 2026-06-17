"use client";

import { useEffect, useRef } from "react";
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
export function FaceCanvas({
  dataUrl,
  imageWidth,
  imageHeight,
  markers,
  active,
  onSelectArea,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  function handleClick(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!onSelectArea) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scale = rect.width / imageWidth;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    // Find the nearest marker within a generous touch radius.
    let hit: string | null = null;
    let best = 24; // px
    for (const m of markers) {
      const d = Math.hypot(m.point.x * scale - x, m.point.y * scale - y);
      if (d < best) {
        best = d;
        hit = m.area;
      }
    }
    onSelectArea(hit && hit === active ? null : hit);
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const img = new Image();
    img.onload = () => {
      const cssWidth = canvas.clientWidth || imageWidth;
      const scale = cssWidth / imageWidth;
      const cssHeight = imageHeight * scale;
      const dpr = window.devicePixelRatio || 1;

      canvas.width = cssWidth * dpr;
      canvas.height = cssHeight * dpr;
      canvas.style.height = `${cssHeight}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      ctx.clearRect(0, 0, cssWidth, cssHeight);
      ctx.drawImage(img, 0, 0, cssWidth, cssHeight);

      const accent =
        getComputedStyle(document.documentElement)
          .getPropertyValue("--accent")
          .trim() || "#b8895f";

      for (const m of markers) {
        const x = m.point.x * scale;
        const y = m.point.y * scale;
        const isActive = active === m.area;
        const r = isActive ? 15 : 12;

        // numbered accent dot — always legible, so the dot means something at rest
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
    };
    img.src = dataUrl;
  }, [dataUrl, imageWidth, imageHeight, markers, active]);

  return (
    <canvas
      ref={canvasRef}
      onClick={handleClick}
      className={`w-full rounded-2xl shadow-sm ${onSelectArea ? "cursor-pointer" : ""}`}
      aria-label="Your photo with the areas an injector might discuss marked"
    />
  );
}
