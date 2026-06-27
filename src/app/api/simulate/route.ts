import { NextResponse } from "next/server";
import { z } from "zod";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateText } from "ai";
import {
  SIMULATABLE,
  LOOK_KEYS,
  DEFAULT_LOOK,
  buildPrompt,
  buildCombinedPrompt,
} from "@/lib/simulation";

export const runtime = "nodejs";
export const maxDuration = 60;

const bodySchema = z.object({
  /** Source photo as a data URL. */
  image: z.string().min(1),
  // Patient flow: all recommended areas in one combined edit (front photo).
  // (The profile before/after is an on-device geometric warp now — no API.)
  areas: z.array(z.enum(SIMULATABLE)).min(1).max(6).optional(),
  // Clinician flow: a single area at a chosen look.
  area: z.enum(SIMULATABLE).optional(),
  look: z.enum(LOOK_KEYS).optional(),
  /** Observed mouth state from the client's landmarks — pins it in the prompt. */
  mouthOpen: z.boolean().optional(),
});

// Gemini 2.5 Flash Image ("Nano Banana") — instruction-based image editing with
// strong identity preservation. Unlike masked SDXL inpaint, region control comes
// from the prompt ("change only the lips"), and it doesn't black out faces.
const MODEL = "gemini-2.5-flash-image";
const API_KEY =
  process.env.GEMINI_API_KEY ?? process.env.GOOGLE_GENERATIVE_AI_API_KEY;
// Built once at module load (the handler short-circuits when API_KEY is unset),
// rather than reconstructing the client on every request.
const google = createGoogleGenerativeAI({ apiKey: API_KEY ?? "" });

export async function POST(req: Request) {
  let body;
  try {
    body = bodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  // Combined front (areas) · single-area (clinician tool, not yet wired up).
  let prompt: string;
  if (body.areas?.length) {
    prompt = buildCombinedPrompt(body.areas, body.mouthOpen);
  } else if (body.area) {
    prompt = buildPrompt(body.area, body.look ?? DEFAULT_LOOK, body.mouthOpen);
  } else {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  // Dev/test mock: echo the source photo so the UI flow (and the e2e) is fully
  // testable without paying for image-gen. An explicit MOCK_SIMULATE forces this
  // even when a key IS configured — matches MOCK_ANALYZE — so tests never make
  // real paid calls just because .env.local has a key. Never in production.
  if (process.env.MOCK_SIMULATE && process.env.NODE_ENV !== "production") {
    await new Promise((r) => setTimeout(r, 900));
    return NextResponse.json({ image: body.image, mock: true });
  }

  // No key configured: tell the client to fall back to the markers-only read.
  if (!API_KEY) {
    return NextResponse.json({ fallback: true });
  }

  try {
    const result = await generateText({
      model: google(MODEL),
      providerOptions: { google: { responseModalities: ["IMAGE"] } },
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image", image: body.image },
          ],
        },
      ],
    });

    const image = result.files.find((f) => f.mediaType.startsWith("image/"));
    // No image back usually means a safety refusal — fall back gracefully
    // (never surface a blank/black box to the patient).
    if (!image) {
      return NextResponse.json({ fallback: true });
    }

    // Return as a data URL rather than a public URL to a modified face (privacy).
    return NextResponse.json({
      image: `data:${image.mediaType};base64,${image.base64}`,
    });
  } catch (err) {
    // Log only the message — never the image payload.
    console.error(
      "[simulate] failed, falling back:",
      err instanceof Error ? err.message : String(err),
    );
    return NextResponse.json({ fallback: true });
  }
}
