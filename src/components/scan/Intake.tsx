"use client";

import { useState } from "react";
import {
  GOAL_OPTIONS,
  LOOK_OPTIONS,
  LOOK_LABELS,
  AGE_OPTIONS,
  BUDGET_OPTIONS,
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

export function Intake({ onSubmit }: Props) {
  const [goals, setGoals] = useState<string[]>([]);
  const [look, setLook] = useState<IntakeData["look"]>();
  const [age, setAge] = useState<IntakeData["age"]>();
  const [budget, setBudget] = useState<IntakeData["budget"]>();
  const [heritage, setHeritage] = useState("");
  const [priorTreatments, setPriorTreatments] = useState("");

  const toggleGoal = (g: string) =>
    setGoals((prev) =>
      prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g],
    );

  const submit = () =>
    onSubmit({
      goals,
      look,
      age,
      budget,
      heritage: heritage.trim() || undefined,
      priorTreatments: priorTreatments.trim() || undefined,
    });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-6 rounded-3xl border border-border bg-surface p-6 shadow-sm sm:p-8">
      <div>
        <h2 className="font-display text-xl font-semibold">
          A few quick questions
        </h2>
        <p className="mt-1 text-sm text-neutral-500">
          So your read fits you — not a generic ideal. Every field is optional.
        </p>
      </div>

      <Field label="What would you love to improve?">
        <div className="flex flex-wrap gap-2">
          {GOAL_OPTIONS.map((g) => (
            <Chip key={g} active={goals.includes(g)} onClick={() => toggleGoal(g)}>
              {g}
            </Chip>
          ))}
        </div>
      </Field>

      <Field label="The look you're going for">
        <div className="flex flex-wrap gap-2">
          {LOOK_OPTIONS.map((l) => (
            <Chip key={l} active={look === l} onClick={() => setLook(look === l ? undefined : l)}>
              {LOOK_LABELS[l]}
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

      <Field label="What are you after?">
        <div className="flex flex-wrap gap-2">
          {BUDGET_OPTIONS.map((b) => (
            <Chip key={b} active={budget === b} onClick={() => setBudget(budget === b ? undefined : b)}>
              {b}
            </Chip>
          ))}
        </div>
      </Field>

      <Field label="Heritage / background (optional)">
        <input
          value={heritage}
          maxLength={60}
          onChange={(e) => setHeritage(e.target.value)}
          placeholder="Helps us tailor to your features"
          className="w-full rounded-lg border border-neutral-300 px-3 py-2.5 text-sm transition-colors focus:border-[var(--accent)] focus:outline-none"
        />
      </Field>

      <Field label="Any past filler or tox? (optional)">
        <input
          value={priorTreatments}
          maxLength={300}
          onChange={(e) => setPriorTreatments(e.target.value)}
          placeholder="e.g. lip filler last year"
          className="w-full rounded-lg border border-neutral-300 px-3 py-2.5 text-sm transition-colors focus:border-[var(--accent)] focus:outline-none"
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
