import { KEY, REGIONS, type Pt } from "./landmarks";
import type { ProfileArea } from "./simulation";

/**
 * Deterministic geometric warp — the projection half of the simulation engine
 * (see docs/simulation-architecture.md). It moves the patient's OWN pixels to
 * simulate added projection (chin / jaw / nose), so it's identity-perfect and
 * free (on-device, no API).
 *
 * Today the displacement direction is computed in 2D (a "forward" axis from the
 * face centre to the nose tip), which works because the warp runs on the actual
 * photo at its actual angle. The landmark depth (z) is captured but not yet used
 * — it's the foundation for a true 3D-surface direction later.
 *
 * How it works: a set of "mover" landmarks for the chosen area are displaced
 * forward; "anchor" landmarks (eyes, brow, cheekbones) stay put. We build a
 * smooth displacement field from those control points (inverse-distance
 * weighted), apply it to a grid laid over the photo, render through the warped
 * grid (piecewise-affine, GPU-fast), then paste only the projection region back
 * onto the untouched original so everything else stays exact.
 *
 * All magnitudes here are CLINICAL PLACEHOLDERS — they get calibrated to real
 * millimetres from the surgeon's before/after photos (surgeon-calibration.md).
 */

// ---- tiny vector helpers ----
const sub = (a: Pt, b: Pt): Pt => ({ x: a.x - b.x, y: a.y - b.y });
const add = (a: Pt, b: Pt): Pt => ({ x: a.x + b.x, y: a.y + b.y });
const mul = (a: Pt, k: number): Pt => ({ x: a.x * k, y: a.y * k });
const len = (a: Pt) => Math.hypot(a.x, a.y);
const norm = (a: Pt): Pt => {
  const l = len(a) || 1;
  return { x: a.x / l, y: a.y / l };
};

/**
 * Per-area projection config. `movers` are the landmark indices that get pushed
 * outward; `mag` is the placeholder magnitude as a fraction of FACE HEIGHT
 * (glabella→menton — stable at any angle, unlike inter-ocular distance which
 * foreshortens on a profile). Direction is each mover's outward direction from
 * the face centre (so on a profile it reads as "forward", on the front as a
 * subtle lengthening — projection genuinely barely shows head-on).
 *
 * CLINICAL PLACEHOLDERS — these fractions are my best-judgement defaults, to be
 * calibrated to real millimetres from the surgeon's before/after photos. See
 * docs/surgeon-calibration.md (warp section).
 */
const AREA_WARP: Record<ProfileArea, { movers: number[]; mag: number }> = {
  // Chin pad: the symmetric front-bottom chin/jaw contour + the chin tip
  // (KEY.menton = 152), pushed forward. Deliberately NO lip points — a chin
  // treatment must not drag the lower lip (index 17 = KEY.lowerLipBottom was
  // removed: it broke the L/R symmetry and pulled the lip forward with the chin).
  chin: { movers: [148, 176, 149, 150, KEY.menton, 377, 400, 378, 379], mag: 0.05 },
  // Jaw angle + sides, pushed out to define the angle.
  jawline: { movers: [KEY.gonionR, KEY.gonionL, 136, 150, 365, 379, 172, 397], mag: 0.038 },
  // Dorsum + tip — most sensitive area, keep it the gentlest.
  nose: { movers: [KEY.noseTip, KEY.subnasale, 195, 5, 4, 51, 281], mag: 0.022 },
};

// Landmarks held fixed so the warp stays local to the treated region: eyes,
// brow, forehead, cheekbones. Without these the whole face would drift.
const ANCHORS = [
  KEY.eyeOuterR, KEY.eyeOuterL, KEY.eyeInnerR, KEY.eyeInnerL,
  KEY.trichion, KEY.glabella, KEY.nasion, KEY.zygionR, KEY.zygionL,
  127, 356, 234, 454,
];

/** A control point: where it is, and how far it moves (0 for anchors). */
interface Control {
  p: Pt;
  d: Pt;
}

