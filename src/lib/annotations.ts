// Maps assessment areas to numbered markers on the user's own photo (never a
// fabricated "after"). The number ties each dot to its list item in the UI.
import { KEY, REGIONS, type Pt } from "./landmarks";
import type { AssessmentArea } from "./assessment-schema";

export interface Marker {
  area: AssessmentArea["area"];
  /** Pixel position in source-image coordinates. */
  point: Pt;
  /** 1-based number shown in the dot and on the matching list item. */
  n: number;
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
 * Build markers + an area→number map from an assessment. Areas are numbered in
 * list order; duplicates of an area share one marker/number (so two "chin"
 * items both point at dot 2).
 */
export function buildAnnotations(
  areas: AssessmentArea[],
  lm: Pt[],
): { markers: Marker[]; numberByArea: Record<string, number> } {
  const numberByArea: Record<string, number> = {};
  const markers: Marker[] = [];
  for (const a of areas) {
    if (numberByArea[a.area] != null) continue;
    const n = markers.length + 1;
    numberByArea[a.area] = n;
    markers.push({ area: a.area, point: pointFor(a.area, lm), n });
  }
  return { markers, numberByArea };
}
