// The photo angles a real assessment uses. Front is required; the side view is
// optional but unlocks the profile before/after (chin / jaw / nose projection).
export const VIEWS = [
  {
    key: "front",
    label: "Front",
    required: true,
    // Mouth-closed matters: lip simulation can't preserve an open/pursed mouth,
    // so an open mouth makes the front preview fail our expression guard.
    instruction: "Look straight at the camera, with a relaxed, closed mouth (no teeth).",
  },
  {
    key: "profile",
    label: "Side",
    required: false,
    instruction: "Turn to one side — either way.",
  },
] as const;

export type ViewKey = (typeof VIEWS)[number]["key"];

export const VIEW_LABELS: Record<ViewKey, string> = {
  front: "Front",
  profile: "Side",
};
