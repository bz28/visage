// In-browser face-landmark detection (MediaPipe, WASM). Returns 478 points
// (468 face mesh + 10 iris); KEY/REGIONS below name the ones we use.
import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";

const WASM_CDN =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm";
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

export interface Pt {
  x: number;
  y: number;
  /** Relative depth from MediaPipe (≈ same scale as x; smaller = nearer the
   *  camera). Present on detected landmarks; absent on derived 2D points. Used
   *  by the warp engine to know the face's 3D surface direction. */
  z?: number;
}

export type DetectStatus = "ok" | "no-face" | "multiple-faces";

export interface DetectResult {
  status: DetectStatus;
  /** Landmarks in pixel coordinates, present only when status === "ok". */
  landmarks?: Pt[];
}

/**
 * Named single-point landmark indices (MediaPipe canonical 478-point mesh).
 * Comments give the anatomical name an injector would use.
 */
export const KEY = {
  trichion: 10, // top of forehead (hairline proxy)
  glabella: 9, // smooth area between the brows
  nasion: 168, // bridge of nose, between the eyes
  noseTip: 1, // tip of the nose
  subnasale: 2, // where the nose meets the upper lip
  stomionUpper: 13, // upper-lip inner edge (mouth line, top)
  stomionLower: 14, // lower-lip inner edge (mouth line, bottom)
  upperLipTop: 0, // top of the upper vermilion (cupid's bow center)
  lowerLipBottom: 17, // bottom of the lower vermilion
  menton: 152, // lowest point of the chin
  mouthCornerR: 61,
  mouthCornerL: 291,
  zygionR: 234, // right cheekbone (face width, upper)
  zygionL: 454, // left cheekbone
  gonionR: 172, // right jaw angle (face width, lower)
  gonionL: 397, // left jaw angle
  eyeInnerR: 133,
  eyeOuterR: 33,
  eyeInnerL: 362,
  eyeOuterL: 263,
  alarR: 48, // right nostril edge (nasolabial-fold start)
  alarL: 278, // left nostril edge (nasolabial-fold start)
  irisR: 468, // right iris center
  irisL: 473, // left iris center
  templeL: 251, // left temple (upper-side of forehead)
} as const;

/**
 * Multi-point contours used for annotation marker centroids (annotations.ts) and
 * the feathered composite region masks (face-regions.ts) — outer lip, jawline,
 * and the two cheeks.
 */
export const REGIONS = {
  outerLip: [
    61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 409, 270, 269, 267, 0,
    37, 39, 40, 185,
  ],
  jawline: [172, 136, 150, 149, 176, 148, 152, 377, 400, 378, 379, 365, 397],
  leftCheek: [234, 93, 132, 58, 172, 136, 50, 205],
  rightCheek: [454, 323, 361, 288, 397, 365, 280, 425],
} as const;

let landmarkerPromise: Promise<FaceLandmarker> | null = null;

/** Lazily build a single shared FaceLandmarker (model load is expensive). */
function getLandmarker(): Promise<FaceLandmarker> {
  if (!landmarkerPromise) {
    landmarkerPromise = (async () => {
      const vision = await FilesetResolver.forVisionTasks(WASM_CDN);
      return FaceLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: MODEL_URL, delegate: "CPU" },
        runningMode: "IMAGE",
        // Detect up to 2 so we can warn when more than one face is in frame.
        numFaces: 2,
      });
    })();
  }
  return landmarkerPromise;
}

/**
 * Detect a single face's landmarks in an image, returned in pixel coordinates
 * relative to (width, height).
 */
export async function detectFace(
  image: HTMLImageElement | HTMLCanvasElement,
  width: number,
  height: number,
): Promise<DetectResult> {
  const landmarker = await getLandmarker();
  const result = landmarker.detect(image);
  const faces = result.faceLandmarks;

  if (!faces || faces.length === 0) return { status: "no-face" };
  if (faces.length > 1) return { status: "multiple-faces" };

  const landmarks: Pt[] = faces[0].map((p) => ({
    x: p.x * width,
    y: p.y * height,
    // MediaPipe's z is normalized roughly to image width — scale it like x so
    // depth is comparable to the pixel-space x/y.
    z: p.z * width,
  }));
  return { status: "ok", landmarks };
}
