/**
 * The three filler amounts.
 *
 * NOTE: the patient flow shows ONE optimal result (the Natural amount) — see
 * `buildCombinedPrompt`. The Subtle/Natural/Fuller selector and per-area editing
 * (`buildPrompt`) power the upcoming **clinician tool**, where the injector
 * dials each area; they're kept here for that, not used in the patient UI.
 *
 * The mL figures are CLINICAL PLACEHOLDERS pending surgeon calibration — see
 * docs/surgeon-calibration.md.
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

// Assert the actual observed mouth state — far stronger than a generic "keep it
// closed", and it matches what the composite harness verifies. Only relevant
// when the lips are being edited.
function mouthRule(includesLips: boolean, mouthOpen?: boolean): string {
  if (!includesLips || mouthOpen === undefined) return "";
  return mouthOpen
    ? `CRITICAL: in this photo the mouth is OPEN and the teeth are showing — keep ` +
        `the exact same smile, mouth opening, and teeth; do not close the mouth or ` +
        `change the expression. `
    : `CRITICAL: in this photo the mouth is CLOSED with the lips together and NO ` +
        `teeth showing — keep it exactly closed; do NOT open the mouth, add a smile, ` +
        `or show any teeth. `;
}

const PRESERVE_RULE =
  `This is a medical preview, so accuracy matters more than flattery: do NOT ` +
  `smooth, retouch, beautify, or slim the face; preserve every detail of the ` +
  `original — exact skin texture, pores, freckles, blemishes, expression, teeth, ` +
  `identity, face shape, lighting, sharpness, pose, hair, and background. Keep the ` +
  `same camera framing and resolution. The result must be photorealistic and ` +
  `tasteful — never overfilled or "overdone". Output only the edited photo.`;

/**
 * The patient's ONE combined result: every recommended area edited at the
 * Natural (optimal) amount in a single image. Region control is by instruction
 * (no mask); the composite then locks everything outside those areas.
 */
export function buildCombinedPrompt(
  areas: SimulatableArea[],
  mouthOpen?: boolean,
): string {
  const edits = areas.map((a) => AREA_EDIT[a]).join("; ");
  return (
    `Edit this photo to show a natural dermal-filler result: ${edits}. ` +
    `Keep each change subtle and optimal (about one syringe each). Change ONLY ` +
    `these areas — nothing else. ${mouthRule(areas.includes("lips"), mouthOpen)}` +
    PRESERVE_RULE
  );
}

/**
 * Per-area, per-look instruction for the CLINICIAN tool (not used in the patient
 * flow — the patient gets `buildCombinedPrompt`). Kept for the injector dialing
 * a single area to a chosen amount.
 */
export function buildPrompt(
  area: SimulatableArea,
  ml: number,
  label: string,
  mouthOpen?: boolean,
): string {
  const degree = LOOKS.find((l) => l.label === label)?.degree ?? "naturally";
  return (
    `Edit this photo: ${AREA_EDIT[area]}, ${degree} (about ${ml} ml of filler — ` +
    `a ${label.toLowerCase()} amount). Change ONLY the ${area} — nothing else. ` +
    `${mouthRule(area === "lips", mouthOpen)}${PRESERVE_RULE}`
  );
}
