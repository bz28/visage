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
  /** Optional, vague, education-only sense of scale (e.g. "often around one syringe"). Omit if unsure. */
  roughAmount: z.string().optional(),
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
      "1-2 sentences in the clinic's warm first-person voice ('we'), like a friendly expert greeting the patient. A gentle opener that frames these as things worth talking through together in person — not a verdict or promise. No AI/report tone.",
    ),
  areas: z
    .array(areaSchema)
    .describe("Areas commonly discussed for a face like this, most relevant first."),
});

export type Assessment = z.infer<typeof assessmentSchema>;

export const DISCLAIMER =
  "This is a guide to start the conversation — not medical advice, and not always right. The only real assessment is an in-person one with our team.";
