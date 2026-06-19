import type { ViewKey } from "@/lib/views";

interface Props {
  view: ViewKey;
  /** Pixel size of the (square) illustration. Defaults to 80. */
  size?: number;
  className?: string;
}

/**
 * Simple line-style head illustrations showing the target pose for each view.
 * Uses currentColor so callers can tint via text color (e.g. the --accent var).
 */
export function PoseIllustration({ view, size = 80, className }: Props) {
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      role="img"
      aria-label={`${LABELS[view]} pose`}
      className={className}
    >
      {POSES[view]}
    </svg>
  );
}

const LABELS: Record<ViewKey, string> = {
  front: "Front-facing",
  profile: "Side profile",
  threequarter: "Angled",
};

const POSES: Record<ViewKey, React.ReactNode> = {
  // Head facing forward — symmetric oval with both eyes.
  front: (
    <>
      <ellipse cx="32" cy="28" rx="15" ry="18" />
      <path d="M32 46v4c0 5 5 9 11 10M32 50c0 5-5 9-11 10" />
      <circle cx="26" cy="26" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="38" cy="26" r="1.6" fill="currentColor" stroke="none" />
      <path d="M27 35c1.6 1.4 8.4 1.4 10 0" />
    </>
  ),
  // Side view — profile silhouette facing right with nose/chin contour.
  profile: (
    <>
      <path d="M40 13c-9 0-16 7-16 16 0 4 1 6 1 9 0 2-2 3-2 5 0 1.5 2 2 2 2l-1 4c0 4 4 6 8 6" />
      <path d="M24 31c-2 1-4 3-4 5s2 3 3 3" />
      <circle cx="32" cy="26" r="1.6" fill="currentColor" stroke="none" />
      <path d="M27 36c2 1 4 1 6 0" />
    </>
  ),
  // ¾ turn — oval shifted, far eye smaller, nose hinted at the edge.
  threequarter: (
    <>
      <path d="M38 11c-9 0-16 8-16 18 0 9 6 17 16 17s16-7 16-16" />
      <path d="M22 33c-3 0-5 2-5 4 0 3 4 4 6 3" />
      <circle cx="29" cy="26" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="42" cy="26" r="1.3" fill="currentColor" stroke="none" />
      <path d="M27 36c2 1.2 6 1.2 8 0" />
    </>
  ),
};
