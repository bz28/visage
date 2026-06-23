import { detectFace, type Pt } from "./landmarks";
import { computeMeasurements } from "./measurements";
import type { ViewKey } from "./views";

/**
 * On-device photo quality check, run at capture time (free — no API) so we catch
 * a bad shot BEFORE paying for the AI read, and guide the patient to fix it.
 *
 * Hard status (`no-face`/`multiple-faces`) means the read literally can't run.
 * Soft `warnings` are skippable nudges — we never dead-end a lead-gen flow.
 */
export type PhotoStatus = "ok" | "no-face" | "multiple-faces";
export type PhotoWarning = "tilted" | "too-small" | "off-center";

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
  if (view === "front") {
    const lm = result.landmarks;
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

/** One friendly, education-register sentence for the soft warnings present. */
export function warningMessage(warnings: PhotoWarning[]): string {
  if (warnings.includes("tilted")) {
    return "Looks a little turned — a straight-on shot gives a surer read.";
  }
  if (warnings.includes("too-small")) {
    return "Try getting a bit closer so your face fills more of the frame.";
  }
  if (warnings.includes("off-center")) {
    return "Center your face in the frame for a surer read.";
  }
  return "";
}
