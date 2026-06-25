import { z } from "zod";

/**
 * Pure type + validator for facial measurements, with NO landmark/MediaPipe
 * import — so the server (API route, AI layer) can use the type and validate
 * the request body without dragging the browser-only MediaPipe package into the
 * server bundle. `computeMeasurements` (client-only) lives in measurements.ts.
 */
// Verdicts come in two shapes — keep them separate so the schema can't validate
// an impossible combo (a "wide" lip ratio or a "short" jaw never happen).
export const sizeVerdict = z.enum(["balanced", "short", "long"]); // thirds, lips
export const widthVerdict = z.enum(["balanced", "narrow", "wide"]); // jaw

export const measurementsSchema = z.object({
  thirds: z.object({
    upper: z.number(),
    middle: z.number(),
    lower: z.number(),
  }),
  lowerThird: sizeVerdict,
  lipRatio: z.number(),
  lipVerdict: sizeVerdict,
  /** Candidate metric, not yet used in the read — see measurements.ts. */
  lowerFaceRatio: z.number(),
  jawToCheek: z.number(),
  jawVerdict: widthVerdict,
  asymmetry: z.number(),
  /** Real-world scale from average interpupillary distance (~63mm). For rough size hints only. */
  mmPerPx: z.number(),
  /** Head-yaw proxy for the front shot: 0 = straight-on, higher = turned (lowers confidence). */
  frontalTilt: z.number(),
});

export type Measurements = z.infer<typeof measurementsSchema>;
