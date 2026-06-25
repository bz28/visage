import { NextResponse } from "next/server";
import { leadSchema, saveLead } from "@/lib/leads";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let lead;
  try {
    lead = leadSchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  try {
    await saveLead(lead);
  } catch (err) {
    // Log only the message — never the raw error: a Neon/Resend failure can
    // attach request context (the recipient, the failing row) that carries the
    // patient's name/contact. Matches ai.ts + simulate/route.ts (privacy invariant).
    console.error(
      "[api/leads] failed to save lead:",
      err instanceof Error ? err.message : String(err),
    );
    return NextResponse.json({ error: "Could not save" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
