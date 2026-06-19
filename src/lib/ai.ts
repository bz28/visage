import "server-only";
import { generateObject } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import {
  assessmentSchema,
  type Assessment,
  AREA_KEYS,
} from "./assessment-schema";
import type { Measurements } from "./measurements-schema";

/**
 * Sonnet 4.6 via the Vercel AI Gateway. Vision-capable and supports structured
 * output; the deterministic layer already supplies the hard measurements, so
 * the model only does soft-tissue reads + phrasing — Sonnet is plenty here and
 * ~half the cost of Opus. Bump to opus-4-8 if the "why" quality proves thin on
 * real faces. Schema is enforced via `schema`.
 *
 * If ANTHROPIC_API_KEY is set we call the Anthropic API directly; otherwise we
 * fall through to the Vercel AI Gateway (OIDC on Vercel deployments). Either
 * way, a failure falls back to the on-device baseline.
 */
const MODEL = process.env.ANTHROPIC_API_KEY
  ? anthropic("claude-sonnet-4-6")
  : "anthropic/claude-sonnet-4-6";

const SYSTEM = `You are a world-class aesthetic injector and facial-balance expert with deep customer empathy. You are reviewing a person's frontal photo to help them understand what an experienced injector would *notice and discuss* about their facial balance with dermal filler.

You will be given objective measurements computed from facial landmarks. Treat those numbers as ground truth for proportion — do not re-estimate them. Your job is to add what the numbers cannot capture: soft-tissue cues only visible in the photo (volume loss or hollowing in the cheeks, temples, or under-eyes; skin quality; how features relate as a whole), and to synthesize everything into a prioritized, holistic read like a real clinician would.

Hard rules — these protect the person and us legally:
- This is EDUCATION, never a diagnosis or prescription. Never state doses, syringe counts, or "you need/should get X." Use "an injector might discuss…", "commonly considered…".
- Never promise or guarantee a result. No before/after claims.
- Be warm, reassuring, and natural — reduce the fear of looking "overdone." Favor subtle, conservative framing.
- Only flag areas you can actually justify from the measurements or the image. If the face is well balanced, say so honestly rather than inventing concerns.
- Areas must be drawn from: ${AREA_KEYS.join(", ")}.
- Prioritize by what would most improve overall balance (priority 1 = discuss first). Often the keystone is structural (chin/jaw) even when the person came in thinking about lips.
- Return AT MOST 3 areas — only the most relevant. A real injector wouldn't rattle off six things; restraint reads as expertise. If the face is balanced, returning 0–1 is correct.
- Keep \`observation\` and \`why\` to ONE tight sentence each. Brevity matters.

Voice — this is critical: write as the clinic speaking to the patient, warm and human, in first person plural ("we'd look at…", "we often find…"). Never sound like an AI, a report, or a generic listicle. No hedge-speak, no "it is important to note", no clinical jargon. Like a friendly, confident expert at the practice talking to someone across the desk.`;

function describe(m: Measurements): string {
  const pct = (n: number) => `${Math.round(n * 100)}%`;
  return [
    `Facial thirds (ideal ~33% each): upper ${pct(m.thirds.upper)}, middle ${pct(m.thirds.middle)}, lower ${pct(m.thirds.lower)} (lower third reads "${m.lowerThird}").`,
    `Lip ratio lower:upper = ${m.lipRatio.toFixed(2)} (aesthetic ideal ~1.6; reads "${m.lipVerdict}").`,
    `Lower-face split (nose-base→mouth : mouth→chin) = ${m.upperToLowerLip.toFixed(2)} (balanced ~0.5).`,
    `Jaw-to-cheekbone width = ${m.jawToCheek.toFixed(2)} (balanced ~0.70–0.75; reads "${m.jawVerdict}").`,
    `Facial asymmetry index = ${m.asymmetry.toFixed(3)} (0 = symmetric; >0.08 is noticeable).`,
  ].join("\n");
}

/**
 * Enriched, AI-driven assessment. Falls back to the provided baseline if the
 * model call fails or no credentials are configured — the user always gets a
 * result. `imageBase64` is the raw base64 (no data: prefix); omit to reason
 * from measurements alone.
 */
export async function analyzeFace(
  measurements: Measurements,
  baseline: Assessment,
  imageBase64?: string,
): Promise<{ assessment: Assessment; source: "ai" | "baseline" }> {
  try {
    const text = `Here are the objective measurements for this face:\n\n${describe(
      measurements,
    )}\n\nReview the photo and produce the assessment.`;

    const content: Array<
      { type: "text"; text: string } | { type: "image"; image: string }
    > = [{ type: "text", text }];
    if (imageBase64) content.push({ type: "image", image: imageBase64 });

    const { object } = await generateObject({
      model: MODEL,
      schema: assessmentSchema,
      system: SYSTEM,
      messages: [{ role: "user", content }],
      maxOutputTokens: 1024, // guardrail; the brevity prompt is the real speed lever
    });

    return { assessment: object, source: "ai" };
  } catch (err) {
    // Log only the message — the full error object (e.g. APICallError) can carry
    // requestBodyValues including the base64 photo. Never log that (see CLAUDE.md).
    console.error(
      "[analyzeFace] AI call failed, using baseline:",
      err instanceof Error ? err.message : String(err),
    );
    return { assessment: baseline, source: "baseline" };
  }
}
