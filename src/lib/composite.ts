import { detectFace, KEY, type Pt } from "./landmarks";
import { paintAreaRegion } from "./face-regions";
import { loadImage } from "./image";
import type { EditableArea } from "./simulation";

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
  // 0.04 ≈ a lip gap of ~4% of the inter-eye distance — empirically about where
  // teeth start to show. A CV tuning (not a clinical value).
  return mouthOpenness(lm) > 0.04;
}

/**
 * Everything needed to paste treated regions onto the original — computed ONCE
 * per generation (the expensive face-detect + alignment), then reused for every
 * toggle. `originalLm` masks the regions; the eye-corner transform aligns the
 * generated image; both are constant once the generation is fixed.
 */
export interface CompositePrep {
  orig: HTMLImageElement;
  gen: HTMLImageElement;
  originalLm: Pt[];
  rot: number;
  scale: number;
  qR: Pt;
  pR: Pt;
  width: number;
  height: number;
}

/**
 * The expensive half: load both images, re-detect the face on the AI output to
 * align + verify it (the mouth-drift harness), and compute the eye-corner
 * transform. Run once when a generation lands; the result feeds `pasteComposite`.
 * `areasForValidation` is the full generated set (only used for the lip harness).
 */
export async function prepareComposite(
  originalDataUrl: string,
  originalLm: Pt[],
  areasForValidation: EditableArea[],
  generatedDataUrl: string,
  width: number,
  height: number,
): Promise<{ ok: boolean; reason?: string; prep?: CompositePrep }> {
  const [orig, gen] = await Promise.all([
    loadImage(originalDataUrl),
    loadImage(generatedDataUrl),
  ]);

  const det = await detectFace(gen, gen.naturalWidth, gen.naturalHeight);
  if (det.status !== "ok" || !det.landmarks) {
    return { ok: false, reason: "no face found in generated image" };
  }
  const genLm = det.landmarks;

  // Verify: if lips are edited, the mouth must not have opened/closed (the one
  // thing the composite can't fix, since the lip region IS the mouth). 0.05 ≈ a
  // 5%-of-eye-distance change in lip gap — a CV tolerance for "expression held".
  if (areasForValidation.includes("lips")) {
    const openO = mouthOpenness(originalLm);
    const openG = mouthOpenness(genLm);
    if (Math.abs(openG - openO) > 0.05) {
      return {
        ok: false,
        reason: `mouth expression drifted (${openO.toFixed(3)}→${openG.toFixed(3)})`,
      };
    }
  }

  // Eye corners are stable (outside every area we edit) → a similarity transform
  // (rotate + scale) aligning the generated image onto the original.
  const pR = genLm[KEY.eyeOuterR];
  const pL = genLm[KEY.eyeOuterL];
  const qR = originalLm[KEY.eyeOuterR];
  const qL = originalLm[KEY.eyeOuterL];
  const rot =
    Math.atan2(qL.y - qR.y, qL.x - qR.x) - Math.atan2(pL.y - pR.y, pL.x - pR.x);
  const scale = dist(qR, qL) / dist(pR, pL);

  return { ok: true, prep: { orig, gen, originalLm, rot, scale, qR, pR, width, height } };
}

/**
 * The cheap half: paste the treated regions of the (already-prepared) generation
 * onto the original. Pure canvas — no face-detect — so toggling which areas are
 * shown is instant and free. `areas` is the currently-selected subset.
 */
export function pasteComposite(
  prep: CompositePrep,
  areas: EditableArea[],
): string | null {
  const { orig, gen, originalLm, rot, scale, qR, pR, width, height } = prep;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(orig, 0, 0, width, height);

  // Union mask of the selected regions (source-over so they add, not intersect).
  const mask = document.createElement("canvas");
  mask.width = width;
  mask.height = height;
  const mctx = mask.getContext("2d");
  if (!mctx) return null;
  for (const area of areas) {
    paintAreaRegion(mctx, originalLm, area, width, height, "#fff");
  }

  // Offscreen: aligned generated image, then keep only the union of regions.
  const off = document.createElement("canvas");
  off.width = width;
  off.height = height;
  const octx = off.getContext("2d");
  if (!octx) return null;
  octx.save();
  octx.translate(qR.x, qR.y);
  octx.rotate(rot);
  octx.scale(scale, scale);
  octx.translate(-pR.x, -pR.y);
  octx.drawImage(gen, 0, 0);
  octx.restore();
  octx.globalCompositeOperation = "destination-in";
  octx.drawImage(mask, 0, 0);
  octx.globalCompositeOperation = "source-over";

  ctx.drawImage(off, 0, 0);
  return canvas.toDataURL("image/png");
}
