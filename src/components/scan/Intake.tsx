"use client";

import { useState } from "react";
import {
  GENDER_OPTIONS,
  GENDER_LABELS,
  AGE_OPTIONS,
  lookFromGender,
  type Gender,
  type Intake as IntakeData,
} from "@/lib/intake-schema";

interface Props {
  onSubmit: (intake: IntakeData) => void;
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full border px-3.5 py-1.5 text-sm transition-colors ${
        active
          ? "border-[var(--accent)] bg-[var(--accent)]/10"
          : "border-neutral-300 hover:border-neutral-400"
      }`}
    >
      {children}
    </button>
  );
}

/**
 * Minimal patient intake (surgeon's direction): gender, age, and one free-text
 * box. That's enough to personalize the read — we don't make them pick areas or
 * fill a form. The AI suggests every relevant area regardless of what they type.
 */
export function Intake({ onSubmit }: Props) {
  const [gender, setGender] = useState<Gender>();
  const [age, setAge] = useState<IntakeData["age"]>();
  const [concern, setConcern] = useState("");

  const submit = () =>
    onSubmit({
      gender,
      age,
      concern: concern.trim() || undefined,
      // Derive the aesthetic direction the read reasons with from gender.
      look: lookFromGender(gender),
      goals: [],
    });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-6 rounded-3xl border border-border bg-surface p-6 shadow-sm sm:p-8">
        <div>
          <h2 className="font-display text-xl font-semibold">A couple of quick things</h2>
          <p className="mt-1 text-sm text-neutral-500">
            Just enough to make your read personal. All optional.
          </p>
        </div>

        <Field label="You are…">
          <div className="flex flex-wrap gap-2">
            {GENDER_OPTIONS.map((g) => (
              <Chip key={g} active={gender === g} onClick={() => setGender(gender === g ? undefined : g)}>
                {GENDER_LABELS[g]}
              </Chip>
            ))}
          </div>
        </Field>

        <Field label="Age">
          <div className="flex flex-wrap gap-2">
            {AGE_OPTIONS.map((a) => (
              <Chip key={a} active={age === a} onClick={() => setAge(age === a ? undefined : a)}>
                {a}
              </Chip>
            ))}
          </div>
        </Field>

        <Field label="What would you like to improve?">
          <textarea
            value={concern}
            maxLength={300}
            onChange={(e) => setConcern(e.target.value)}
            rows={3}
            placeholder="In your words — e.g. “I look tired,” “fuller lips,” “a sharper jaw.”"
            className="w-full rounded-lg border border-neutral-300 px-3 py-2.5 text-sm leading-relaxed transition-colors focus:border-[var(--accent)] focus:outline-none"
          />
        </Field>
      </div>

      <div className="flex flex-col gap-3">
        <button
          onClick={submit}
          className="rounded-full bg-foreground px-7 py-4 font-medium text-background shadow-sm transition-transform active:scale-[0.99]"
        >
          Continue
        </button>
        <button
          onClick={() => onSubmit({ goals: [] })}
          className="text-sm text-neutral-400 underline-offset-2 hover:text-neutral-600 hover:underline"
        >
          Skip — just show me my read
        </button>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-medium text-neutral-600">{label}</label>
      {children}
    </div>
  );
}
