import { NextResponse } from "next/server";
import { z } from "zod";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateText } from "ai";
import { SIMULATABLE, LOOK_KEYS, LOOKS, buildPrompt } from "@/lib/simulation";

export const runtime = "nodejs";
export const maxDuration = 60;

const bodySchema = z.object({
  /** Source photo as a data URL. */
  image: z.string().min(1),
  area: z.enum(SIMULATABLE),
  look: z.enum(LOOK_KEYS),
});

// Gemini 2.5 Flash Image ("Nano Banana") — instruction-based image editing with
// strong identity preservation. Unlike masked SDXL inpaint, region control comes
// from the prompt ("change only the lips"), and it doesn't black out faces.
const MODEL = "gemini-2.5-flash-image";
const API_KEY =
  process.env.GEMINI_API_KEY ?? process.env.GOOGLE_GENERATIVE_AI_API_KEY;

export async function POST(req: Request) {
  let body;
  try {
    body = bodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const look = LOOKS.find((l) => l.key === body.look)!;
  const prompt = buildPrompt(body.area, look.ml, look.label);

  // Dev mock (no key): echo the original photo so the UI flow is fully testable
  // without paying for / configuring image-gen. Never in production.
  if (
    !API_KEY &&
    process.env.MOCK_SIMULATE &&
    process.env.NODE_ENV !== "production"
  ) {
    await new Promise((r) => setTimeout(r, 900));
    return NextResponse.json({ image: body.image, mock: true });
  }

  // No key configured: tell the client to fall back to the markers-only read.
  if (!API_KEY) {
    return NextResponse.json({ fallback: true });
  }

  try {
    const google = createGoogleGenerativeAI({ apiKey: API_KEY });
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
