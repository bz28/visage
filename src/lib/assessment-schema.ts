import { z } from "zod";

/**
 * The filler-relevant facial areas v1 reasons about. Lips / chin / jawline are
 * the most reliable from a single frontal photo; cheeks / undereye / temples
 * are soft-tissue reads that really need the AI layer (and ideally a consult).
 */
export const AREA_KEYS = [
  "lips",
  "chin",
  "jawline",
  "cheeks",
  "undereye",
  "temples",
] as const;

export const AREA_LABELS: Record<(typeof AREA_KEYS)[number], string> = {
  lips: "Lips",
  chin: "Chin",
  jawline: "Jawline",
  cheeks: "Cheeks (midface)",
  undereye: "Under-eye",
  temples: "Temples",
};

export const areaSchema = z.object({
  area: z.enum(AREA_KEYS),
  /** Short human title, e.g. "Lip balance". */
  title: z.string(),
  /** What was observed, in plain, non-clinical language. */
  observation: z.string(),
  /** WHY it's commonly discussed — the educational reasoning. */
  why: z.string(),
  confidence: z.enum(["low", "medium", "high"]),
  /** 1 = discuss first. Lower sorts earlier. */
  priority: z.number().int().min(1).max(10),
});

export type AssessmentArea = z.infer<typeof areaSchema>;

/**
 * Schema the AI is constrained to. Kept deliberately free of anything that
 * reads as a prescription (no doses, no syringe counts, no "you need").
 */
export const assessmentSchema = z.object({
  summary: z
    .string()
    .describe(
      "2-3 sentences, warm and plain, framing what an injector would notice. Education, never a promise.",
    ),
  areas: z
    .array(areaSchema)
    .describe("Areas commonly discussed for a face like this, most relevant first."),
});

export type Assessment = z.infer<typeof assessmentSchema>;

export const DISCLAIMER =
  "This is an educational simulation of what an injector might discuss — not medical advice, a diagnosis, or a guaranteed result. Only a licensed provider can tell you what's right for you.";
