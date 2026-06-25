// The photo angles a real assessment uses. Front is required; the side view is
// optional but unlocks the profile before/after (chin / jaw / nose projection).
export const VIEWS = [
  {
    key: "front",
    label: "Front",
    required: true,
    instruction: "Look straight at the camera.",
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
