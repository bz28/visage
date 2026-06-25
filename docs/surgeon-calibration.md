# Surgeon calibration — Visage

A short list of questions for a practicing injector. Your answers turn our
defaults (built from standard ranges) into a clinically-grounded read + preview
— the part that makes this more than "an LLM that makes lips bigger."

**The mental model:** the AI is the **renderer**; your input is the **ground
truth** that makes a preview *accurate*, not just *plausible*. The model knows
what "fuller lips" looks like in the abstract; it does not know how much a real
treatment moves tissue, in which direction, or where "overdone" begins. Closing
that gap is both the safety (we must never over-promise) and the moat.

**Confidence on each item:** 🔴 we're guessing · 🟡 textbook default, confirm ·
🟢 sanity-check only.

**Where each answer lands:** the **READ** (our AI assessment — `ai.ts`,
`measurements.ts`, `baseline.ts`) or the **PREVIEW** (the before/after image — a
Gemini instruction-edit composited back over the original; `simulation.ts`,
`face-regions.ts`). There is no deterministic geometry "warp" yet — today the
preview is prompt-driven, so calibration sharpens the prompt + the read.

---

## 0. The one ask that beats all others 🔴

**Reference before/afters at known amounts** (e.g. "1.0 mL lower lip"), even a
handful, anonymized. We'd measure real change directly from them instead of
estimating — the single highest-leverage input for every area at once.

---

## 1. The read — targets, flag-lines, and method

We flag a feature when a landmark ratio crosses a line. Please sanity-check both
the ideal and the lines (all in `measurements.ts`):

| Metric | Ideal | Flag low | Flag high | Conf |
|---|---|---|---|---|
| Facial thirds (each) | ~33% | lower third < 0.30 (short) | > 0.36 (long) | 🟡 |
| Lip ratio (lower:upper) | ~1.6 | < 1.3 (thin) | > 2.0 (bottom-heavy) | 🟡 |
| Jaw-to-cheekbone width | 0.70–0.75 | < 0.68 (narrow) | > 0.80 (wide) | 🟡 |
| Asymmetry index | 0 | — | > 0.08 (worth noting) | 🔴 |

1. 🔴 **Asymmetry method** — we average the left/right offsets of mouth-corner,
   outer-eye, and jaw-angle from the facial midline (nasion). Are those the right
   signals, and is 0.08 a sensible "worth mentioning" line?
2. 🟡 **Scale** — we estimate real size from an assumed **63 mm** average
   interpupillary distance and only use it for a vague size sense. OK to keep
   (and to caveat as rough)?
3. 🔴 **Reading order** — what do you notice first on a new face, and in what
   order? (We'd encode it as the read's priority.)
4. 🔴 **Common mistakes** — what do amateurs / automated reads over- or
   under-call?
5. 🟡 **Confidence** — how should confidence drop with fewer / tilted / poorly-lit
   photos, and when should you not call an area at all?
6. 🟡 **Restraint** — we surface **at most 3 areas** (the most relevant). Right
   call, or does that risk omitting something important?
7. 🟢 **Voice** — anything in the on-screen wording that builds trust, or that
   makes a clinician cringe?

---

## 2. Per-area calibration — amount, direction, overdone

For each area: the amount (mL, subtle/natural/fuller — `AREA_AMOUNTS`), the
direction of change (`AREA_EDIT` prompt wording), and the "overdone" line (the
hard cap). All 🟡 unless noted.

| Area | Amount (sub/nat/full) | Direction we render | Overdone tell |
|---|---|---|---|
| Lips | 0.5 / 1.0 / 1.5 | fullness, lower-lip weighted | lost cupid's bow, "ledge", product above the border |
| Chin | 0.5 / 1.0 / 2.0 | more defined, balances lower third | — |
| Jawline | 1.0 / 2.0 / 4.0 (total) | sharper, cleaner angle | — |
| Cheeks | 0.5 / 1.0 / 2.0 (total) | softly lifted midface | over-filled "pillow" |
| Nasolabial | 0.5 / 1.0 / 1.5 (per side) | soften with support, **never erase** | flattened midface / "shelf" |
| Marionette | 0.5 / 1.0 / 1.5 (per side) | soften + lightly lift corners | heavy / distorted lower face |

8. 🔴 **Amounts + direction** — correct the table above per area: the realistic
   mL, where the volume actually goes, and what shows head-on vs. only in profile.
9. 🟡 **Overdone line** — fill the blanks (chin, jawline) and confirm the rest;
   this becomes the cap the preview must not cross.
10. 🟡 **Lips** — upper:lower split you aim for, and does the ~1.6 target shift by
    look or heritage?

---

## 3. What can we honestly show from a front photo?

We only render a before/after for some areas; the rest are discuss-only.

| Area | Simulate from front? | Wants a profile? |
|---|---|---|
| Lips, chin, jawline, cheeks, nasolabial, marionette | yes | chin/jaw projection: yes |
| Nose | **no** (discuss only) | yes — and highest-risk (vascular) |
| Under-eye, temples | no (discuss only) | — (high-risk / lateral / often Sculptra) |

11. 🔴 **The gate** — agree with this split? In particular: should we **never**
    simulate the nose from a front photo, and are under-eye/temples right to be
    discuss-only?
12. 🟡 **Profile trigger** — at capture we recommend a side photo when the free
    text mentions **jaw or chin** (keyword match, `Capture.tsx`). Should lips or
    cheeks also trigger it?
13. 🟡 **Head-turn cutoff** — we warn that a front photo reads unreliably past a
    yaw of **0.18** (0 = straight-on; `photo-check.ts` `TILT_MAX`). Too strict /
    too loose?
14. 🟡 **Area list** — is the list complete (lips, chin, jawline, cheeks,
    nasolabial, marionette, nose, under-eye, temples)? Missing anything common
    for a *filler* tool (tear-trough, perioral lines, …)?
15. 🟡 **Asymmetry as an area** — asymmetry is whole-face, but we currently file
    it under "chin" as a placeholder. Should it be its own area, or hosted
    elsewhere?
16. 🟡 **Sense of scale** — we deliberately show patients **no** amounts (a dose
    reads as a prescription). Is a vague, education-only "sense of scale" ever
    appropriate to show, or right to omit entirely?

---

## 4. Tailoring

17. 🟡 **Gender → aesthetic** — we map woman → softer/feminine, man →
    stronger/masculine, prefer-not-to-say → balanced, which then biases the read
    (e.g. we don't surface fuller lips for a masculine direction). Sound?
18. 🔴 **By goal + age** — concrete examples of how the right read changes with a
    stated goal (softer vs. stronger) and with age?
19. 🟡 **Identity** — how much does the right amount vary by age / skin /
    heritage, and how do we honor identity rather than flatten it? (Note: we
    don't currently collect heritage in the patient intake.)

---

## Appendix

- **Lower-face proportion** (candidate, not yet used) — we also compute
  nose-base→mouth vs. mouth→chin (`lowerFaceRatio`). Is this a useful thing to
  flag, and what's the ideal? If yes, we'd wire it into the read.
- **Keep in sync** — the ideal targets are quoted in two places that must match:
  the verdict thresholds in `measurements.ts` and the prompt wording in `ai.ts`.
