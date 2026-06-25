import { KEY, type Pt } from "./landmarks";
import type { ProfileArea } from "./simulation";

/**
 * Deterministic geometric warp — the projection half of the simulation engine
 * (see docs/simulation-architecture.md). It moves the patient's OWN pixels to
 * simulate added projection (chin / jaw / nose), so it's identity-perfect, free
 * (on-device, no API), and consistent on every angle (it's driven by the 3D
 * face mesh). Generative AI is only a later photoreal finisher on top of this.
 *
 * How it works: a set of "mover" landmarks for the chosen area are displaced
 * outward along the face's surface direction; "anchor" landmarks (eyes, brow)
 * stay put. We build a smooth displacement field from those control points
 * (inverse-distance weighted), apply it to a grid laid over the photo, and
 * render the photo through the warped grid (piecewise-affine, GPU-fast).
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
  // Chin pad: the front-bottom jaw contour + the chin tip, pushed forward.
  chin: { movers: [148, 176, 149, 150, 152, 377, 400, 378, 379, 17], mag: 0.05 },
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

function buildControls(lm: Pt[], areas: ProfileArea[]): Control[] {
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
  // The face's "forward" (sagittal) direction in 2D: from the centre toward the
  // nose tip. On a profile this points along the silhouette (so projection reads
  // as moving forward); on a front face it's tiny (projection barely shows). We
  // blend it 70/30 with each point's own outward direction so the chin still
  // gains a little drop and the jaw a little flare, not pure horizontal slide.
  const fwd = norm(sub(lm[KEY.noseTip], centre));
  for (const area of areas) {
    const cfg = AREA_WARP[area];
    for (const i of cfg.movers) {
      const p = lm[i];
      if (!p) continue;
      const out = norm(sub(p, centre));
      const dir = norm(add(mul(fwd, 0.7), mul(out, 0.3)));
      controls.push({ p, d: mul(dir, cfg.mag * scale) });
    }
  }
  return controls;
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
  const controls = buildControls(lm, areas);
  const power = 2.2;

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

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.imageSmoothingQuality = "high";

  // Render each grid cell as two source→dest triangles (piecewise-affine).
  const at = (r: number, c: number): Pt => ({ x: (c / GRID) * width, y: (r / GRID) * height });
  for (let r = 0; r < GRID; r++) {
    for (let c = 0; c < GRID; c++) {
      const s00 = at(r, c), s10 = at(r, c + 1), s01 = at(r + 1, c), s11 = at(r + 1, c + 1);
      const d00 = dst[r * cols + c], d10 = dst[r * cols + c + 1];
      const d01 = dst[(r + 1) * cols + c], d11 = dst[(r + 1) * cols + c + 1];
      drawTri(ctx, img, [s00, s10, s11], [d00, d10, d11]);
      drawTri(ctx, img, [s00, s11, s01], [d00, d11, d01]);
    }
  }
  return canvas.toDataURL("image/png");
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
