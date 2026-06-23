"use client";

import { useEffect, useRef, useState } from "react";
import type { Marker } from "@/lib/annotations";
import { AREA_LABELS } from "@/lib/assessment-schema";

interface Props {
  dataUrl: string;
  imageWidth: number;
  imageHeight: number;
  /** One per area to mark — a small pin + label, drawn at each point. */
  markers: Marker[];
}

/**
 * The patient's own photo with each recommended area marked by a small pin + a
 * label sitting just below it ("Jawline") — so it reads directly, no
 * number-matching and nothing obscuring the face. Sizes to its container with a
 * height cap.
 */
export function FaceCanvas({
  dataUrl,
  imageWidth,
  imageHeight,
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

      for (const m of markers) {
        drawPin(ctx, AREA_LABELS[m.area], m.point.x * scale, m.point.y * scale, accent);
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
  }, [markers, loaded, imageWidth, imageHeight]);

  return (
    <div ref={wrapRef} className="flex justify-center">
      <canvas
        ref={canvasRef}
        className="block rounded-2xl shadow-sm"
        aria-label="Your photo with the areas we'd explore marked"
      />
    </div>
  );
}

// A small accent dot at the feature point + a label just below it.
function drawPin(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  accent: string,
) {
  ctx.beginPath();
  ctx.arc(x, y, 4.5, 0, Math.PI * 2);
  ctx.fillStyle = accent;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = "rgba(255,255,255,0.95)";
  ctx.stroke();

  ctx.font = "600 12px ui-sans-serif, system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const padX = 9;
  const h = 21;
  const labelY = y + 16;
  const w = ctx.measureText(text).width + padX * 2;
  ctx.fillStyle = "rgba(15,15,15,0.8)";
  ctx.beginPath();
  ctx.roundRect(x - w / 2, labelY - h / 2, w, h, h / 2);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.fillText(text, x, labelY + 0.5);
}
