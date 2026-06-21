import { KEY, REGIONS, type Pt } from "./landmarks";
import type { SimulatableArea } from "./simulation";

/**
 * Build a black/white inpaint mask (white = the only region the model may
 * repaint) for one area, as a PNG data URL sized to the source image. This is
 * what keeps the simulation identity-safe: everything outside the white region
 * stays the patient's exact original pixels.
 *
 * The mask is feathered + slightly dilated so the filler blends at the edge and
 * the model has a little room around the region to work.
 */
export function buildAreaMask(
  lm: Pt[],
  area: SimulatableArea,
  width: number,
  height: number,
): string {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas.toDataURL("image/png");

  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, width, height);

  const dilate = Math.max(6, Math.hypot(width, height) * 0.012);
  ctx.fillStyle = "#fff";
  ctx.strokeStyle = "#fff";
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.lineWidth = dilate * 2; // expand the region outward
  ctx.filter = `blur(${dilate * 0.5}px)`; // soft, feathered edge

  const fillPoly = (idx: readonly number[]) => {
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
      fillPoly(REGIONS.outerLip);
      break;
    case "cheeks":
      fillPoly(REGIONS.leftCheek);
      fillPoly(REGIONS.rightCheek);
      break;
    case "chin": {
      // No clean chin contour in the landmark set — approximate the chin pad as
      // an ellipse between the lower lip and the menton (lowest chin point).
      const lip = lm[KEY.lowerLipBottom];
      const menton = lm[KEY.menton];
      if (lip && menton) {
        const cx = (lip.x + menton.x) / 2;
        const cy = (lip.y + menton.y) / 2 + (menton.y - lip.y) * 0.25;
        const ry = Math.abs(menton.y - lip.y) * 0.9;
        const rx = ry * 0.9;
        ctx.beginPath();
        ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
      break;
    }
    case "jawline": {
      // The jaw is an open contour (gonion → menton → gonion), not a region —
      // stroke it as a thick band along the edge, where filler defines the angle.
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
  }

  ctx.filter = "none";
  return canvas.toDataURL("image/png");
}
