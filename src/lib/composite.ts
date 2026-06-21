import { detectFace, KEY, REGIONS, type Pt } from "./landmarks";
import type { SimulatableArea } from "./simulation";

/**
 * Lock identity by force: take the AI-generated edit but keep ONLY the treated
 * region, composited back onto the patient's original photo. Everything outside
 * the region (eyes, skin, expression, background) stays the original pixels — so
 * the model can't drift them no matter what its prompt-following is like.
 *
 * Also a safety harness: we re-detect the face on the AI output and reject it if
 * the mouth opened/closed (expression drift) or no face was found, so the caller
 * can retry. This is what makes "only the lips change" a guarantee, not a hope.
 */

export interface CompositeResult {
  ok: boolean;
  dataUrl?: string;
  reason?: string;
}

const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);

/**
 * How open the mouth is — inner-lip gap normalized by eye distance (so it's
 * scale-invariant). ~0 = lips together; higher = open / teeth showing.
 */
export function mouthOpenness(lm: Pt[]): number {
  const io = dist(lm[KEY.eyeOuterR], lm[KEY.eyeOuterL]);
  if (!io) return 0;
  return dist(lm[KEY.stomionUpper], lm[KEY.stomionLower]) / io;
}

/** Is the mouth open / teeth likely showing in this face? */
export function isMouthOpen(lm: Pt[]): boolean {
  return mouthOpenness(lm) > 0.04;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/** Trace the feathered region we keep from the generated image, per area. */
function clipRegion(
  ctx: CanvasRenderingContext2D,
  lm: Pt[],
  area: SimulatableArea,
  w: number,
  h: number,
) {
  const dilate = Math.max(6, Math.hypot(w, h) * 0.012);
  ctx.fillStyle = "#fff";
  ctx.strokeStyle = "#fff";
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.lineWidth = dilate * 2;
  ctx.filter = `blur(${dilate * 0.6}px)`;

  const poly = (idx: readonly number[]) => {
    const pts = idx.map((i) => lm[i]).filter(Boolean);
    if (pts.length < 3) return;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  };

  switch (area) {
    case "lips":
      poly(REGIONS.outerLip);
      break;
    case "cheeks":
      poly(REGIONS.leftCheek);
      poly(REGIONS.rightCheek);
      break;
    case "jawline": {
      const pts = REGIONS.jawline.map((i) => lm[i]).filter(Boolean);
      if (pts.length >= 3) {
        ctx.lineWidth = dilate * 3.5;
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
        ctx.stroke();
      }
      break;
    }
    case "chin": {
      const lip = lm[KEY.lowerLipBottom];
      const menton = lm[KEY.menton];
      if (lip && menton) {
        const cx = (lip.x + menton.x) / 2;
        const cy = (lip.y + menton.y) / 2 + (menton.y - lip.y) * 0.25;
        const ry = Math.abs(menton.y - lip.y) * 0.9;
        ctx.beginPath();
        ctx.ellipse(cx, cy, ry * 0.9, ry, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
  }
  ctx.filter = "none";
}

export async function compositeArea(
  originalDataUrl: string,
  originalLm: Pt[],
  area: SimulatableArea,
  generatedDataUrl: string,
  width: number,
  height: number,
): Promise<CompositeResult> {
  const [orig, gen] = await Promise.all([
    loadImage(originalDataUrl),
    loadImage(generatedDataUrl),
  ]);

  // Re-detect the face on the AI output so we can align + verify it.
  const det = await detectFace(gen, gen.naturalWidth, gen.naturalHeight);
  if (det.status !== "ok" || !det.landmarks) {
    return { ok: false, reason: "no face found in generated image" };
  }
  const genLm = det.landmarks;

  // Verify: for lip edits, the mouth must not have opened/closed (the one thing
  // the composite can't fix, since the lip region IS the mouth).
  if (area === "lips") {
    const openO = mouthOpenness(originalLm);
    const openG = mouthOpenness(genLm);
    if (Math.abs(openG - openO) > 0.05) {
      return {
        ok: false,
        reason: `mouth expression drifted (${openO.toFixed(3)}→${openG.toFixed(3)})`,
      };
    }
  }

  // Align the generated image onto the original using the eye corners (stable —
  // outside every area we edit), as a similarity transform (rotate + scale).
  const pR = genLm[KEY.eyeOuterR];
  const pL = genLm[KEY.eyeOuterL];
  const qR = originalLm[KEY.eyeOuterR];
  const qL = originalLm[KEY.eyeOuterL];
  const rot =
    Math.atan2(qL.y - qR.y, qL.x - qR.x) - Math.atan2(pL.y - pR.y, pL.x - pR.x);
  const scale = dist(qR, qL) / dist(pR, pL);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return { ok: false, reason: "no canvas context" };
  ctx.drawImage(orig, 0, 0, width, height);

  // Offscreen: aligned generated image, then keep only the feathered region.
  const off = document.createElement("canvas");
  off.width = width;
  off.height = height;
  const octx = off.getContext("2d");
  if (!octx) return { ok: false, reason: "no canvas context" };
  octx.save();
  octx.translate(qR.x, qR.y);
  octx.rotate(rot);
  octx.scale(scale, scale);
  octx.translate(-pR.x, -pR.y);
  octx.drawImage(gen, 0, 0);
  octx.restore();
  octx.globalCompositeOperation = "destination-in";
  clipRegion(octx, originalLm, area, width, height);
  octx.globalCompositeOperation = "source-over";

  ctx.drawImage(off, 0, 0);
  return { ok: true, dataUrl: canvas.toDataURL("image/png") };
}
