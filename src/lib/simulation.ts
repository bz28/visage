/**
 * Looks the patient can preview, as approximate filler amounts.
 *
 * The mL figures are CLINICAL PLACEHOLDERS pending surgeon calibration — see
 * docs/surgeon-calibration.md. Today they only shape the prompt + the inpaint
 * denoise strength; the phase-2 deterministic warp will use real, calibrated
 * displacement values instead of guessing.
 */
export const LOOK_KEYS = ["subtle", "natural", "fuller"] as const;
export type LookKey = (typeof LOOK_KEYS)[number];

export const LOOKS: { key: LookKey; label: string; ml: number; degree: string }[] = [
  { key: "subtle", label: "Subtle", ml: 0.5, degree: "very subtly" },
  { key: "natural", label: "Natural", ml: 1.0, degree: "naturally" },
  { key: "fuller", label: "Fuller", ml: 1.5, degree: "noticeably but still tastefully" },
];

export const DEFAULT_LOOK: LookKey = "natural";

/**
 * Areas we can preview from a single FRONT photo. Lips read best; chin, jawline,
 * and cheeks are best-effort here (chin/jaw projection really wants a profile) —
 * see the calibration doc. Other flagged areas (under-eye, temples) get the read
 * only — no front-photo preview.
 */
export const SIMULATABLE = ["lips", "chin", "jawline", "cheeks"] as const;
export type SimulatableArea = (typeof SIMULATABLE)[number];

export function isSimulatable(area: string): area is SimulatableArea {
  return (SIMULATABLE as readonly string[]).includes(area);
}

const AREA_EDIT: Record<SimulatableArea, string> = {
  lips: "add dermal-filler fullness to the lips",
  chin: "add dermal filler to the chin for a more defined, balanced lower face",
  jawline: "add dermal filler along the jawline for a sharper, cleaner angle",
  cheeks: "add dermal filler to the cheeks for a softly lifted midface",
};

/**
 * Instruction for Gemini image editing. Identity-locked and restraint-first;
 * region control comes from the instruction (no mask). The degree wording maps
 * to the chosen look; the mL figure is an education-only sense of scale.
 */
export function buildPrompt(
  area: SimulatableArea,
  ml: number,
  label: string,
): string {
  const degree = LOOKS.find((l) => l.label === label)?.degree ?? "naturally";
  return (
    `Edit this photo: ${AREA_EDIT[area]}, ${degree} (about ${ml} ml of filler — ` +
    `a ${label.toLowerCase()} amount). Change ONLY the ${area}. Keep the person's ` +
    `identity, face shape, skin tone and texture, lighting, pose, hair, and ` +
    `background EXACTLY the same. The result must be photorealistic, natural, and ` +
    `tasteful — never overfilled or "overdone". Output only the edited photo.`
  );
}
