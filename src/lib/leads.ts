import "server-only";
import { z } from "zod";
import { neon } from "@neondatabase/serverless";
import { Resend } from "resend";
import { CLINIC } from "./clinic";

export const leadSchema = z.object({
  name: z.string().min(1).max(120),
  contact: z.string().min(3).max(200), // email or phone
  /** Area keys the patient was interested in. */
  interests: z.array(z.string()).max(10).default([]),
  note: z.string().max(1000).optional(),
});

export type Lead = z.infer<typeof leadSchema>;

let schemaReady = false;

/**
 * Persist a lead and notify the clinic. Both the DB and email are optional so
 * the app runs locally before provisioning — we log a warning and still
 * succeed. We never log the contact details (privacy; see CLAUDE.md).
 */
export async function saveLead(lead: Lead): Promise<void> {
  const dbUrl = process.env.DATABASE_URL;
  if (dbUrl) {
    const sql = neon(dbUrl);
    if (!schemaReady) {
      await sql`
        CREATE TABLE IF NOT EXISTS leads (
          id BIGSERIAL PRIMARY KEY,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          clinic TEXT NOT NULL,
          name TEXT NOT NULL,
          contact TEXT NOT NULL,
          interests TEXT[] NOT NULL DEFAULT '{}',
          note TEXT
        )`;
      schemaReady = true;
    }
    await sql`
      INSERT INTO leads (clinic, name, contact, interests, note)
      VALUES (${CLINIC.name}, ${lead.name}, ${lead.contact}, ${lead.interests}, ${
        lead.note ?? null
      })`;
  } else {
    console.warn("[saveLead] DATABASE_URL not set — lead not persisted.");
  }

  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey) {
    const resend = new Resend(resendKey);
    await resend.emails.send({
      from: "Visage <leads@visage.app>",
      to: CLINIC.consultEmail,
      subject: `New consult request — ${lead.name}`,
      text: `New consultation request via Visage.

Name: ${lead.name}
Contact: ${lead.contact}
Interested in: ${lead.interests.join(", ") || "—"}
Note: ${lead.note ?? "—"}`,
    });
  } else {
    console.warn("[saveLead] RESEND_API_KEY not set — clinic not emailed.");
  }
}
