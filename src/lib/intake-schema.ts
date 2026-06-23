import { z } from "zod";

/**
 * Short patient intake — kept deliberately minimal (surgeon's direction: don't
 * overload the patient). The patient flow only collects **gender, age, and a
 * free-text concern**; everything else is optional and reserved for the AI read
 * or the future clinician tool. All fields are optional so intake never blocks.
 */

/** Patient gender — drives the gender-aware aesthetic (not an identity label). */
export const GENDER_OPTIONS = ["woman", "man", "other"] as const;
export type Gender = (typeof GENDER_OPTIONS)[number];
export const GENDER_LABELS: Record<Gender, string> = {
  woman: "Woman",
  man: "Man",
  other: "Prefer not to say",
};

export const AGE_OPTIONS = [
  "under 25",
  "25–34",
  "35–44",
  "45–54",
  "55+",
] as const;

/** The aesthetic direction the AI reasons with, derived from gender. */
export const LOOK_OPTIONS = ["feminine", "masculine", "balanced"] as const;
export type Look = (typeof LOOK_OPTIONS)[number];
export const LOOK_LABELS: Record<Look, string> = {
  feminine: "Softer / more feminine",
  masculine: "Stronger / more masculine",
  balanced: "Balanced",
};

export function lookFromGender(gender: Gender | undefined): Look | undefined {
  if (gender === "woman") return "feminine";
  if (gender === "man") return "masculine";
  if (gender === "other") return "balanced";
  return undefined;
}

// --- Reserved for the AI read / the future clinician tool. NOT collected in the
//     simplified patient intake. ---
export const GOAL_OPTIONS = [
  "Fuller lips",
  "Sharper jawline",
  "More defined chin",
  "Lifted cheeks",
  "Look less tired",
  "Not sure — show me",
] as const;
export const BUDGET_OPTIONS = ["Just exploring", "1 area", "A full plan"] as const;

export const intakeSchema = z.object({
  // Collected in the patient flow:
  gender: z.enum(GENDER_OPTIONS).optional(),
  age: z.enum(AGE_OPTIONS).optional(),
  /** Free-text, in their words ("I look tired", "fuller lips"). */
  concern: z.string().max(300).optional(),
  // Reserved (clinician tool / richer read) — not asked of patients:
  look: z.enum(LOOK_OPTIONS).optional(),
  goals: z.array(z.string()).max(6).default([]),
  heritage: z.string().max(60).optional(),
  priorTreatments: z.string().max(300).optional(),
  budget: z.enum(BUDGET_OPTIONS).optional(),
});

export type Intake = z.infer<typeof intakeSchema>;
