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

export const LOOKS: { key: LookKey; label: string; ml: number; strength: number }[] = [
  { key: "subtle", label: "Subtle", ml: 0.5, strength: 0.55 },
  { key: "natural", label: "Natural", ml: 1.0, strength: 0.72 },
  { key: "fuller", label: "Fuller", ml: 1.5, strength: 0.9 },
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

const AREA_PHRASE: Record<SimulatableArea, string> = {
  lips: "subtly fuller, naturally enhanced lips",
  chin: "a slightly more defined, balanced chin",
  jawline: "a subtly sharper, more defined jawline angle",
  cheeks: "softly lifted, naturally fuller cheeks",
};

/** Prompt for the inpaint model — identity-locked, restraint-first. */
export function buildPrompt(
  area: SimulatableArea,
  ml: number,
  label: string,
): string {
  return (
    `Photorealistic photo of the exact same person — identical lighting, skin, ` +
    `and identity — with ${AREA_PHRASE[area]} from dermal filler, about ${ml} ml ` +
    `(${label.toLowerCase()} amount). Natural, tasteful, subtle; never overfilled ` +
    `or "overdone". Change ONLY the masked area; keep everything else identical.`
  );
}
