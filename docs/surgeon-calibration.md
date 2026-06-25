# Surgeon calibration — Visage

A quick list to skim and correct. We built sensible defaults from standard
ranges; just flag what's off — most are one-line confirms. **Why it matters:** the
AI can *render* "fuller lips" but doesn't know how much real filler moves tissue,
which direction, or where "overdone" begins. That's what we need from you.

## The one big ask

A few real before/after photos at known amounts (e.g. "1 mL lower lip"),
anonymized. Everything else we can approximate — this we can't.

## The read — do these flag-lines look right?

We flag a feature when a proportion crosses a line:

- Facial thirds ~33% each — flag lower third if `< 0.30` or `> 0.36`
- Lip ratio (lower:upper) ~1.6 — flag if `< 1.3` or `> 2.0`
- Jaw-to-cheekbone ~0.70–0.75 — flag if `< 0.68` or `> 0.80`
- Asymmetry — flag past a small threshold (are mouth / eye / jaw the right points?)

Also: we surface **at most 3 areas** — right call? What do you notice first on a
face, and what do beginners most often get wrong?

## Per area — amount, direction, "overdone"

Correct anything off (mL = subtle / natural / fuller):

- **Lips** 0.5 / 1 / 1.5 — fuller, lower-lip weighted · overdone: lost cupid's bow
- **Chin** 0.5 / 1 / 2 — more defined
- **Jawline** 1 / 2 / 4 — sharper angle
- **Cheeks** 0.5 / 1 / 2 — lifted midface · overdone: "pillow"
- **Nasolabial folds** 0.5 / 1 / 1.5 (per side) — soften, never erase
- **Marionette lines** 0.5 / 1 / 1.5 (per side) — soften, lift corners

Where does "overdone" start for each — and which changes only show in profile?

## What we *show* vs. only *discuss*

We render a front-photo before/after for: **lips, chin, jawline, cheeks,
nasolabial, marionette**. We discuss but don't simulate **nose** (profile +
highest-risk), **under-eye**, **temples** (subtle / risky). Agree? Anything we
should never simulate — or any common filler area we're missing?

## A few specifics

- We show patients **no doses** (reads as a prescription). Ever appropriate to
  give a vague sense of scale?
- We suggest a **profile photo** when they mention jaw or chin — add lips/cheeks?
- Front-photo **head-turn limit** before the read gets unreliable — too strict / loose?
- We map **gender → look** (woman = softer, man = stronger) — sound?
- Tailoring by **age / goal** — a couple of concrete examples?

*Fix what's wrong, ignore what's fine. Code pointers live next to each value if
you want them.*
