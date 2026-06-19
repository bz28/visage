/**
 * White-label partner clinic config.
 *
 * v1 ships a single hardcoded partner clinic. Multi-tenant theming (one config
 * per clinic, resolved by subdomain/route) is a v2 concern — see CLAUDE.md.
 * The accent color flows into the UI via the --accent CSS variable set on
 * <html> in app/layout.tsx.
 */
export interface Clinic {
  /** Display name shown to the patient. */
  name: string;
  /** Brand accent color (any valid CSS color). */
  accent: string;
  /** Where new consultation leads are emailed. */
  consultEmail: string;
  /** One-line reassurance shown near the booking CTA. */
  bookingNote: string;
}

export const CLINIC: Clinic = {
  name: "Ben's Lab",
  accent: "#b8895f",
  consultEmail: "consults@benslab.example",
  bookingNote:
    "A licensed injector will review your photos and reach out to confirm what's right for you.",
};
