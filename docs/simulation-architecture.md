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

## Geometry is the source of truth; AI is a contained renderer

The core decision: a **deterministic 3D-mesh warp is the simulation backbone**,
and generative AI is only ever a **photoreal finisher**, never the decider.

- We fit a 3D face model (MediaPipe gives 468 points *with depth* + topology,
  on-device, free).
- Each treatment is a **calibrated volume displacement in 3D** — a function of
  `(area, millimetres, geometry)`. This is what the surgeon's real before/after
  photos calibrate against (`surgeon-calibration.md`). **Generative AI cannot be
  calibrated to millimetres — that's why it can't be the source of truth.**
- We warp the patient's own pixels along that displacement. Because it's a 3D
  model, the *same* change renders correctly on **front and profile**.

**Deterministic** = same input → same output, by formula. You can dial it to an
exact amount, it can't change identity (it's the patient's pixels), and angles
agree. **Generative** = stochastic; it samples, so it can't guarantee any of
those. For a medical preview, the deterministic backbone is non-negotiable.

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

## Where each tool goes — and how it scales

| Treatment | Tool | Why |
|---|---|---|
| Chin / jaw / nose (projection) | **Warp** | Pure shape — real pixels, calibratable, multi-angle. |
| Lips (fullness) | **Warp + generative texture finish** | Everting the vermillion border is a shape change — identity-locked, no shape/mouth drift. A low-strength generative *texture* pass then adds the filler sheen, identity-locked to the lip region (built; see Status). |
| Cheeks (volume) | **Warp + generative finish** | Shape is a warp; the new highlight needs rendering. |
| Under-eye / tear trough | **Generative** | Filling a *shadow* is a lighting change, not a shape change. |
| Botox / tox (softening lines) | **Generative** | A texture/appearance change. |
| Skin (tone, texture, boosters) | **Generative** | Pure appearance, no shape. |

The pattern: as the product grows from *projection* → *volume* → *under-eye* →
*tox/skin*, **generative AI's role grows** (more "appearance," less "shape"),
while the warp owns the entire structural half.

## The optimal pipeline: geometry-first, AI-finish

The best version isn't warp *or* AI — it's **warp first, AI second**:

1. The warp produces the correct, calibrated, identity-safe geometry (every
   angle).
2. An *optional* low-strength generative pass, **conditioned on that warped
   image**, paints photoreal shading where it matters — then we identity-lock it
   back onto real pixels.

You get medical control **and** photorealism, with generative always *contained
and locked*, never the uncontrolled source of truth. That's what keeps it on the
right side of the medical-trust line.

## How this differs from what's out there

| | Approach | Trade-off |
|---|---|---|
| FaceApp / "AI surgery" apps | Pure generative | Pretty, but uncontrolled, changes identity, can't match real mm, inconsistent. Entertainment. |
| Crisalix (medical leader) | True 3D from a scanner / many photos | Most accurate, but needs special capture, expensive, in-clinic. |
| **Visage** | **Geometry-first warp from one phone photo + AI as a contained renderer** | Crisalix-grade *control* from a *single selfie*, plus AI photorealism where it counts. |

**The bet:** medical-grade control (deterministic, calibratable, identity-safe,
multi-angle) delivered from a single phone photo — with AI used surgically only
where it adds real photorealism. The moat is the calibration (the surgeon's data
makes the warp clinically real); accessibility (one selfie, no scanner) is the
wedge.

## Status (snapshot — trust the code over this section)

- **Built today:** the deterministic warp engine drives **all reshape
  treatments** — lips (eversion), chin/jaw/nose (projection) — on **both** the
  profile and the front, identity-locked. The generative model is scoped to
  **flat-area volume** (cheeks, folds) plus a **texture finish**. The vision-LLM
  read; on-device measurements + landmarks; identity-lock composite.
- **Texture finish (built + wired):** after the lip warp shows instantly, a
  background generative pass adds the photoreal sheen/highlight the geometry
  can't synthesize, then is **identity-locked to the lip region** of the warp so
  it can add texture but never move the shape. It's a **progressive enhancement**:
  the warp is the floor (always shown), the finish swaps in when ready, and any
  drift/refusal/timeout **fails silently to the warp**. It only fires on a relaxed
  **closed mouth** (the gated norm) — on an open/smiling mouth the model tends to
  nudge the smile and the harness rejects it, so attempting it would just burn a
  call. Debounced + cached (one call per settled view).
  - *Validated (real key):* the warp→finish→identity-lock pipeline produces a
    clean locked result on a **closed-mouth** fixture (`test/fixtures/
    test-face-closed.jpg`, regenerable via `scripts/make-closed-mouth-fixture.mjs`)
    — MediaPipe detects it, the mouth reads closed, and the finish locks in
    (`FINISH LOCKED ✓`) with natural, fuller-textured lips and identity preserved.
    The wired trigger + fail-silent + closed-mouth gate are verified in the live
    flow (open mouth → harness rejects → keeps the warp; closed mouth → texture
    lands).
  - *Remaining (small):* the automated e2e runs under the image-gen mock (so the
    finish echoes — no real texture to assert) and on the open-mouth fixture (so
    the finish is correctly skipped). A finish-path e2e using the closed-mouth
    fixture would add wiring coverage — nice-to-have, not a correctness risk.
- **Next:** calibration of every warp magnitude **and** the finish texture
  strength to the surgeon's real before/after photos (`docs/surgeon-calibration.md`);
  a closed-mouth e2e fixture; optionally a cross-fade on the finish swap.
