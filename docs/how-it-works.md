# How Visage works — the simple version

A plain-English walkthrough of the whole app: what the patient sees at each step,
what happens behind the scenes, and which part of the code does it.

It's all **one page** (`src/app/page.tsx` → `ScanFlow.tsx`). There's no routing —
`ScanFlow` just swaps what's on screen as the patient moves through 5 steps:

```
  Tell us        Your photos      (working…)       Your read              Book
  ┌───────┐      ┌─────────┐      ┌─────────┐      ┌─────────┐            ┌──────┐
  │intake │  →   │ capture │  →   │analyzing│  →   │ result  │     →      │ book │
  └───────┘      └─────────┘      └─────────┘      └─────────┘            └──────┘
   answers        a photo         AI read          before/after + plan    a lead
```

---

## 1. Intake — "a couple of quick things"

- **What the patient sees:** three fields — **gender**, **age**, and one **free-text
  box** ("what would you like to improve?"). Everything is optional; one "Continue"
  button carries the empty case too.
- **Why:** that's deliberately minimal (don't overload them). Gender sets the
  aesthetic direction the read reasons with; the free text is their concern in
  their own words. The app still suggests *every* relevant area, not only what
  they typed.
- **Code:** `Intake.tsx`; shape in `intake-schema.ts` (a few extra fields are kept
  there, reserved for the future clinician tool).

## 2. Photos — "your photos"

- **What the patient sees:** camera or upload. **Front is required**; side and angle
  are optional but sharpen the read. If their concern mentions jaw/chin, the side
  photo gets a "recommended" nudge (projection needs a profile).
- **Each shot is checked on-device before it's accepted:** no face / multiple faces
  is a hard retake; a tilted / too-small / off-center front photo is a skippable
  warning. → `photo-check.ts`
- **Code:** `Capture.tsx` + `PhotoCapture.tsx`. **The photo never leaves the browser
  here** — it's held in memory.

## 3. Analyzing — the "read"

**(a) On-device face math — free, instant, private.**
- The browser finds **468 face landmarks** with Google MediaPipe (runs *locally*,
  no upload). → `landmarks.ts`
- From those we compute real proportions — facial thirds, lip ratio,
  jaw-to-cheekbone width, symmetry, tilt. → `measurements.ts`
- A rule-based **baseline read** turns those numbers into plain observations, so
  the patient *always* gets a result even if the AI call fails. → `baseline.ts`

**(b) The AI read — Claude, looking at the actual photo.**
- The photo(s) + measurements + intake go to `/api/analyze`, which calls **Claude
  Sonnet** (vision). → `ai.ts`
- Claude reads like an experienced injector and returns **at most 3 areas**
  "commonly discussed" (lips, chin, jawline, cheeks, nasolabial folds, marionette
  lines, nose, …), each with a warm, educational *what* and *why* — never a
  prescription, never an amount. Grounded by the measurements; falls back to the
  baseline if the call fails.

`Analyzing.tsx` is the "Reading your features…" screen.

## 4. Result — "here's what we'd explore together"

The headline. As soon as the read lands, the before/after starts generating in the
background.

- **One combined before/after.** Instead of editing area-by-area, we make **one
  image** with *every* recommended area treated at the single optimal amount.
  - `/api/simulate` sends the photo + a combined instruction to **Google Gemini
    2.5 Flash Image**, which edits only those areas. → `simulation.ts` (the
    prompt) + the route.
  - **Identity lock:** we then re-detect landmarks on Gemini's output and paste
    **only the treated regions** back over the *original* photo — so everything
    outside those areas is pixel-for-pixel the patient. → `composite.ts` +
    `face-regions.ts` (the feathered region masks).
- **How they see it:** a large hero, **side-by-side by default** (Now | With
  treatment), with a toggle to a **drag slider** that wipes between the two.
  → `BeforeAfter.tsx`
- **The areas, marked:** thin **dots** on the photo (no clutter); tap a dot — or
  hover/tap a row in the list — to reveal that area's label and highlight it.
- **"Areas we'd explore"** — the list below, each with a short *why* and an **"In
  preview" switch**. Toggle an area off and the before/after updates **instantly
  and for free** — we just re-paste a subset of the *same* generation, no new AI
  call. → `AssessmentResult.tsx`
- **Profile before/after (if a side photo was given).** A second panel projects
  **chin / jaw / nose** from the side — but with a *different* engine: a
  deterministic **geometric warp** that nudges the patient's own pixels forward
  (no AI). The generative paste fails at an angle, and projection is the whole
  story in profile, so geometry wins here. → `warp.ts`, `ScanFlow.tsx`.
- Always labeled a **simulation**. On the **front** we don't simulate **nose,
  under-eye, or temples** (subtle / high-risk; the nose's real change is in
  profile) — they're discussed only. The **nose** *is* simulated on the profile.
- **Code:** orchestrated by `ScanFlow.tsx`.

## 5. Book — turn interest into a consultation

- **What the patient sees:** a short form (name, email/phone, optional note) that
  carries forward which areas they were interested in.
- **Behind the scenes:** `/api/leads` saves the lead (Neon) and emails the clinic
  (Resend). Both optional — locally it just logs and succeeds. → `BookConsult.tsx`
  → `leads.ts`. **Contact details are never logged.**

---

## The two AI calls, side by side

| | **The read** | **The before/after** |
|---|---|---|
| **Model** | Claude Sonnet (vision, text out) | Gemini 2.5 Flash Image (image edit) |
| **Job** | "What would an injector discuss?" | "Show all of it on their own face" |
| **Output** | ≤ 3 educational areas + why | One edited photo, treated regions composited back |
| **Route** | `/api/analyze` → `ai.ts` | `/api/simulate` → `simulation.ts` |
| **If it fails** | Falls back to the on-device baseline | "Preview unavailable", the read still stands |

Claude can *read* images but can't *make* them; Gemini makes images but isn't our
reader — each does the job it's best at. **Toggling areas after that is free** —
local canvas work, no model call.

## Privacy, in one breath

Face detection runs **in the browser**. Photos only go to our server for the two
AI calls, come back as inline data (never public URLs), and are **never logged** —
same for contact details. (See `CLAUDE.md`.)

## White-label

Everything clinic-specific — name, accent color, booking copy, where leads go —
lives in `clinic.ts`. Swap that to re-skin the whole widget.

## Dev shortcuts

Two env flags make local work fast/free (never on in production):
- `MOCK_ANALYZE=1` — skip the Claude call, return a canned read instantly.
- `MOCK_SIMULATE=1` — skip Gemini, echo the photo back, to test the UI for free.

## What's next (not built yet)

- **Surgeon calibration** — turn the placeholder filler amounts into clinically
  real ones (`surgeon-calibration.md`). The moat.
- **Clinician / consult tool** — the in-office, coordinator-run side of the product
  (where the per-area, per-amount editing already scaffolded in `simulation.ts`
  comes alive).
