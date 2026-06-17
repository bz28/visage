// The photo angles a real assessment uses. Front is required; the side and
// ¾ views are optional but make projection/contour reads far more accurate.
export const VIEWS = [
  {
    key: "front",
    label: "Front",
    required: true,
    instruction: "Look straight at the camera, relaxed.",
  },
  {
    key: "profile",
    label: "Side",
    required: false,
    instruction: "Turn fully to your side (profile). Lets us judge projection.",
  },
  {
    key: "threequarter",
    label: "Angle",
    required: false,
    instruction: "Turn about halfway to the side. Shows cheek & contour.",
  },
] as const;

export type ViewKey = (typeof VIEWS)[number]["key"];

export const VIEW_LABELS: Record<ViewKey, string> = {
  front: "Front",
  profile: "Side",
  threequarter: "Angle",
};
