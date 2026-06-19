import { z } from "zod";

/**
 * Short patient intake. Everything is optional so it never blocks the scan —
 * but each answer makes the read more personal and clinically real. Fed into
 * the AI so suggestions fit the person, not a generic "ideal face".
 */
export const GOAL_OPTIONS = [
  "Fuller lips",
  "Sharper jawline",
  "More defined chin",
  "Lifted cheeks",
  "Look less tired",
  "Not sure — show me",
] as const;

/** The aesthetic direction (drives gender-aware ideals, not an identity label). */
export const LOOK_OPTIONS = ["feminine", "masculine", "balanced"] as const;
export const LOOK_LABELS: Record<(typeof LOOK_OPTIONS)[number], string> = {
  feminine: "Softer / more feminine",
  masculine: "Stronger / more masculine",
  balanced: "Balanced",
};

export const AGE_OPTIONS = [
  "under 25",
  "25–34",
  "35–44",
  "45–54",
  "55+",
] as const;

export const BUDGET_OPTIONS = [
  "Just exploring",
  "1 area",
  "A full plan",
] as const;

export const intakeSchema = z.object({
  goals: z.array(z.string()).max(6).default([]),
  look: z.enum(LOOK_OPTIONS).optional(),
  age: z.enum(AGE_OPTIONS).optional(),
  /** Optional, sensitive — helps tailor to the patient's features, never to flatten them. */
  heritage: z.string().max(60).optional(),
  priorTreatments: z.string().max(300).optional(),
  budget: z.enum(BUDGET_OPTIONS).optional(),
});

export type Intake = z.infer<typeof intakeSchema>;