function buildControls(
  lm: Pt[],
  areas: ProfileArea[],
): { controls: Control[]; movers: Control[]; scale: number } {
  // Face centre = mean of the stable anchors; "outward" = away from it.
  const stable = ANCHORS.map((i) => lm[i]).filter(Boolean);
  const centre = mul(
    stable.reduce((acc, p) => add(acc, p), { x: 0, y: 0 }),
    1 / Math.max(1, stable.length),
  );
  // Face height (glabella→menton) is stable at any angle; inter-ocular distance
  // foreshortens on a profile, which would collapse the magnitude to nothing.
  const scale = len(sub(lm[KEY.glabella], lm[KEY.menton])) || 200;

  const controls: Control[] = [];
  // Anchors first (zero displacement) so the field decays to "no change".
  for (const i of ANCHORS) {
    if (lm[i]) controls.push({ p: lm[i], d: { x: 0, y: 0 } });
  }
  // Angle-aware direction. `turn` ≈ how far the head is turned (0 = head-on,
  // 1 = full profile), from how far the nose tip sits off the face midline.
  // - On a PROFILE we push along the sagittal "forward" axis (toward the nose
  //   tip) — the chin/jaw/nose project forward along the silhouette.
  // - On a FRONT we push each point OUTWARD from the centre — a sharper jawline
  //   and a more defined chin read laterally, which is what shows head-on.
  // We lerp between them by `turn`, so the same engine is correct at any angle.
  const fwd = norm(sub(lm[KEY.noseTip], centre));
  const turn = Math.min(1, Math.abs(lm[KEY.noseTip].x - centre.x) / (scale * 0.5));
  const movers: Control[] = [];
  for (const area of areas) {
    const cfg = AREA_WARP[area];
    for (const i of cfg.movers) {
      const p = lm[i];
      if (!p) continue;
      const out = norm(sub(p, centre));
      const dir = norm(add(mul(fwd, turn), mul(out, 1 - turn)));
      const c = { p, d: mul(dir, cfg.mag * scale) };
      controls.push(c);
      movers.push(c);
    }
  }
  return { controls, movers, scale };
}

/**
 * A feathered mask over just the projection region (the movers + where they
 * project to), so we paste the warp back onto the ORIGINAL photo and leave
 * everything else pixel-for-pixel untouched — true identity lock, no global
 * resample of eyes/hair/background.
 */
