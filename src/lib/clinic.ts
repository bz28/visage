/**
 * White-label partner clinic config.
 *
 * v1 ships a single hardcoded partner clinic. Multi-tenant theming (one config
 * per clinic, resolved by subdomain/route) is a v2 concern — see CLAUDE.md.
 * The accent color flows into the UI via a CSS variable set in ScanFlow.
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
  name: "Lumière Aesthetics",
  accent: "#b8895f",
  consultEmail: "consults@example.com",
  bookingNote:
    "A licensed injector will review your photos and reach out to confirm what's right for you.",
};
