import { NextResponse } from "next/server";
import { z } from "zod";
import { measurementsSchema } from "@/lib/measurements-schema";
import { intakeSchema } from "@/lib/intake-schema";
import { baselineAssessment } from "@/lib/baseline";
import { analyzeFace } from "@/lib/ai";
import { MOCK_ASSESSMENT } from "@/lib/mock-assessment";

export const runtime = "nodejs";
export const maxDuration = 60;

const bodySchema = z.object({
  measurements: measurementsSchema,
  intake: intakeSchema.optional(),
  /** One entry per provided angle; base64 is raw (no data: prefix). */
  images: z
    .array(
      z.object({
        view: z.enum(["front", "profile"]),
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

  // Dev-only escape hatch: skip the paid vision call and return canned data so
  // UI work on the result/book screens is instant and free. Double-guarded so a
  // leaked env var can never mock a real (production) read.
  if (process.env.MOCK_ANALYZE && process.env.NODE_ENV !== "production") {
    return NextResponse.json({ assessment: MOCK_ASSESSMENT, source: "mock" });
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
