import type { Assessment } from "./assessment-schema";

/**
 * Dev-only canned assessment used when MOCK_ANALYZE is set (see api/analyze).
 * Lets UI work on the result/book screens run instantly and for free — no paid
 * vision call, no ~90s wait. Deliberately spans three areas with mixed
 * confidence (and one roughAmount) so it exercises the markers, chips, and
 * expand-on-tap exactly like a real read. Never used in production.
 *
 * Keep the copy in the same education-not-prescription register as the real AI,
 * so what we iterate against looks like what ships.
 */
export const MOCK_ASSESSMENT: Assessment = {
  summary:
    "You have a genuinely lovely, expressive face — there are just a couple of things we'd want to sit down and talk through together, because the details always matter so much more in person than in a photo.",
  areas: [
    {
      area: "lips",
      title: "Lip balance",
      observation:
        "Your upper and lower lip sit close in height, which can read a touch flat through the middle.",
      why: "Lips are a common thing to explore here — a little more in the lower lip can bring a soft, natural fullness that still looks like you.",
      confidence: "medium",
      priority: 1,
      roughAmount: "often around a single syringe",
    },
    {
      area: "chin",
      title: "Chin & lower third",
      observation:
        "Your lower third sits a little shorter than the upper and middle thirds.",
      why: "The chin is a common area people explore to balance the lower third and refine the profile — though projection is really best judged from the side, in person.",
      confidence: "low",
      priority: 2,
    },
    {
      area: "jawline",
      title: "Jawline definition",
      observation:
        "The jaw has good width and balance, but the angle reads a little soft rather than sharply defined.",
      why: "Adding subtle structure along the jaw angle is a common way people explore a cleaner, more defined silhouette — best confirmed in profile, in person.",
      confidence: "low",
      priority: 3,
    },
  ],
};
