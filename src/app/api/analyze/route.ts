import { NextResponse } from "next/server";
import { z } from "zod";
import { measurementsSchema } from "@/lib/measurements-schema";
import { intakeSchema } from "@/lib/intake-schema";
import { baselineAssessment } from "@/lib/baseline";
import { analyzeFace } from "@/lib/ai";

export const runtime = "nodejs";
export const maxDuration = 60;

const bodySchema = z.object({
  measurements: measurementsSchema,
  intake: intakeSchema.optional(),
  /** One entry per provided angle; base64 is raw (no data: prefix). */
  images: z
    .array(
      z.object({
        view: z.enum(["front", "profile", "threequarter"]),
        base64: z.string().min(1),
      }),
    )
    .min(1)
    .max(5),
});

export async function POST(req: Request) {
  let parsed;
  try {
    parsed = bodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const baseline = baselineAssessment(parsed.measurements, parsed.intake);
  const { assessment, source } = await analyzeFace({
    measurements: parsed.measurements,
    baseline,
    images: parsed.images,
    intake: parsed.intake,
  });

  return NextResponse.json({ assessment, source });
}
