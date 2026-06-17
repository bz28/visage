/**
 * Maps an assessment area to a marker point on the user's own photo, computed
 * from their landmarks. We annotate the real face — we never fabricate an
 * "after" image (see CLAUDE.md / the v1 framing).
 */
import { KEY, REGIONS, type Pt } from "./landmarks";
import type { AssessmentArea } from "./assessment-schema";

export interface Marker {
  area: AssessmentArea["area"];
  /** Pixel position to drop the marker, in source-image coordinates. */
  point: Pt;
}

const centroid = (lm: Pt[], idx: readonly number[]): Pt => {
  const pts = idx.map((i) => lm[i]).filter(Boolean);
  const x = pts.reduce((s, p) => s + p.x, 0) / pts.length;
  const y = pts.reduce((s, p) => s + p.y, 0) / pts.length;
  return { x, y };
};

const mid = (a: Pt, b: Pt): Pt => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

export function markerFor(area: AssessmentArea["area"], lm: Pt[]): Marker {
  let point: Pt = lm[KEY.menton];
  switch (area) {
    case "lips":
      point = centroid(lm, REGIONS.outerLip);
      break;
    case "chin":
      point = lm[KEY.menton];
      break;
    case "jawline":
      point = lm[KEY.gonionL];
      break;
    case "cheeks":
      point = centroid(lm, REGIONS.leftCheek);
      break;
    case "undereye":
      point = mid(lm[KEY.eyeInnerL], lm[KEY.eyeOuterL]);
      break;
    case "temples":
      point = lm[KEY.zygionL];
      break;
  }
  return { area, point };
}

export function markersFor(areas: AssessmentArea[], lm: Pt[]): Marker[] {
  // De-dupe by area so we don't stack two markers on the same spot.
  const seen = new Set<string>();
  const out: Marker[] = [];
  for (const a of areas) {
    if (seen.has(a.area)) continue;
    seen.add(a.area);
    out.push(markerFor(a.area, lm));
  }
  return out;
}
