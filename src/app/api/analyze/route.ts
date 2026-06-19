import { NextResponse } from "next/server";
import { z } from "zod";
import { measurementsSchema } from "@/lib/measurements-schema";
import { baselineAssessment } from "@/lib/baseline";
import { analyzeFace } from "@/lib/ai";

export const runtime = "nodejs";
export const maxDuration = 60;

const bodySchema = z.object({
  measurements: measurementsSchema,
  /** Raw base64 (no data: prefix). Optional — omit to reason from numbers only. */
  imageBase64: z.string().min(1).optional(),
});

export async function POST(req: Request) {
  let parsed;
  try {
    parsed = bodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const baseline = baselineAssessment(parsed.measurements);
  const { assessment, source } = await analyzeFace(
    parsed.measurements,
    baseline,
    parsed.imageBase64,
  );

  return NextResponse.json({ assessment, source });
}
