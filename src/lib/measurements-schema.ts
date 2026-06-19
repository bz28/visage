import { z } from "zod";

/**
 * Pure type + validator for facial measurements, with NO landmark/MediaPipe
 * import — so the server (API route, AI layer) can use the type and validate
 * the request body without dragging the browser-only MediaPipe package into the
 * server bundle. `computeMeasurements` (client-only) lives in measurements.ts.
 */
export const verdictSchema = z.enum([
  "balanced",
  "short",
  "long",
  "narrow",
  "wide",
]);
export type Verdict = z.infer<typeof verdictSchema>;

export const measurementsSchema = z.object({
  thirds: z.object({
    upper: z.number(),
    middle: z.number(),
    lower: z.number(),
  }),
  lowerThird: verdictSchema,
  lipRatio: z.number(),
  lipVerdict: verdictSchema,
  upperToLowerLip: z.number(),
  jawToCheek: z.number(),
  jawVerdict: verdictSchema,
  asymmetry: z.number(),
});

export type Measurements = z.infer<typeof measurementsSchema>;
