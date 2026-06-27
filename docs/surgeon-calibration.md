# Surgeon calibration — Visage

A quick list to skim and correct. We built sensible defaults from standard
ranges; just flag what's off — most are one-line confirms. **Why it matters:** the
AI can *render* "fuller lips" but doesn't know how much real filler moves tissue,
which direction, or where "overdone" begins. That's what we need from you.

Most of this is genuinely clinical and needs your call. A few items are *our*
product choices we're only sanity-checking — marked **(our call)**.

## The one big ask

A few real before/after photos at known amounts (e.g. "1 mL lower lip"),
anonymized. Everything else we can approximate — this we can't.

## The read — do these flag-lines look right?

We flag a feature when a proportion crosses a line:

- Facial thirds ~33% each — flag lower third if `< 0.30` or `> 0.36`
- Lip ratio (lower:upper) ~1.6 — flag if `< 1.3` or `> 2.0`
- Jaw-to-cheekbone ~0.70–0.75 — flag if `< 0.68` or `> 0.80`
- Asymmetry — we flag above an index of `0.08`. Right trigger, and are mouth /
  eye / jaw the right points to measure it?

Also: what do you notice first on a face, and what do beginners most often get
wrong? *(We cap the read at 3 areas for restraint — **our call**, but say if
that risks leaving something important out.)*

## Per area — amount, direction, "overdone"

The **directions** + "overdone" lines drive what patients see today; the **mL
amounts** feed the upcoming clinician tool (not live yet). Correct anything off
(mL = subtle / natural / fuller):

- **Lips** 0.5 / 1 / 1.5 — fuller, lower-lip weighted · overdone: lost cupid's bow
- **Chin** 0.5 / 1 / 2 — more defined
- **Jawline** 1 / 2 / 4 — sharper angle
- **Cheeks** 0.5 / 1 / 2 — lifted midface · overdone: "pillow"
- **Nasolabial folds** 0.5 / 1 / 1.5 (per side) — soften, never erase
- **Marionette lines** 0.5 / 1 / 1.5 (per side) — soften, lift corners

Where does "overdone" start for each — and which changes only show in profile?

## What we *show* vs. only *discuss*

**Front photo:** we render a before/after for **lips, chin, jawline, cheeks,
nasolabial, marionette**. We discuss but don't simulate **under-eye**, **temples**
(subtle / risky), or the **nose** head-on.

**Profile photo** (if given): we render a before/after for the projection areas —
**chin** (projects forward), **jawline** (sharper angle + pre-jowl), and **nose**
(straighten bridge, ease a hump, support the tip). Are these directions right,
and is the nose conservative enough? Anything we should never simulate even in
profile?

## A few specifics

- We show patients **no doses** (reads as a prescription) — **our call**; ever
  appropriate to give a vague sense of scale?
- We suggest a **profile photo** when they mention jaw / chin / nose — add
  lips/cheeks?
- Front-photo **head-turn limit** before the read gets unreliable — too strict / loose?
- We default **gender → look** (woman = softer, man = stronger) — **our call**;
  but is that the right clinical lean, and what should each direction *treat*?
- Tailoring by **age / goal** — a couple of concrete examples?

## Two things to calibrate (front vs. profile)

The engine renders the **front** photo with AI and the **profile** photo with a
geometric warp (see `docs/simulation-architecture.md`). So there are *two*
calibrations, and they're different in kind:

- **Front = AI prompt strength** (qualitative). We can't dial millimetres here —
  we tune the *wording* (how "fuller," how "subtle"). We need your eye on whether
  the AI's "natural ≈1-syringe result" is right.
- **Profile = warp magnitude** (millimetres). Real numbers, calibratable.

## Profile projection — how *much* (the warp)

The profile before/after is a geometric **warp** (we move the patient's own
pixels forward, calibrated to mm — no AI). The amount per area is my best-guess
placeholder, as a fraction of **face height** (`src/lib/warp.ts`, `AREA_WARP`).
Real numbers, please:

- **Chin** projection — a *natural* (≈1 mL) forward projection is what % of face
  height, roughly? (placeholder ~5%)
- **Jawline / pre-jowl** — how far out to define the angle? (placeholder ~3.8%)
- **Nose** (non-surgical) — dorsum/tip refinement, kept smallest? (placeholder ~2.2%)
- Where does each start to look **overdone** in profile?
- Per-area **direction** — we push forward along the face's sagittal axis; is
  that right, or should chin drop / jaw flare more?

## Front result — how *strong* (the AI prompt)

The front before/after is generative AI, identity-locked to each treated region
(`src/lib/simulation.ts`, `AREA_EDIT` / `buildCombinedPrompt`). The prompt asks
for a "natural dermal-filler result, about one syringe each." We need your eye on
whether that reads right — and where the wording should be dialed:

- **Lips** (our wedge) — does the AI's fuller lip look like a *natural* ~1-syringe
  result, or too much / too little? Should it favor the **lower lip**? Where's the
  line into **overfilled / "duck"**?
- **Cheeks** — is "a softly lifted midface" the right amount, or does it read
  overdone?
- **Nasolabial / marionette folds** — we say *soften, never erase* (a creaseless
  face reads fake). Is that the right instinct, and how much softening is natural?
- **Chin / jaw on the FRONT** — chin filler mainly *projects* (shows in profile),
  so we keep the front change subtle ("more defined, balanced lower face,"
  "sharper jaw angle"). Confirm the front shouldn't show a dramatic chin change.
- **Open vs closed mouth** — we nudge patients to a relaxed closed mouth; confirm
  that's what you'd assess lip filler on.

*Note for us (not the surgeon): the front result was validated on a real key
(`test-face-closed.jpg`) — lips/cheeks/chin/jaw read natural with correct
lighting, no distortion; toggling areas off reverts to the clean original. The
front "calibration" is the prompt wording above; the profile is the mm warp.*

*Fix what's wrong, ignore what's fine. Code pointers live next to each value if
you want them.*
