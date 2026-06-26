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
 * simulatable here. These now drive the deterministic geometric warp
 * (src/lib/warp.ts), not a prompt; the magnitudes are the CLINICAL placeholders
 * pending surgeon review (docs/surgeon-calibration.md, warp section).
 */
export const PROFILE_AREAS = ["chin", "jawline", "nose"] as const;
export type ProfileArea = (typeof PROFILE_AREAS)[number];

export function isProfileArea(area: string): area is ProfileArea {
  return (PROFILE_AREAS as readonly string[]).includes(area);
}

/**
 * On the front photo, chin + jawline are rendered by the angle-aware projection
 * warp (`warpAreas`) — a defined jawline / projected chin that reads head-on,
 * identity-locked and free. (Lips are also a warp, but a different one —
 * eversion via `warpLips` — so they're handled separately, not in this set.)
 * The generative model is left with only the flat-area volume: cheeks + folds.
 */
export const FRONT_WARP_AREAS = ["chin", "jawline"] as const;
// A subtype of BOTH SimulatableArea and ProfileArea, so .filter() narrows
// cleanly for the front warp (which feeds warpAreas, typed ProfileArea[]).
export type FrontWarpArea = (typeof FRONT_WARP_AREAS)[number];
export function isFrontWarpArea(area: string): area is FrontWarpArea {
  return (FRONT_WARP_AREAS as readonly string[]).includes(area);
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

// Human names for the finish prompt (which talks about the area, not an edit).
const FINISH_LABEL: Partial<Record<SimulatableArea, string>> = {
  lips: "lips",
  cheeks: "cheeks",
};

/**
 * The "+finish" pass. The geometric warp has already reshaped the area (fuller
 * lips / projected cheeks) — its shape is the patient's own pixels, moved. This
 * asks the model to add ONLY the photoreal *texture* the warp can't synthesize
 * (the soft sheen + volume highlight of real filler) without touching the shape,
 * so the result reads like a real result, not a stretch. The composite then
 * re-locks everything outside the area, so even the texture pass can't drift it.
 */
export function buildFinishPrompt(
  areas: SimulatableArea[],
  mouthOpen?: boolean,
): string {
  const names = areas.map((a) => FINISH_LABEL[a] ?? a).join(" and the ");
  return (
    `This photo is a dermal-filler PREVIEW: the ${names} have already been made ` +
    `fuller by reshaping. Add ONLY subtle, photorealistic filler texture to the ` +
    `${names} — the soft sheen and gentle volume highlight that real filler gives ` +
    `— so they look natural, not stretched. Do NOT change their shape, outline, ` +
    `size, or position in any way, and change NOTHING else in the photo. ` +
    // The texture pass must not nudge the mouth/teeth — the identity-lock harness
    // rejects any expression drift, which would silently drop the finish.
    mouthRule(areas.includes("lips"), mouthOpen) +
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
