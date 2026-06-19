import "server-only";
import { generateObject } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import {
  assessmentSchema,
  type Assessment,
  AREA_KEYS,
} from "./assessment-schema";
import type { Measurements } from "./measurements-schema";
import { LOOK_LABELS, type Intake } from "./intake-schema";
import { VIEW_LABELS, type ViewKey } from "./views";

// Sonnet 4.6 via the Anthropic API (or the Vercel AI Gateway if no key is set).
// Vision + structured output; the deterministic measurements ground it.
const MODEL = process.env.ANTHROPIC_API_KEY
  ? anthropic("claude-sonnet-4-6")
  : "anthropic/claude-sonnet-4-6";

const SYSTEM = `You are a world-class aesthetic injector and facial-balance expert with deep customer empathy, reviewing photos to help someone understand what an experienced injector would notice and discuss about their facial balance with dermal filler.

Inputs you may receive:
- One or more photos by angle (Front always; Side/profile and ¾ angle when provided).
- Objective measurements computed from facial landmarks (treat as ground truth for proportion — do not re-estimate).
- A short intake: their goals, the look they're going for, age, heritage, prior treatments, budget.

How to reason like a clinician:
- Judge PROJECTION (chin, lips, cheek, nose — how far things sit forward) from the SIDE/profile view. If no profile was provided, you CANNOT judge projection reliably — keep those areas low/medium confidence and say it's best confirmed in profile.
- Judge cheek/midface VOLUME and contour from the ¾ angle.
- Tailor to the person: a strong, wider jaw and chin suit a more masculine look; softer, fuller lips and lifted cheeks suit a more feminine look. Respect their stated goal and prioritize what serves it. Honor and PRESERVE their heritage and identity — never push one universal ideal.
- Confidence reflects what you actually had: fewer views, a tilted front photo, or thin signal → lower confidence.

Hard rules — these protect the person and us legally:
- EDUCATION, never a diagnosis or prescription. Never say "you need/should get X."
- Never promise or guarantee a result.
- Areas must be drawn from: ${AREA_KEYS.join(", ")}.
- Return AT MOST 3 areas — only the most relevant; restraint reads as expertise. If the face is balanced, 0–1 is correct.
- Keep \`observation\` and \`why\` to ONE tight sentence each.
- \`roughAmount\` is optional: only a vague, education-only sense of scale ("often around a single syringe") and only when a scale was given — otherwise omit it.

Voice — critical: write as the clinic speaking to the patient, warm and human, first person plural ("we'd look at…", "we often find…"). Never sound like an AI, a report, or a listicle. Like a friendly, confident expert across the desk.`;

function describe(m: Measurements, intake: Intake | undefined, views: ViewKey[]): string {
  const pct = (n: number) => `${Math.round(n * 100)}%`;
  const lines = [
    `Views provided: ${views.map((v) => VIEW_LABELS[v]).join(", ")}.`,
    `Facial thirds (ideal ~33% each): upper ${pct(m.thirds.upper)}, middle ${pct(m.thirds.middle)}, lower ${pct(m.thirds.lower)} (lower third reads "${m.lowerThird}").`,
    `Lip ratio lower:upper = ${m.lipRatio.toFixed(2)} (ideal ~1.6; "${m.lipVerdict}").`,
    `Jaw-to-cheekbone width = ${m.jawToCheek.toFixed(2)} (balanced ~0.70–0.75; "${m.jawVerdict}").`,
    `Facial asymmetry index = ${m.asymmetry.toFixed(3)} (0 = symmetric).`,
    `Front-photo tilt = ${m.frontalTilt.toFixed(2)} (0 = straight-on; higher means the head was turned, so trust the front read less).`,
    `Scale ≈ ${m.mmPerPx.toFixed(3)} mm/px (from average interpupillary distance — use only for a vague size sense).`,
  ];
  if (intake) {
    const bits: string[] = [];
    if (intake.goals?.length) bits.push(`goals: ${intake.goals.join(", ")}`);
    if (intake.look) bits.push(`look: ${LOOK_LABELS[intake.look]}`);
    if (intake.age) bits.push(`age: ${intake.age}`);
    if (intake.heritage) bits.push(`heritage: ${intake.heritage}`);
    if (intake.priorTreatments) bits.push(`prior: ${intake.priorTreatments}`);
    if (intake.budget) bits.push(`budget: ${intake.budget}`);
    if (bits.length) lines.push(`Patient intake — ${bits.join("; ")}.`);
  }
  return lines.join("\n");
}

interface AnalyzeParams {
  measurements: Measurements;
  baseline: Assessment;
  images: { view: ViewKey; base64: string }[];
  intake?: Intake;
}

/**
 * AI-driven assessment from all provided views + intake. Falls back to the
 * baseline if the model call fails or no credentials are configured.
 */
export async function analyzeFace({
  measurements,
  baseline,
  images,
  intake,
}: AnalyzeParams): Promise<{ assessment: Assessment; source: "ai" | "baseline" }> {
  try {
    const views = images.map((i) => i.view);
    const intro = `${describe(measurements, intake, views)}\n\nReview the photo(s) and produce the assessment.`;

    const content: Array<
      { type: "text"; text: string } | { type: "image"; image: string }
    > = [{ type: "text", text: intro }];
    for (const img of images) {
      content.push({ type: "text", text: `${VIEW_LABELS[img.view]} view:` });
      content.push({ type: "image", image: img.base64 });
    }

    const { object } = await generateObject({
      model: MODEL,
      schema: assessmentSchema,
      system: SYSTEM,
      messages: [{ role: "user", content }],
      maxOutputTokens: 1024,
    });

    return { assessment: object, source: "ai" };
  } catch (err) {
    // Log only the message — the error object can carry the base64 photo.
    console.error(
      "[analyzeFace] AI call failed, using baseline:",
      err instanceof Error ? err.message : String(err),
    );
    return { assessment: baseline, source: "baseline" };
  }
}
