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
   answers        a photo         two AI calls     read + before/after    a lead
```

---

## 1. Intake — "a few quick questions"

- **What the patient sees:** optional chips (goals, the look they want, age) + two
  optional text fields (heritage, past treatments). Everything is skippable.
- **Why:** so the read fits *them*, not a generic ideal. The answers get fed to the
  AI later to personalize what it notices.
- **Code:** `Intake.tsx` collects it; the shape lives in `intake-schema.ts`.

## 2. Photos — "your photos"

- **What the patient sees:** take a photo with their camera, or upload one. Front
  photo is required; side and angle are optional (they make the read sharper).
- **Why:** we need at least a straight-on face to work from.
- **Code:** `Capture.tsx` + `PhotoCapture.tsx`. **The photo never leaves the browser
  yet** — it's just held in memory.

## 3. Analyzing — the two-part "read"

This is where the magic happens. Two things run, in order:

**(a) On-device face math — free, instant, private.**
- The browser finds **468 face landmarks** using Google MediaPipe (runs *locally*,
  no upload). → `landmarks.ts`
- From those dots we compute real proportions — facial thirds, lip ratio,
  jaw-to-cheekbone width, symmetry, tilt. → `measurements.ts`
- A rule-based "baseline read" turns those numbers into plain observations. This
  guarantees the patient *always* gets a result, even if the AI call fails. →
  `baseline.ts`

**(b) The AI read — Claude, looking at the actual photo.**
- The photo(s) + the measurements + the intake get sent to our server
  (`/api/analyze`), which calls **Claude Sonnet** (vision). → `ai.ts`
- Claude acts like an experienced injector: it returns **at most 3 areas**
  "commonly discussed" (lips, chin, jawline, cheeks, etc.), each with a warm,
  educational *what* and *why* — never a prescription. The measurements keep it
  grounded; if the call fails, we fall back to the baseline read.
- This is the slow step (~a minute) — it's a real vision model reading a face.

The "Reading your features…" screen with cycling status is `Analyzing.tsx`.

## 4. Result — "here's what we'd explore together"

- **What the patient sees:** their own photo with **numbered dots** on the areas,
  a short summary, and tappable chips for each area showing the observation + why.
- **The before/after preview** (the headline feature): tap an area → **"See your
  preview"** → a real **AI-generated image of their own face** with that area
  enhanced, in three looks: **Subtle / Natural / Fuller**.
  - This calls `/api/simulate`, which sends the photo + an instruction to
    **Google Gemini 2.5 Flash Image** ("Nano Banana"). Gemini edits *only* that
    area and keeps everything else the same. → `simulation.ts` (the instruction)
    + `route.ts` (the call).
  - **Press-and-hold the photo** to flip back to the real "before."
  - It's clearly labeled a **simulation**, and a real injector confirms in person.
- **Code:** `FaceCanvas.tsx` draws the photo, dots, and the crossfading "after."
  `AssessmentResult.tsx` is the text + preview controls. Both orchestrated by
  `ScanFlow.tsx`.

## 5. Book — turn interest into a consultation

- **What the patient sees:** a short form (name, contact, optional note) that
  carries forward which areas — and which look — they responded to.
- **Behind the scenes:** `/api/leads` saves the lead to a database (Neon) and
  emails the clinic (Resend). Both are optional — locally it just logs and
  succeeds. → `BookConsult.tsx` → `leads.ts`. **Contact details are never logged.**

---

## The two AI calls, side by side

| | **The read** | **The preview** |
|---|---|---|
| **Model** | Claude Sonnet (vision, text out) | Gemini 2.5 Flash Image (image edit) |
| **Job** | "What would an injector discuss?" | "Show what that area could look like" |
| **Output** | Educational areas + why | An edited photo of their own face |
| **Route** | `/api/analyze` → `ai.ts` | `/api/simulate` → `simulation.ts` |
| **If it fails** | Falls back to the on-device baseline | Shows "preview unavailable", read stands |

Claude can *read* images but can't *make* them; Gemini makes images but isn't our
reader — so each does the job it's best at.

## Privacy, in one breath

Face detection runs **in the browser**. Photos only go to our server for the two
AI calls, are returned as inline data (never public URLs), and are **never logged**
— same for contact details. (See CLAUDE.md.)

## White-label

Everything clinic-specific — name, accent color, booking copy, where leads go —
lives in one file: `clinic.ts`. Swapping that re-skins the whole widget for a new
clinic.

## Dev shortcuts

Two env flags make local work fast/free (never on in production):
- `MOCK_ANALYZE=1` — skip the ~1-min Claude call, return a canned read instantly.
- `MOCK_SIMULATE=1` — skip Gemini, echo the photo back, to test the UI for free.

## What's next (not built yet)

- **Surgeon calibration** — turn the placeholder filler amounts into clinically
  real ones (see `surgeon-calibration.md`). This is the moat.
- **Pixel-perfect identity lock** — composite Gemini's edit back through a mask so
  nothing outside the treated area changes at all.
- **Clinician/consult tool** — the in-office, coordinator-run side of the product.