function regionMask(
  movers: Control[],
  scale: number,
  width: number,
  height: number,
  rFactor: number,
  bFactor: number,
): HTMLCanvasElement {
  const mask = document.createElement("canvas");
  mask.width = width;
  mask.height = height;
  const ctx = mask.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.filter = `blur(${scale * bFactor}px)`;
  const r = scale * rFactor;
  for (const m of movers) {
    // cover both the original point and where it projects to
    ctx.beginPath();
    ctx.arc(m.p.x, m.p.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(m.p.x + m.d.x, m.p.y + m.d.y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  return mask;
}

/** Inverse-distance-weighted displacement at an arbitrary point. */
function fieldAt(q: Pt, controls: Control[], power: number): Pt {
  let wsum = 0;
  let dx = 0;
  let dy = 0;
  for (const c of controls) {
    const ex = q.x - c.p.x;
    const ey = q.y - c.p.y;
    const d2 = ex * ex + ey * ey + 1;
    const w = 1 / Math.pow(d2, power / 2);
    wsum += w;
    dx += w * c.d.x;
    dy += w * c.d.y;
  }
  return wsum ? { x: dx / wsum, y: dy / wsum } : { x: 0, y: 0 };
}

/** The 2×3 affine that maps source triangle s→ destination triangle d. */
function affine(s: [Pt, Pt, Pt], d: [Pt, Pt, Pt]) {
  const x1 = s[0].x, y1 = s[0].y, x2 = s[1].x, y2 = s[1].y, x3 = s[2].x, y3 = s[2].y;
  const det = x1 * (y2 - y3) + x2 * (y3 - y1) + x3 * (y1 - y2) || 1e-6;
  const a = (d[0].x * (y2 - y3) + d[1].x * (y3 - y1) + d[2].x * (y1 - y2)) / det;
  const b = (d[0].y * (y2 - y3) + d[1].y * (y3 - y1) + d[2].y * (y1 - y2)) / det;
  const c = (d[0].x * (x3 - x2) + d[1].x * (x1 - x3) + d[2].x * (x2 - x1)) / det;
  const dd = (d[0].y * (x3 - x2) + d[1].y * (x1 - x3) + d[2].y * (x2 - x1)) / det;
  const e =
    (d[0].x * (x2 * y3 - x3 * y2) + d[1].x * (x3 * y1 - x1 * y3) + d[2].x * (x1 * y2 - x2 * y1)) /
    det;
  const f =
    (d[0].y * (x2 * y3 - x3 * y2) + d[1].y * (x3 * y1 - x1 * y3) + d[2].y * (x1 * y2 - x2 * y1)) /
    det;
  return { a, b, c, dd, e, f };
}

const GRID = 40; // warp grid resolution (cells per axis)

/**
 * Warp the patient's photo to project the chosen areas. Returns a PNG data URL,
 * or null if it can't run. Pure geometry — the patient's own pixels, moved.
 */
export function warpAreas(
  img: HTMLImageElement,
  lm: Pt[],
  areas: ProfileArea[],
  width: number,
  height: number,
): string | null {
  if (areas.length === 0) return null;
  // Fail closed if the landmarks buildControls dereferences are missing (sparse
  // detection) — return null so the caller keeps the untouched original, rather
  // than throwing. Mirrors warpLips's guard.
  if (!lm[KEY.glabella] || !lm[KEY.menton] || !lm[KEY.noseTip]) return null;
  const { controls, movers, scale } = buildControls(lm, areas);
  return renderWarp(img, controls, movers, scale, width, height);
}

// Lip-fullness warp. Filler adds height + a little eversion — the vermillion
// border rolls outward, the lips read fuller — WITHOUT widening the mouth. So we
// ANCHOR the mouth corners (and the face around the mouth) and push the rest of
// the lip border radially outward from the mouth centre; the anchored corners
// taper the sides to ~0 so the mouth keeps its width.
//
// LIP_MAG is a CLINICAL PLACEHOLDER (fraction of lip height) — my best-judgement
// default for a natural ~1-syringe result, pending surgeon calibration (see
// docs/surgeon-calibration.md, lips).
const LIP_MAG = 0.22;
const LIP_MOVERS = REGIONS.outerLip.filter(
  (i) => i !== KEY.mouthCornerR && i !== KEY.mouthCornerL,
);
const LIP_ANCHORS = [
  KEY.mouthCornerR, KEY.mouthCornerL, KEY.subnasale, KEY.noseTip,
  KEY.alarR, KEY.alarL, KEY.menton, KEY.gonionR, KEY.gonionL,
  KEY.eyeOuterR, KEY.eyeOuterL,
];

function buildLipControls(lm: Pt[]): {
  controls: Control[];
  movers: Control[];
  scale: number;
} {
  const lipPts = REGIONS.outerLip.map((i) => lm[i]).filter(Boolean);
  const centre = mul(
    lipPts.reduce((a, p) => add(a, p), { x: 0, y: 0 }),
    1 / Math.max(1, lipPts.length),
  );
  // Lip height (cupid's bow → lower-lip bottom) scales the displacement + mask.
  const scale = len(sub(lm[KEY.upperLipTop], lm[KEY.lowerLipBottom])) || 30;
  const controls: Control[] = [];
  for (const i of LIP_ANCHORS) {
    if (lm[i]) controls.push({ p: lm[i], d: { x: 0, y: 0 } });
  }
  const movers: Control[] = [];
  for (const i of LIP_MOVERS) {
    const p = lm[i];
    if (!p) continue;
    // Radially outward from the mouth centre — upper border up, lower down.
    const dir = norm(sub(p, centre));
    const c = { p, d: mul(dir, LIP_MAG * scale) };
    controls.push(c);
    movers.push(c);
  }
  return { controls, movers, scale };
}

/**
 * Warp the lips fuller (identity-locked, on-device, no API). The geometric
 * "reshape" half of a lip simulation — the patient's own lips, made fuller.
 * Returns a PNG data URL, or null if the lips can't be located.
 */
export function warpLips(
  img: HTMLImageElement,
  lm: Pt[],
  width: number,
  height: number,
): string | null {
  if (!lm[KEY.upperLipTop] || !lm[KEY.lowerLipBottom]) return null;
  const { controls, movers, scale } = buildLipControls(lm);
  // Higher IDW power + a wider mask (relative to the small lip scale) so the
  // eversion stays tight to the lips but the paste region still covers them.
  return renderWarp(img, controls, movers, scale, width, height, 2.6, 1.1, 0.45);
}

/**
 * The shared warp render: build a smooth IDW displacement field from the control
 * points, push the photo through a piecewise-affine grid, then paste only the
 * moved region (feathered around the movers) back onto the ORIGINAL — so
 * everything outside is the patient's exact pixels. Used by both the projection
 * warp (chin/jaw/nose) and the lip warp.
 */
function renderWarp(
  img: HTMLImageElement,
  controls: Control[],
  movers: Control[],
  scale: number,
  width: number,
  height: number,
  power = 2.2,
  maskR = 0.13,
  maskB = 0.06,
): string | null {
  // Displacement at each grid vertex (the expensive IDW only runs here).
  const cols = GRID + 1;
  const dst: Pt[] = new Array(cols * cols);
  for (let r = 0; r <= GRID; r++) {
    for (let c = 0; c <= GRID; c++) {
      const sx = (c / GRID) * width;
      const sy = (r / GRID) * height;
      const d = fieldAt({ x: sx, y: sy }, controls, power);
      dst[r * cols + c] = { x: sx + d.x, y: sy + d.y };
    }
  }

  // The warped image (whole frame goes through the piecewise-affine grid).
  const warped = document.createElement("canvas");
  warped.width = width;
  warped.height = height;
  const wctx = warped.getContext("2d");
  if (!wctx) return null;
  wctx.imageSmoothingQuality = "high";
  const at = (r: number, c: number): Pt => ({ x: (c / GRID) * width, y: (r / GRID) * height });
  for (let r = 0; r < GRID; r++) {
    for (let c = 0; c < GRID; c++) {
      const s00 = at(r, c), s10 = at(r, c + 1), s01 = at(r + 1, c), s11 = at(r + 1, c + 1);
      const d00 = dst[r * cols + c], d10 = dst[r * cols + c + 1];
      const d01 = dst[(r + 1) * cols + c], d11 = dst[(r + 1) * cols + c + 1];
      drawTri(wctx, img, [s00, s10, s11], [d00, d10, d11]);
      drawTri(wctx, img, [s00, s11, s01], [d00, d11, d01]);
    }
  }

  // Identity lock: keep the warp only over the moved region, paste it onto the
  // ORIGINAL photo. Everything outside the feathered mask is the patient's exact
  // original pixels — no global resample of eyes/hair/background.
  // Keep only warped ∩ mask, reusing the already-validated wctx (getContext on
  // the same canvas returns the same context).
  const mask = regionMask(movers, scale, width, height, maskR, maskB);
  wctx.globalCompositeOperation = "destination-in";
  wctx.drawImage(mask, 0, 0);
  wctx.globalCompositeOperation = "source-over";

  const out = document.createElement("canvas");
  out.width = width;
  out.height = height;
  const octx = out.getContext("2d");
  if (!octx) return null;
  octx.drawImage(img, 0, 0, width, height); // original
  octx.drawImage(warped, 0, 0); // warped region on top
  return out.toDataURL("image/png");
}

function drawTri(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  s: [Pt, Pt, Pt],
  d: [Pt, Pt, Pt],
) {
  ctx.save();
  // Clip to the destination triangle, inset by ~0.5px so neighbouring triangles
  // overlap slightly and don't leave seams.
  ctx.beginPath();
  ctx.moveTo(d[0].x, d[0].y);
  ctx.lineTo(d[1].x, d[1].y);
  ctx.lineTo(d[2].x, d[2].y);
  ctx.closePath();
  ctx.clip();
  const m = affine(s, d);
  ctx.setTransform(m.a, m.b, m.c, m.dd, m.e, m.f);
  ctx.drawImage(img, 0, 0);
  ctx.restore();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}
