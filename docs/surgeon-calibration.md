# Surgeon calibration — Visage

A quick list to skim and correct. We built sensible defaults from standard
ranges; just flag what's off — most are one-line confirms. **Why it matters:** the
app can *render* "fuller lips" but doesn't know how much real filler moves tissue,
in which direction, or where "overdone" begins. That's what we need from you.

A few items are *our* product choices we're only sanity-checking — marked
**(our call)**. Everything else is genuinely clinical.

## The one big ask

A few real **before/after photos at known amounts** (e.g. "1 mL lower lip"),
anonymized. Everything else we can approximate — this we can't.

---

## 1. The read — do these flag-lines look right?

We flag a feature for discussion when a proportion crosses a line:

- Facial thirds ~33% each — flag lower third if `< 0.30` or `> 0.36`
- Lip ratio (lower:upper) ~1.6 — flag if `< 1.3` or `> 2.0`
- Jaw-to-cheekbone ~0.70–0.75 — flag if `< 0.68` or `> 0.80`
- Asymmetry — flag above index `0.08`. Right trigger, and are mouth / eye / jaw
  the right points to measure it?

What do you notice first on a face, and what do beginners most often get wrong?

---

## 2. The preview — what we show, and how much

We render the before/after two ways, and they calibrate **differently**:

- **Front photo → AI** — qualitative. We can't dial millimetres; we tune the
  prompt *wording* (how "fuller," how "subtle"). We need your **eye**, not a number.
- **Profile photo → geometric warp** — real **% of face height**, calibratable.
  We need your **numbers**.

### Front (AI) — does each read as a natural ~1-syringe result? Where's "overdone"?

- **Lips** (our wedge) — fuller, and should it favor the **lower lip**? Overdone =
  lost cupid's bow / "duck."
- **Cheeks** — "softly lifted midface" the right amount? Overdone = "pillow."
- **Nasolabial + marionette folds** — we *soften, never erase* (a creaseless face
  reads fake). Right instinct, and how much softening is natural?
- **Chin / jaw on the front** — kept **subtle** (real projection shows in profile,
  not head-on). Confirm the front shouldn't show a dramatic chin change.

### Profile (warp) — what % of face height is a *natural* projection? Where's "overdone"?

- **Chin** — forward projection (placeholder **~5%**)
- **Jawline / pre-jowl** — out to define the angle (placeholder **~3.8%**)
- **Nose** (non-surgical) — dorsum/tip refinement, kept smallest (placeholder
  **~2.2%**). Conservative enough?
- **Direction** — we push forward along the sagittal axis. Right, or should the
  chin drop / the jaw flare more?

### Discuss-only — never simulated

We flag but don't render **under-eye**, **temples** (subtle/high-risk), and the
**nose head-on** (its real change is in profile, and it's the highest-risk area).
Right to leave these out? Anything we should *never* simulate even in profile?

---

## 3. Product calls we're sanity-checking *(our call)*

- **No doses shown to patients** — a number reads as a prescription. Ever
  appropriate to give a vague sense of scale?
- **3-area cap on the read** — for restraint. Does that risk leaving something
  important out?
- **Profile photo nudged** when they mention jaw / chin / nose — add lips/cheeks?
- **Front-photo head-turn limit** before the read gets unreliable — too strict /
  loose?
- **Gender → look** (woman = softer, man = stronger) — right clinical lean, and
  what should each direction actually *treat*?
- **Tailoring by age / goal** — a couple of concrete examples?

---

## 4. For the *future* clinician tool — per-area mL

Not live yet (the patient preview is qualitative). When we build the injector's
per-area, per-amount dialer, these are the placeholder amounts (subtle / natural /
fuller) — correct anything off:

- **Lips** 0.5 / 1 / 1.5 · **Chin** 0.5 / 1 / 2 · **Jawline** 1 / 2 / 4
- **Cheeks** 0.5 / 1 / 2 · **Nasolabial** 0.5 / 1 / 1.5 (per side) ·
  **Marionette** 0.5 / 1 / 1.5 (per side)

---

*Fix what's wrong, ignore what's fine. Code pointers: front wording in
`src/lib/simulation.ts` (`AREA_EDIT`); profile magnitudes in `src/lib/warp.ts`
(`AREA_WARP`).*
