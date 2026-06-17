"use client";

import { useEffect, useRef } from "react";
import type { Marker } from "@/lib/annotations";
import { AREA_LABELS } from "@/lib/assessment-schema";

interface Props {
  dataUrl: string;
  imageWidth: number;
  imageHeight: number;
  markers: Marker[];
  /** Area to emphasize (e.g. the one the user is hovering in the list). */
  active?: string | null;
}

/**
 * Draws the user's own photo with annotation markers over the flagged areas.
 * We annotate the real face — never a fabricated "after".
 */
export function FaceCanvas({
  dataUrl,
  imageWidth,
  imageHeight,
  markers,
  active,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

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

      for (const m of markers) {
        const x = m.point.x * scale;
        const y = m.point.y * scale;
        const isActive = active === m.area;
        const r = isActive ? 11 : 8;

        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fillStyle = isActive
          ? "rgba(255,255,255,0.95)"
          : "rgba(255,255,255,0.7)";
        ctx.fill();
        ctx.lineWidth = isActive ? 3 : 2;
        ctx.strokeStyle = isActive ? "#0f0f0f" : "#3f3f3f";
        ctx.stroke();

        if (isActive) {
          const label = AREA_LABELS[m.area];
          ctx.font = "600 13px ui-sans-serif, system-ui, sans-serif";
          const w = ctx.measureText(label).width + 16;
          ctx.fillStyle = "rgba(15,15,15,0.9)";
          ctx.fillRect(x + 14, y - 13, w, 26);
          ctx.fillStyle = "#fff";
          ctx.fillText(label, x + 22, y + 5);
        }
      }
    };
    img.src = dataUrl;
  }, [dataUrl, imageWidth, imageHeight, markers, active]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full rounded-2xl shadow-sm"
      aria-label="Your photo with the areas an injector might discuss marked"
    />
  );
}
