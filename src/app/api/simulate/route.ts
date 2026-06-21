import { NextResponse } from "next/server";
import { z } from "zod";
import {
  SIMULATABLE,
  LOOK_KEYS,
  LOOKS,
  buildPrompt,
} from "@/lib/simulation";

export const runtime = "nodejs";
export const maxDuration = 60;

const bodySchema = z.object({
  /** Source photo + mask, both as data URLs. */
  image: z.string().min(1),
  mask: z.string().min(1),
  area: z.enum(SIMULATABLE),
  look: z.enum(LOOK_KEYS),
});

// fal.ai inpainting model. The exact model + params are confirmed/tuned on the
// first real run with a key (which is also our realism-calibration pass).
const FAL_MODEL = "fal-ai/flux-general/inpainting";

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
    !process.env.FAL_KEY &&
    process.env.MOCK_SIMULATE &&
    process.env.NODE_ENV !== "production"
  ) {
    await new Promise((r) => setTimeout(r, 900));
    return NextResponse.json({ image: body.image, mock: true });
  }

  // No key configured: tell the client to fall back to the markers-only read.
  if (!process.env.FAL_KEY) {
    return NextResponse.json({ fallback: true });
  }

  try {
    const res = await fetch(`https://fal.run/${FAL_MODEL}`, {
      method: "POST",
      headers: {
        Authorization: `Key ${process.env.FAL_KEY}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        image_url: body.image,
        mask_url: body.mask,
        prompt,
        strength: look.strength,
        num_inference_steps: 28,
      }),
    });
    if (!res.ok) throw new Error(`fal ${res.status}`);
    const data = await res.json();
    const url: string | undefined =
      data?.images?.[0]?.url ?? data?.image?.url;
    if (!url) throw new Error("no image in response");

    // Return the result as a data URL rather than handing the client a public
    // URL to a modified face photo (privacy).
    const img = await fetch(url);
    const buf = Buffer.from(await img.arrayBuffer());
    const mime = img.headers.get("content-type") ?? "image/png";
    return NextResponse.json({
      image: `data:${mime};base64,${buf.toString("base64")}`,
    });
  } catch (err) {
    // Log only the message — never the image/mask payloads.
    console.error(
      "[simulate] failed, falling back:",
      err instanceof Error ? err.message : String(err),
    );
    return NextResponse.json({ fallback: true });
  }
}
