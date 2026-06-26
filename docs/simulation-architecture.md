# How the simulation works — architecture & philosophy

This is the *why* behind Visage's before/after engine: which technology renders
the change, and why that choice is what makes the product medically credible and
defensible. (For a step-by-step walkthrough of the app, see `how-it-works.md`.)

## The one rule

> **Warp when you're reshaping what's already there. Generate (AI) when you're
> adding what isn't.**

- **Reshaping** = moving the patient's *real* pixels (projection, contour). A
  deterministic geometric **warp** — identity-safe, calibratable, consistent on
  every angle.
- **Adding new material or light** = a fuller lip's sheen, a filled-in shadow,
  smoother skin. This has to be *painted*, so it needs **generative AI**.

Everything below follows from that one rule.

## Geometry vs. AI — and where each is the source of truth

Two engines, each authoritative for a different view (see "The split is by VIEW"
below for the why):

- **The warp is the source of truth on the PROFILE.** We fit a face model
  (MediaPipe: 468 points *with depth* + topology, on-device, free) and move the
  patient's own pixels by a **calibrated displacement** — a function of
  `(area, millimetres, geometry)` the surgeon's before/after photos calibrate
  against (`surgeon-calibration.md`). It's **deterministic** (same input → same
  output), can't change identity (real pixels), and is correct at the angle where
  the AI paste fails.
- **The AI renders the FRONT, contained by the composite.** A fuller lip or a
  lifted cheek is a **lighting** change, and only a generative model can *paint
  new light*. We let it edit, then the **identity-lock composite** pastes only the
  treated regions back onto the original and rejects expression drift — so the AI
  decides the *look* but can't change *identity*. It's **stochastic** (can't be
  dialed to exact mm), so front "calibration" is prompt-strength tuning, not
  millimetres.

**Deterministic** = dial-to-amount, identity-safe, angles agree. **Generative** =
realistic light/texture, but contained — never the unguarded source of truth. The
non-negotiable in both is the **identity lock**: the patient always sees *them*.

## Why not a full 3D render? (the obvious-but-wrong end goal)

A tempting "most accurate" target is: reconstruct a full 3D model of the face,
apply the filler as 3D volume, and **re-render** it back to a 2D image. We
deliberately do **not** do this, because the re-render is exactly where it
fails for *our* product (a photoreal single-photo preview that must look like
**this person**):

1. **It throws away the real photo.** A re-render maps texture + lighting onto a
   mesh and lands in the uncanny/CGI valley — it looks like an avatar, not a
   photo of the patient. Our warp keeps the patient's actual pixels and only
   *moves* them, so the output is photoreal by construction. For a trust-driven
   medical preview, re-rendering is a regression on the metric that matters most.
2. **Single-photo 3D is itself an estimate.** You can't truly recover depth from
   one selfie, so a "3D-accurate" render is built on an approximated model — you
   inherit that error *and* lose photorealism. Tools that do real 3D (Crisalix
   et al.) require multi-photo or a depth scan and target *surgical planning*
   (rotate a model), a different modality from "here's a believable you."
3. **Huge build, worse output.** It's a major ML/graphics effort for a result
   that's likely *less* believable than what we ship today.

