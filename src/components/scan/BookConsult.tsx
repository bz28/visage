"use client";

import { useState } from "react";
import { CLINIC } from "@/lib/clinic";
import { AREA_LABELS } from "@/lib/assessment-schema";

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

  async function submit(e: React.FormEvent) {
    e.preventDefault();
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
      <div className="flex flex-col items-center gap-4 py-8 text-center">
        <h2 className="text-xl font-semibold">You&apos;re all set</h2>
        <p className="max-w-xs text-sm text-neutral-600">
          {CLINIC.name} will reach out to confirm your consultation. {CLINIC.bookingNote}
        </p>
        <button
          onClick={onDone}
          className="mt-2 rounded-full border border-neutral-300 px-6 py-2.5 font-medium"
        >
          Start over
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <div>
        <h2 className="text-xl font-semibold">Book with {CLINIC.name}</h2>
        <p className="mt-1 text-sm text-neutral-500">{CLINIC.bookingNote}</p>
      </div>

      {interests.length > 0 && (
        <p className="text-sm text-neutral-500">
          Interested in:{" "}
          <span className="text-neutral-700">
            {interests.map((i) => AREA_LABELS[i as keyof typeof AREA_LABELS] ?? i).join(", ")}
          </span>
        </p>
      )}

      <label className="flex flex-col gap-1 text-sm">
        Name
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="rounded-lg border border-neutral-300 px-3 py-2.5"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Email or phone
        <input
          required
          value={contact}
          onChange={(e) => setContact(e.target.value)}
          className="rounded-lg border border-neutral-300 px-3 py-2.5"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Anything you&apos;d like them to know (optional)
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          className="rounded-lg border border-neutral-300 px-3 py-2.5"
        />
      </label>

      {status === "error" && (
        <p className="text-sm text-red-600">
          Something went wrong — please try again.
        </p>
      )}

      <button
        type="submit"
        disabled={status === "saving"}
        className="rounded-full bg-foreground px-7 py-3 font-medium text-background disabled:opacity-50"
      >
        {status === "saving" ? "Sending…" : "Request consultation"}
      </button>
    </form>
  );
}
