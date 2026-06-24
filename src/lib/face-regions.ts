import { KEY, REGIONS, type Pt } from "./landmarks";
import type { SimulatableArea } from "./simulation";

/**
 * Paint an area's region onto a canvas as a soft, feathered shape — used to build
 * the composite mask (filled white) that decides which pixels of the AI edit to
 * keep. The caller sets the colour + globalAlpha; this owns the geometry +
 * feathering.
 */
export function paintAreaRegion(
  ctx: CanvasRenderingContext2D,
  lm: Pt[],
  area: SimulatableArea,
  w: number,
  h: number,
  color: string,
) {
  const dilate = Math.max(6, Math.hypot(w, h) * 0.012);
  ctx.save();
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
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
      // Open contour — a thick feathered band along the jaw.
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
      // No clean chin contour — approximate the chin pad as an ellipse between
      // the lower lip and the menton (lowest chin point).
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
    case "nasolabial": {
      // A feathered band along each fold: nostril edge → mouth corner.
      ctx.lineWidth = dilate * 3;
      band(ctx, lm[KEY.alarR], lm[KEY.mouthCornerR]);
      band(ctx, lm[KEY.alarL], lm[KEY.mouthCornerL]);
      break;
    }
    case "marionette": {
      // A band from each mouth corner angled down toward the chin.
      const menton = lm[KEY.menton];
      ctx.lineWidth = dilate * 3;
      for (const corner of [lm[KEY.mouthCornerR], lm[KEY.mouthCornerL]]) {
        if (corner && menton) band(ctx, corner, lerp(corner, menton, 0.6));
      }
      break;
    }
  }
  ctx.restore();
}

const lerp = (a: Pt, b: Pt, t: number): Pt => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
});

// Stroke a single feathered segment a→b (caller has set lineWidth + blur).
function band(ctx: CanvasRenderingContext2D, a?: Pt, b?: Pt) {
  if (!a || !b) return;
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
}
