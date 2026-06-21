# Surgeon input — calibrating the deterministic layer & the AI read

Purpose: questions for a practicing injector/plastic surgeon whose answers we
**don't have or aren't confident about**. Their input turns guesses into a
clinically-grounded simulation — the part that differentiates us from "an LLM
that makes lips bigger."

Each question lists **why we need it** and **what we'd change** with the answer.
The three places an answer can land:
- **Warp** = the deterministic geometry layer (phase 2) — how far/which way tissue moves; lives in warp code + documented mL constants.
- **Read** = the AI assessment — `src/lib/ai.ts` (system prompt), `src/lib/baseline.ts` (rules), `src/lib/measurements.ts` (targets), `src/lib/assessment-schema.ts` (area list).
- **Prompt** = the image-gen prompts/strengths per area & look in the new `/api/simulate` (what we're building now).

Confidence: 🔴 we're guessing · 🟡 textbook default, want confirmation · 🟢 sanity-check only.

---

## A. Calibrating the simulation

**0. 🔴 Reference before/afters at known amounts** (e.g. "1 mL in the lips"), even anonymized.
→ *Why:* it's ground truth. *Change:* we measure real pixel-movement per mL from the photos and set the **Warp** displacement-per-mL constants directly, instead of estimating. Highest-leverage answer here.

### Lips (first wedge)
**1. 🔴 What do subtle / natural / fuller mean in mL?** (placeholder ~0.5 / ~1 / ~1.5–2)
→ *Why:* defines our 3 presets. *Change:* sets the strength of each **Prompt** now, and the **Warp** magnitude per preset later.

**2. 🔴 When you add ~1 mL, where does the shape change most** (lower body, upper body, border, cupid's bow, corners), and the upper-vs-lower split?
→ *Why:* a lip isn't one blob. *Change:* tells the **Warp** which landmark points to move and how to weight them (e.g. more displacement on lower-lip points); also sharpens the **Prompt** ("fuller lower lip").

**3. 🟡 What upper:lower ratio do you aim for, and does it shift by look/heritage?** (we use lower ≈ 1.6× upper)
→ *Why:* it's the core aesthetic target. *Change:* sets the relative upper/lower movement in the **Warp**, and confirms/edits the lip-ratio target in the **Read** (`baseline.ts`/`measurements.ts`).

**4. 🔴 Does the lip get taller, roll outward, or project forward — and what shows head-on vs. only in profile?**
→ *Why:* the warp needs a direction, not just an amount. *Change:* sets the **Warp** movement vectors, and tells us whether a front photo suffices or we need a profile.

**5. 🟡 Tell-tale signs of "overdone"** (lost cupid's bow, a "ledge," product above the border)?
→ *Why:* "Fuller" must stop before this. *Change:* caps the max **Warp** magnitude, and adds a guardrail to the **Prompt** and the **Read** voice ("never overdone").

**6. 🟡 Show the settled (~2-week) result, not the swollen day-of look?**
→ *Why:* sets the right expectation. *Change:* a target note in the **Prompt** and the on-screen **copy**.

### Chin
**7. 🔴 Typical amount (mL), and what reads front vs. only in profile (projection)? Require a side photo?**
→ *Why:* chin's main effect is projection, which front photos can't show. *Change:* decides whether chin sim **requires a profile capture** + sets the chin **Warp** amount.

**8. 🔴 From the front, does the chin get longer, wider, or more defined/pointed?**
→ *Why:* defines the only change we can render head-on. *Change:* chin **Warp** direction + the chin **Prompt**.

### Cheeks / midface
**9. 🔴 Where's the apex/injection point, which way does volume lift (vector), and amount per side?**
→ *Why:* a cheek lift is directional. *Change:* sets where the cheek **Warp** originates and pushes, and the inpaint **mask** placement.

**10. 🔴 Natural "lifted" cheek vs. over-filled "pillow," from the front?**
→ *Why:* the overdone line for cheeks. *Change:* caps cheek **Warp** magnitude + a **Prompt** guardrail.

### General
**11. 🟡 How much does the right amount vary by age, skin, and heritage — and how do we honor identity, not flatten it?**
→ *Why:* one-size amounts are wrong and risk erasing identity. *Change:* lets intake (age/heritage) modulate **Warp** magnitude/**Prompt**, and strengthens the identity-preservation rules in the **Read**.

**12. 🔴 Which areas should we never simulate from a single front photo** because it'd mislead?
→ *Why:* protects trust + our legal footing. *Change:* gates which areas the before/after module renders at all from a front photo.

---

## B. Improving the AI read

**13. 🟡 Is our area list right** (lips, chin, jawline, cheeks, under-eye, temples)? Missing any (nasolabial folds, marionette lines, tear trough, masseter, nose)?
→ *Why:* we can only discuss areas we list. *Change:* edits `AREA_KEYS`/`AREA_LABELS` (`assessment-schema.ts`) + the area list in the **Read** system prompt.

**14. 🟡 Are our measurement targets sound** (thirds ≈ 33% each, lip lower:upper ≈ 1.6, jaw-to-cheekbone ≈ 0.70–0.75)?
→ *Why:* these drive every baseline call. *Change:* updates the numeric targets in `measurements.ts`/`baseline.ts` (**Read**).

**15. 🔴 What do you notice first on a new face, and in what order?**
→ *Why:* expert reads prioritize; ours doesn't yet. *Change:* encodes a reasoning/priority order into the **Read** system prompt.

**16. 🔴 What do amateurs over- or under-call? Where do automated reads get it wrong?**
→ *Why:* avoid the classic mistakes. *Change:* adds explicit "avoid these" guidance to the **Read** (system prompt + baseline rules).

**17. 🟡 How should confidence drop with fewer/tilted/poorly-lit photos — and when should you not call an area at all?**
→ *Why:* honest confidence builds trust. *Change:* refines the confidence rules in the **Read** (system prompt + baseline confidence logic).

**18. 🟢 Anything in the voice that builds patient trust — or makes a clinician cringe?**
→ *Why:* tone is the product. *Change:* tunes the Voice section of the **Read** system prompt.

**19. 🔴 How do you tailor to a stated goal (softer/feminine vs. stronger/masculine) and to age — concrete examples?**
→ *Why:* tailoring is what makes it feel personal, not generic. *Change:* strengthens the "tailor to the person" rules + gender-aware logic in the **Read** (`ai.ts` + `baseline.ts`).

---

## How we'll use the answers
- **A** → calibration constants for the warp (documented in code), inpaint prompt/strength tuning, and whether chin/cheeks need a profile photo.
- **B** → concrete edits to the `ai.ts` system prompt, `baseline.ts` rules, `measurements.ts` targets, and the area list.
- **0 / reference photos** → measure real displacement-per-mL directly (the gold).
