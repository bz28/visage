"use client";

import { useState } from "react";
import { CLINIC } from "@/lib/clinic";
import { AREA_LABELS } from "@/lib/assessment-schema";
import { isValidContact } from "@/lib/contact";
import { Button } from "@/components/ui/Button";

interface Props {
  interests: string[];
  onDone: () => void;
}

export function BookConsult({ interests, onDone }: Props) {
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [note, setNote] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "done" | "error">(
    "idle",
  );
  // Inline "email or phone" feedback, shown only after a failed submit attempt
  // so we don't nag while they're still typing.
  const [contactError, setContactError] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValidContact(contact)) {
      setContactError(true);
      return;
    }
    setContactError(false);
    setStatus("saving");
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, contact, interests, note }),
      });
      if (!res.ok) throw new Error();
      setStatus("done");
    } catch {
      setStatus("error");
    }
  }

  if (status === "done") {
    return (
      <div className="flex flex-col items-center gap-4 rounded-3xl border border-border bg-surface p-8 py-12 text-center shadow-card">
        <div className="flex size-14 items-center justify-center rounded-full bg-[var(--accent)]/10 text-[var(--accent)]">
          <svg
            viewBox="0 0 24 24"
            className="size-7"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="m4.5 12.75 6 6 9-13.5"
            />
          </svg>
        </div>
        <h2 className="font-display text-2xl font-semibold">
          You&apos;re all set
        </h2>
        <p className="max-w-sm text-sm leading-relaxed text-ink-600">
          Your request is in. {CLINIC.bookingNote} Keep an eye on your inbox or
          phone.
        </p>
        <button
          onClick={onDone}
          className="mt-2 rounded-full border border-ink-300 px-6 py-2.5 font-medium transition-colors hover:border-ink-400"
        >
          Start over
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="flex flex-col gap-5 rounded-3xl border border-border bg-surface p-6 shadow-card sm:p-8"
    >
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--accent)]">
          Last step
        </p>
        <h2 className="mt-2 font-display text-2xl font-semibold">
          Book with {CLINIC.name}
        </h2>
        <p className="mt-1.5 text-sm leading-relaxed text-ink-500">
          {CLINIC.bookingNote}
        </p>
      </div>

      {interests.length > 0 && (
        <div className="rounded-2xl bg-[var(--accent)]/5 px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-400">
            Ready to talk through at your visit
          </p>
          <p className="mt-1 text-sm text-ink-700">
            {interests
              .map((i) => AREA_LABELS[i as keyof typeof AREA_LABELS] ?? i)
              .join(" · ")}
          </p>
        </div>
      )}

      <label className="flex flex-col gap-1.5 text-sm font-medium text-ink-600">
        Name
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="rounded-lg border border-ink-300 px-3 py-2.5 font-normal text-foreground transition-colors focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/25"
        />
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-medium text-ink-600">
        Email or phone
        <input
          required
          value={contact}
          onChange={(e) => {
            setContact(e.target.value);
            if (contactError) setContactError(false);
          }}
          aria-invalid={contactError}
          placeholder="you@email.com or (555) 555-5555"
          className={`rounded-lg border px-3 py-2.5 font-normal text-foreground placeholder:text-ink-400 transition-colors focus:outline-none focus:ring-2 ${
            contactError
              ? "border-red-400 focus:border-red-500 focus:ring-red-500/25"
              : "border-ink-300 focus:border-[var(--accent)] focus:ring-[var(--accent)]/25"
          }`}
        />
        {contactError && (
          <span role="alert" className="text-xs font-normal text-red-600">
            So the clinic can reach you, enter a valid email or phone number.
          </span>
        )}
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-medium text-ink-600">
        Anything you&apos;d like them to know (optional)
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          className="rounded-lg border border-ink-300 px-3 py-2.5 font-normal text-foreground transition-colors focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/25"
        />
      </label>

      {status === "error" && (
        <p role="alert" className="text-sm text-red-600">
          Something went wrong — please try again.
        </p>
      )}

      <Button type="submit" disabled={status === "saving"} className="px-7 py-3.5">
        {status === "saving" ? "Sending…" : "Request consultation"}
      </Button>
      <p className="text-center text-xs leading-relaxed text-ink-400">
        No charge to book. A licensed injector reviews your photos and confirms
        what&apos;s right for you — in person.
      </p>
    </form>
  );
}
