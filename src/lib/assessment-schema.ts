import { z } from "zod";

/**
 * The filler-relevant facial areas v1 reasons about. We DISCUSS all of these;
 * only a subset gets a before/after (see SIMULATABLE in simulation.ts).
 * - lips / chin / jawline / cheeks / nasolabial / marionette: front-readable,
 *   simulated.
 * - nose: discussed only — its real effect is in profile, and it's the
 *   highest-risk (vascular) area, so we don't fake a front before/after.
 * - undereye / temples: discussed only — high-risk/subtle (undereye) or
 *   lateral + usually Sculptra (temples).
 * Clinical scope flagged for surgeon review (docs/surgeon-calibration.md).
 */
export const AREA_KEYS = [
  "lips",
  "chin",
  "jawline",
  "cheeks",
  "nasolabial",
  "marionette",
  "nose",
  "undereye",
  "temples",
] as const;

export const AREA_LABELS: Record<(typeof AREA_KEYS)[number], string> = {
  lips: "Lips",
  chin: "Chin",
  jawline: "Jawline",
  cheeks: "Cheeks",
  nasolabial: "Nasolabial folds",
  marionette: "Marionette lines",
  nose: "Nose",
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
