/**
 * Deterministic facial measurements from landmarks.
 *
 * These encode the classical aesthetic canons an injector eyeballs during a
 * consult — facial thirds, the lip ratio, lower-face balance, jaw-to-cheek
 * width, and symmetry. Everything here is objective geometry: same photo →
 * same numbers, computed on-device, no AI. The AI layer reasons *from* these.
 *
 * Caveat we keep honest: true chin/jaw *projection* is a profile metric. From a
 * single frontal photo we can only judge proportion and width, so the baseline
 * flags chin projection as "best confirmed in profile/consult."
 */
import { KEY, type Pt } from "./landmarks";
import type { Measurements } from "./measurements-schema";

const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);
const vdist = (a: Pt, b: Pt) => Math.abs(a.y - b.y); // vertical only
/** How far off two values are, as a fraction of their average. */
const rel = (a: Pt, b: Pt, mid: Pt) =>
  Math.abs(dist(a, mid) - dist(b, mid)) /
  ((dist(a, mid) + dist(b, mid)) / 2 || 1);

export type { Measurements } from "./measurements-schema";

export function computeMeasurements(lm: Pt[]): Measurements {
  const p = (i: number) => lm[i];

  // --- Facial thirds (vertical) ---
  const total = vdist(p(KEY.trichion), p(KEY.menton)) || 1;
  const upper = vdist(p(KEY.trichion), p(KEY.glabella)) / total;
  const middle = vdist(p(KEY.glabella), p(KEY.subnasale)) / total;
  const lower = vdist(p(KEY.subnasale), p(KEY.menton)) / total;

  // --- Lips ---
  const upperLipH = vdist(p(KEY.upperLipTop), p(KEY.stomionUpper)) || 1;
  const lowerLipH = vdist(p(KEY.stomionLower), p(KEY.lowerLipBottom));
  const lipRatio = lowerLipH / upperLipH;

  // Lower-face vertical proportion: nose-base→mouth vs mouth→chin. CANDIDATE
  // metric — computed but not yet used in the read; pending surgeon input on
  // whether lower-face proportion is worth flagging and its ideal (docs §1).
  const stomionY = (p(KEY.stomionUpper).y + p(KEY.stomionLower).y) / 2;
  const snToMouth = Math.abs(stomionY - p(KEY.subnasale).y) || 1;
  const mouthToChin = Math.abs(p(KEY.menton).y - stomionY);
  const lowerFaceRatio = snToMouth / (mouthToChin || 1);

  // --- Jaw vs cheek width ---
  const cheekW = dist(p(KEY.zygionR), p(KEY.zygionL)) || 1;
  const jawW = dist(p(KEY.gonionR), p(KEY.gonionL));
  const jawToCheek = jawW / cheekW;

  // --- Symmetry: compare left/right offsets from the facial midline ---
  const midline = p(KEY.nasion);
  const asymmetry =
    (rel(p(KEY.mouthCornerR), p(KEY.mouthCornerL), midline) +
      rel(p(KEY.eyeOuterR), p(KEY.eyeOuterL), midline) +
      rel(p(KEY.gonionR), p(KEY.gonionL), midline)) /
    3;

  // --- Scale: average interpupillary distance is ~63mm ---
  const ipdPx = dist(p(KEY.irisR), p(KEY.irisL)) || 1;
  const mmPerPx = 63 / ipdPx;

  // --- Frontal tilt (head yaw): nose-to-cheek width should match L/R when straight-on ---
  const rightHalf = Math.abs(midline.x - p(KEY.zygionR).x);
  const leftHalf = Math.abs(p(KEY.zygionL).x - midline.x);
  const frontalTilt =
    Math.abs(rightHalf - leftHalf) / ((rightHalf + leftHalf) / 2 || 1);

  return {
    thirds: { upper, middle, lower },
    lowerThird:
      lower > 0.36 ? "long" : lower < 0.3 ? "short" : "balanced",
    lipRatio,
    // Ideal lower:upper ≈ 1.6. Below ~1.3 reads thin; above ~2.0 bottom-heavy.
    lipVerdict: lipRatio < 1.3 ? "short" : lipRatio > 2.0 ? "long" : "balanced",
    lowerFaceRatio,
    jawToCheek,
    jawVerdict:
      jawToCheek < 0.68 ? "narrow" : jawToCheek > 0.8 ? "wide" : "balanced",
    asymmetry,
    mmPerPx,
    frontalTilt,
  };
}
