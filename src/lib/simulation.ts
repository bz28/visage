/**
 * The three filler intensities (a label + how-much wording).
 *
 * NOTE: the patient flow shows ONE optimal result — a qualitative "natural"
 * level (see `buildCombinedPrompt`), NOT tied to the mL table below. The
 * Subtle/Natural/Fuller selector and per-area amounts (`buildPrompt`,
 * `AREA_AMOUNTS`) power the upcoming **clinician tool**, where the injector dials
 * each area; they're kept here for that, not used in the patient UI.
 */
export const LOOK_KEYS = ["subtle", "natural", "fuller"] as const;
export type LookKey = (typeof LOOK_KEYS)[number];

export const LOOKS: { key: LookKey; label: string; degree: string }[] = [
  { key: "subtle", label: "Subtle", degree: "very subtly" },
  { key: "natural", label: "Natural", degree: "naturally" },
  { key: "fuller", label: "Fuller", degree: "noticeably but still tastefully" },
];

// Reserved for the clinician tool's look selector (not used in the patient flow).
export const DEFAULT_LOOK: LookKey = "natural";

/**
 * Per-area filler amounts (mL) for subtle / natural / fuller. CLINICAL
 * PLACEHOLDERS built from standard ranges — pending surgeon calibration (see
 * docs/surgeon-calibration.md §A/E). Jawline/cheeks are totals across both
 * sides; folds are per side. These only feed the clinician tool's prompt
 * wording today (the patient flow is qualitative) — never shown to patients.
 */
export const AREA_AMOUNTS: Record<SimulatableArea, Record<LookKey, number>> = {
  lips: { subtle: 0.5, natural: 1.0, fuller: 1.5 },
  chin: { subtle: 0.5, natural: 1.0, fuller: 2.0 },
  jawline: { subtle: 1.0, natural: 2.0, fuller: 4.0 },
  cheeks: { subtle: 0.5, natural: 1.0, fuller: 2.0 },
  nasolabial: { subtle: 0.5, natural: 1.0, fuller: 1.5 },
  marionette: { subtle: 0.5, natural: 1.0, fuller: 1.5 },
};

/**
 * Areas we can preview from a single FRONT photo. Lips read best; chin, jawline,
 * and cheeks are best-effort here (chin/jaw projection really wants a profile) —
 * see the calibration doc. Nasolabial folds + marionette lines are surface
 * creases we soften. Nose / under-eye / temples get the read only — no
 * front-photo preview (nose's real change is profile + highest-risk; the others
 * are subtle/high-risk).
 */
export const SIMULATABLE = [
  "lips",
  "chin",
  "jawline",
  "cheeks",
  "nasolabial",
  "marionette",
] as const;
export type SimulatableArea = (typeof SIMULATABLE)[number];

export function isSimulatable(area: string): area is SimulatableArea {
  return (SIMULATABLE as readonly string[]).includes(area);
}

/**
 * Areas we can simulate from a PROFILE photo — projection treatments whose real
 * effect shows from the side. Nose graduates from discuss-only (front) to
 * simulatable here. CLINICAL assumptions — the directions in AREA_EDIT_PROFILE
 * are pending surgeon review (docs/surgeon-calibration.md).
 */
export const PROFILE_AREAS = ["chin", "jawline", "nose"] as const;
export type ProfileArea = (typeof PROFILE_AREAS)[number];

export function isProfileArea(area: string): area is ProfileArea {
  return (PROFILE_AREAS as readonly string[]).includes(area);
}

/** Everything the region masks / composite can paint: front areas + nose. */
export type EditableArea = SimulatableArea | "nose";

const AREA_EDIT: Record<SimulatableArea, string> = {
  lips: "add dermal-filler fullness to the lips",
  chin: "add dermal filler to the chin for a more defined, balanced lower face",
  jawline: "add dermal filler along the jawline for a sharper, cleaner angle",
  cheeks: "add dermal filler to the cheeks for a softly lifted midface",
  // Soften, never erase — a flat, creaseless face reads overfilled (see docs).
  nasolabial:
    "gently soften the nasolabial folds (the lines from the nose to the mouth corners) with subtle filler support — ease them, do NOT erase them",
  marionette:
    "gently soften the marionette lines (from the mouth corners toward the chin) with subtle filler support and lightly lift the mouth corners — ease them, do NOT flatten the lower face",
};

// Profile edit directions — projection treatments as they read from the side.
// Deliberately conservative (filler results read better too-subtle than
// overdone, and projection edits exaggerate fast on a profile). CLINICAL
// PLACEHOLDERS pending surgeon review (docs/surgeon-calibration.md).
const AREA_EDIT_PROFILE: Record<ProfileArea, string> = {
  chin: "add a very small amount of dermal filler to the chin to project it just slightly forward — a barely-perceptible refinement, NOT a longer, sharper, or more pointed chin",
  jawline: "add a small amount of dermal filler along the jaw to very slightly clean up the angle and soften the pre-jowl hollow — keep it subtle, do NOT reshape or widen the jaw",
  nose: "subtly straighten the nasal bridge and gently support the tip with a small amount of filler — a barely-perceptible non-surgical refinement, never a different nose",
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
 * The profile combined result: projection areas (chin / jaw / nose) edited from
 * the side, where their real effect shows. No mouth rule (lips aren't a profile
 * area); the composite locks everything outside the treated regions.
 */
export function buildProfilePrompt(areas: ProfileArea[]): string {
  const edits = areas.map((a) => AREA_EDIT_PROFILE[a]).join("; ");
  return (
    `Edit this profile (side-view) photo to show a NATURAL, subtle dermal-filler ` +
    `result: ${edits}. Each change must be small and barely perceptible — err on ` +
    `the side of TOO subtle rather than too much, and never change the overall ` +
    `face or feature shape. Change ONLY these areas — nothing else. ${PRESERVE_RULE}`
  );
}

/**
 * Per-area, per-look instruction for the CLINICIAN tool (not used in the patient
 * flow — the patient gets `buildCombinedPrompt`). Kept for the injector dialing
 * a single area to a chosen amount.
 */
export function buildPrompt(
  area: SimulatableArea,
  look: LookKey,
  mouthOpen?: boolean,
): string {
  const { label, degree } = LOOKS.find((l) => l.key === look)!;
  const ml = AREA_AMOUNTS[area][look];
  return (
    `Edit this photo: ${AREA_EDIT[area]}, ${degree} (about ${ml} ml of filler — ` +
    `a ${label.toLowerCase()} amount). Change ONLY the ${area} — nothing else. ` +
    `${mouthRule(area === "lips", mouthOpen)}${PRESERVE_RULE}`
  );
}
