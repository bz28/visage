import { detectFace, type Pt } from "./landmarks";
import { computeMeasurements } from "./measurements";
import { mouthOpenness } from "./composite";
import type { ViewKey } from "./views";

/**
 * On-device photo quality check, run at capture time (free — no API) so we catch
 * a bad shot BEFORE paying for the AI read, and guide the patient to fix it.
 *
 * Hard status (`no-face`/`multiple-faces`) means the read literally can't run.
 * Soft `warnings` are skippable nudges — we never dead-end a lead-gen flow.
 */
export type PhotoStatus = "ok" | "no-face" | "multiple-faces";
export type PhotoWarning =
  | "tilted"
  | "too-small"
  | "off-center"
  | "mouth-open"
  | "blurry"
  | "dark"
  | "bright";

export interface PhotoCheck {
  status: PhotoStatus;
  warnings: PhotoWarning[];
}

// Thresholds. NOTE: TILT_MAX is a CLINICAL assumption — how much head-turn still
// allows a reliable frontal read — and is flagged for the surgeon to verify (see
// docs/surgeon-calibration.md). MIN_FACE_FRACTION / MAX_OFFCENTER are technical
// framing limits (enough pixels + roughly centered), tuned by eye.
const TILT_MAX = 0.18; // frontalTilt above this reads as too turned (0 = straight-on)
const MIN_FACE_FRACTION = 0.34; // face should span ≥ this fraction of the image width
const MAX_OFFCENTER = 0.2; // face centre within this fraction of the image centre
// An open mouth makes the lip preview fail the expression guard (it can't add
// volume without re-drawing the mouth). 0.055 = clearly parted, between a relaxed
// mouth (~0.02) and the openness that reliably fails (~0.077). CV tuning.
const MOUTH_OPEN_WARN = 0.055;
// Technical image-quality limits, tuned by eye on a 192px-wide downscale.
const BLUR_MIN_VARIANCE = 12; // Laplacian variance below this = soft/out of focus
const DARK_MAX = 45; // mean luminance (0–255) below this = underexposed
const BRIGHT_MIN = 215; // above this = blown out

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/**
 * Tilt/framing warnings apply ONLY to the front photo — a profile/angle shot is
 * meant to be turned, so flagging it as "tilted" would be wrong. Side/angle get
 * a face-present check only.
 */
export async function checkPhoto(
  dataUrl: string,
  view: ViewKey,
): Promise<PhotoCheck> {
  let img: HTMLImageElement;
  try {
    img = await loadImage(dataUrl);
  } catch {
    return { status: "ok", warnings: [] }; // can't even load it — let it through
  }

  const w = img.naturalWidth;
  const h = img.naturalHeight;

  let result;
  try {
    result = await detectFace(img, w, h);
  } catch {
    // MediaPipe failed to load/run — never block on our own infra; accept and
    // let the later analyze step handle any real problem.
    return { status: "ok", warnings: [] };
  }

  if (result.status !== "ok" || !result.landmarks) {
    return { status: result.status, warnings: [] };
  }

  const warnings: PhotoWarning[] = [];

  // Blur / exposure apply to any view — a soft or badly-lit shot wastes the AI
  // call and disappoints regardless of angle.
  const px = analyzePixels(img);
  if (px.variance < BLUR_MIN_VARIANCE) warnings.push("blurry");
  if (px.luminance < DARK_MAX) warnings.push("dark");
  else if (px.luminance > BRIGHT_MIN) warnings.push("bright");

  if (view === "front") {
    const lm = result.landmarks;
    // Open mouth → the lip preview will likely fail the expression guard.
    if (mouthOpenness(lm) > MOUTH_OPEN_WARN) warnings.push("mouth-open");
    if (computeMeasurements(lm).frontalTilt > TILT_MAX) warnings.push("tilted");

    const box = faceBox(lm);
    if ((box.maxX - box.minX) / w < MIN_FACE_FRACTION) warnings.push("too-small");

    const cx = (box.minX + box.maxX) / 2 / w;
    const cy = (box.minY + box.maxY) / 2 / h;
    if (Math.abs(cx - 0.5) > MAX_OFFCENTER || Math.abs(cy - 0.5) > MAX_OFFCENTER) {
      warnings.push("off-center");
    }
  }

  return { status: "ok", warnings };
}

/**
 * One downscaled pass for blur + exposure. Sharpness = variance of the Laplacian
 * (a standard focus measure — a sharp image has lots of high-frequency edges, so
 * high variance; a blurry one is smooth, so low). Exposure = mean luminance.
 */
function analyzePixels(img: HTMLImageElement): {
  variance: number;
  luminance: number;
} {
  const w = 192;
  const h = Math.max(1, Math.round((img.naturalHeight / img.naturalWidth) * w));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return { variance: Infinity, luminance: 128 }; // can't analyze → don't warn
  ctx.drawImage(img, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h).data;

  const gray = new Float64Array(w * h);
  let lumSum = 0;
  for (let i = 0; i < w * h; i++) {
    const g =
      0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2];
    gray[i] = g;
    lumSum += g;
  }

  let lapSum = 0;
  let lapSqSum = 0;
  let n = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const lap =
        4 * gray[i] - gray[i - 1] - gray[i + 1] - gray[i - w] - gray[i + w];
      lapSum += lap;
      lapSqSum += lap * lap;
      n++;
    }
  }
  const mean = n ? lapSum / n : 0;
  const variance = n ? lapSqSum / n - mean * mean : Infinity;
  return { variance, luminance: lumSum / (w * h) };
}

function faceBox(lm: Pt[]) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of lm) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX, minY, maxX, maxY };
}

/** One friendly, education-register sentence for the soft warnings present.
 *  Ordered by impact — the mouth/quality issues cost the most if ignored. */
export function warningMessage(warnings: PhotoWarning[]): string {
  if (warnings.includes("mouth-open")) {
    return "Relax your mouth — closed, no teeth — for the truest lip preview.";
  }
  if (warnings.includes("blurry")) {
    return "That shot looks a little soft — hold steady for a sharper photo.";
  }
  if (warnings.includes("dark")) {
    return "It's a bit dark — even, front-on light gives a clearer read.";
  }
  if (warnings.includes("bright")) {
    return "That's a little bright — softer light keeps more detail.";
  }
  if (warnings.includes("tilted")) {
    return "Looks a little turned — a straight-on shot gives a clearer read.";
  }
  if (warnings.includes("too-small")) {
    return "Try getting a bit closer so your face fills more of the frame.";
  }
  if (warnings.includes("off-center")) {
    return "Center your face in the frame for a clearer read.";
  }
  return "";
}
