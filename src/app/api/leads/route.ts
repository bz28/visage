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
    console.error("[api/leads] failed to save lead:", err);
    return NextResponse.json({ error: "Could not save" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
