"use client";

import { useEffect, useRef, useState } from "react";
import type { Marker } from "@/lib/annotations";
import type { Pt } from "@/lib/landmarks";
import { AREA_LABELS } from "@/lib/assessment-schema";
import { paintAreaRegion } from "@/lib/face-regions";
import { isSimulatable } from "@/lib/simulation";

interface Props {
  dataUrl: string;
  imageWidth: number;
  imageHeight: number;
  /** Full landmark set — used to draw the soft region highlights. */
  landmarks: Pt[];
  /** One per recommended area, for the label position + which areas. */
  markers: Marker[];
}

/**
 * The patient's own photo with each recommended area shown as a soft accent glow
 * over the actual region + a label — so it reads "here's your jawline" directly,
 * no number-matching. Sizes to its container with a height cap.
 */
export function FaceCanvas({
  dataUrl,
  imageWidth,
  imageHeight,
  landmarks,
  markers,
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [loaded, setLoaded] = useState(0);

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
      const desktop = window.innerWidth >= 768;
      const maxH = Math.min(
        desktop ? 560 : 420,
        window.innerHeight * (desktop ? 0.7 : 0.5),
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
      const lm = landmarks.map((p) => ({ x: p.x * scale, y: p.y * scale }));

      // Soft glow over each treated region. Two passes (a brighter highlight
      // core + the accent) so it reads on any skin tone without looking garish.
      for (const m of markers) {
        if (!isSimulatable(m.area)) continue;
        ctx.globalAlpha = 0.4;
        paintAreaRegion(ctx, lm, m.area, cssW, cssH, accent);
        ctx.globalAlpha = 0.22;
        paintAreaRegion(ctx, lm, m.area, cssW, cssH, "#fff");
      }
      ctx.globalAlpha = 1;

      // A label pill per area, at its point. Every discussed area is labelled
      // (so the photo matches the treatment-plan list); only simulatable areas
      // additionally get the glow above, since those are the ones we can render.
      for (const m of markers) {
        drawLabel(ctx, AREA_LABELS[m.area], m.point.x * scale, m.point.y * scale);
      }
    }

    draw();
    const ro = new ResizeObserver(() => draw());
    ro.observe(wrap);
    window.addEventListener("resize", draw);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", draw);
    };
  }, [markers, landmarks, loaded, imageWidth, imageHeight]);

  return (
    <div ref={wrapRef} className="flex justify-center">
      <canvas
        ref={canvasRef}
        className="block rounded-2xl shadow-sm"
        aria-label="Your photo with the areas we'd explore highlighted"
      />
    </div>
  );
}

function drawLabel(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
) {
  ctx.font = "600 12px ui-sans-serif, system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const padX = 9;
  const h = 21;
  const w = ctx.measureText(text).width + padX * 2;
  ctx.fillStyle = "rgba(15,15,15,0.8)";
  ctx.beginPath();
  ctx.roundRect(x - w / 2, y - h / 2, w, h, h / 2);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.fillText(text, x, y + 0.5);
}