What we do instead captures the one real 3D benefit — correct projection
*direction* at any head angle — by being **3D-mesh-informed** (the warp is
driven by MediaPipe's 478-point mesh with z-depth) **without** the re-render.
Full 3D only becomes the goal if the product pivots to an **interactive,
rotatable 3D viewer** with **multi-photo / scan input** — a different product,
not a blocker here. *(Open refinement: we capture per-landmark z but don't yet
use it for true surface-normal warp direction — see the warp.ts header.)*

## The three jobs AI does here

AI isn't one thing. Three distinct kinds, in three roles:

1. **Judgment & language — the vision LLM (Claude).** The "read" (what an
   injector would notice and discuss), understanding the patient's free-text
   concern, the warm education copy, and the future clinician assistant. No
   deterministic substitute — this is expert perception + medical reasoning in
   words. It never touches the image.
2. **Structure — landmark / 3D ML (MediaPipe; later, monocular-depth models).**
   AI, but *not generative* — it fits the 3D model the warp runs on.
3. **Rendering new material — generative AI (Gemini).** Used *surgically and
   identity-locked*, only where reshaping can't do the job (see the map below).

## The split is by VIEW, not just by treatment

The one rule above is true, but real-photo testing taught us the *sharper* cut
is **which view the photo is**, because that decides whether the dominant change
is *lighting* (AI) or *silhouette* (warp):

- **FRONT photo → generative AI + identity-lock composite.** Filler on a front
  face is mostly a **volume + lighting** change — a fuller lip catches new light,
  a lifted cheek gains a highlight, a softened fold fills a shadow. You have to
  **render new light**, which a warp fundamentally can't do (it only drags
  existing pixels, so a "projected" feature keeps its old shading and reads as a
  *shadow that doesn't belong*). The AI paints the new light correctly and is
  robust across faces; the composite pastes only the treated regions back onto
  the original and rejects expression drift. Toggling an area off reverts that
  region to the **clean original pixels** — no residual.
- **PROFILE photo → deterministic warp** (chin / jaw / nose projection). From the
  side, the change is a **silhouette** — pure geometry, dramatic, and the
  generative paste *fails at an angle* (its eye-corner alignment is frontal). The
  warp is the only tool that works here, and it's identity-locked, free, and
  mm-calibratable.

| View → tool | Treatments | Why |
|---|---|---|
| **Front → AI + composite** | lips, cheeks, folds, chin, jaw | Volume + new lighting → must be *rendered*; AI handles soft, variable features and light; a warp can't relight. |
| **Profile → warp** | chin / jaw / nose projection | Silhouette change — real pixels, calibratable; AI paste breaks at the angle. |
| Later: under-eye, tox, skin | — | Pure appearance/lighting → generative (front). |

**Why not warp the front too (with an AI finish on top)?** We tried it. A
warp+finish on the front costs the *same* AI call as pure-generative but inherits
the warp's geometric fragility — on real faces it distorted lips (everting a
parted mouth), tugged the lip when projecting the chin, and left relight-less
shadows. Pure generative is simpler *and* more realistic for the same cost. The
warp earns its place on the **profile**, where geometry is the whole game.

## How this differs from what's out there

| | Approach | Trade-off |
|---|---|---|
| FaceApp / "AI surgery" apps | Pure generative | Pretty, but uncontrolled, changes identity, can't match real mm, inconsistent. Entertainment. |
| Crisalix (medical leader) | True 3D from a scanner / many photos | Most accurate, but needs special capture, expensive, in-clinic. |
| **Visage** | **AI + identity-lock composite on the front, deterministic warp on the profile — from one phone photo** | Photoreal front result + calibratable profile projection, from a *single selfie*. |

**The bet:** a believable, identity-safe preview from a single phone photo — AI
rendering the front (where filler is volume + light), a deterministic warp owning
the profile (where it's silhouette and calibratable to mm). Accessibility (one
selfie, no scanner) is the wedge; the surgeon's calibration data is the moat.

## How we got here (why this approach)

The engine was originally **warp-everywhere** — geometry as the source of truth,
AI only as a finisher. That's still right *on the profile*, and it's how we fixed
the original reported bug (the generative paste distorting lips at an angle). But
when we extended the warp to the **front**, real-photo testing broke it three
ways: it **distorted lips** (everting a parted/male mouth), it **tugged the lip**
when projecting the chin (the displacement field bled upward), and it left
**shadows that wouldn't relight** (a warp moves pixels but can't paint the new
light a fuller feature needs). Each was a symptom of the same ceiling: *on the
front, filler is a lighting change, and a warp can't relight.* So the front moved
to generative + identity-lock composite (AI renders the light; the composite
keeps identity and reverts cleanly on toggle), and the warp was kept where it
genuinely wins — the **profile**. See "The split is by VIEW" above.

## Status (snapshot — trust the code over this section)

- **Front (built):** generative AI (`/api/simulate` → `buildCombinedPrompt`) edits
  every recommended area in one pass; the **identity-lock composite**
  (`prepareComposite`/`pasteComposite`) pastes only the treated regions back onto
  the original and rejects expression drift. Toggling a region re-pastes instantly
  (cached, no new call) and toggling it *off* reverts to the clean original.
  *Validated (real key):* on `test-face-closed.jpg` the front lips/cheeks/chin/jaw
  read natural with correct lighting, no distortion; toggling chin+jaw off reverts
  the lower face to ≈original (no residual shadow). One paid call per photo;
  instant toggling.
- **Profile (built):** the deterministic warp (`warpAreas`) projects chin / jaw /
  nose from the side — identity-locked, free, mm-calibratable, and correct at the
  angle where the AI paste fails. The lips are anchored in the warp so projecting
  the chin can't tug them.
- **Also:** the vision-LLM read (Claude); on-device measurements + landmarks.
- **Next:** **front** calibration is now *prompt-strength* tuning with the surgeon
  (the generative is qualitative, not mm — see `docs/surgeon-calibration.md`);
  **profile** keeps mm-calibratable warp magnitudes. Optional later: a profile
  generative finish (needs the angle-composite problem solved first), and moving
  cheeks to a richer treatment if testing shows the front needs it.
