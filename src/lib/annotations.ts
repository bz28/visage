// Maps assessment areas to label points on the user's own photo (never a
// fabricated "after"). FaceCanvas draws each area's region glow + label here.
import { KEY, REGIONS, type Pt } from "./landmarks";
import type { AssessmentArea } from "./assessment-schema";

export interface Marker {
  area: AssessmentArea["area"];
  /** Pixel position in source-image coordinates. */
  point: Pt;
}

const centroid = (lm: Pt[], idx: readonly number[]): Pt => {
  const pts = idx.map((i) => lm[i]).filter(Boolean);
  const x = pts.reduce((s, p) => s + p.x, 0) / pts.length;
  const y = pts.reduce((s, p) => s + p.y, 0) / pts.length;
  return { x, y };
};

const mid = (a: Pt, b: Pt): Pt => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

function pointFor(area: AssessmentArea["area"], lm: Pt[]): Pt {
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
      point = lm[KEY.templeL];
      break;
  }
  return point;
}

/**
 * Build one marker per unique area from an assessment (duplicates of an area
 * collapse to a single marker).
 */
export function buildAnnotations(
  areas: AssessmentArea[],
  lm: Pt[],
): { markers: Marker[] } {
  const seen = new Set<string>();
  const markers: Marker[] = [];
  for (const a of areas) {
    if (seen.has(a.area)) continue;
    seen.add(a.area);
    markers.push({ area: a.area, point: pointFor(a.area, lm) });
  }
  return { markers };
}
