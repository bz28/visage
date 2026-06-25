# Claude Rules

## Project

**Visage** — a face-scan tool for the aesthetic/filler industry. A prospective patient scans/uploads a photo and gets a **simulated preview** of dermal-filler results plus an educational summary of "areas commonly discussed," then is funneled to **book a consultation** with a partner clinic. Clinicians get a **consult-side tool** to refine the simulation live with the patient, confirm a treatment plan, and manage patients over time. Business model is **hybrid**: a white-label patient-facing widget on the clinic's site (top of funnel) backed by a clinician consultation/patient-management tool (the moat).

**v1 wedge: lip filler** — highest-volume treatment, most self-contained geometry to simulate, highest "natural vs overdone" anxiety (so a believable preview is most valuable). Chin and jawline come next; full-face/cheek 3D volumetric morphing and Botox/tox are later.

**Non-negotiable framing:** every preview is a **simulation, never a guaranteed outcome**. Recommendations are **education** ("areas commonly discussed for a look like this → see a provider"), never a prescription ("you need 2ml here"). This keeps us on the right side of the medical-advice line and protects patient trust.

## Ground truth

- Ground every claim in the actual code. Before stating how something works, read the file and cite `file:line`. When memory or an earlier turn conflicts with what you observe now, trust what you observe and update/drop the stale recollection.
- Pre-launch: no real users yet. Skip legacy-compat engineering — no backwards-compatibility shims, no migration backfills for "old" rows, no deprecation wrappers, no feature flags gating changes. Change the code directly.

## Privacy & safety

- This app handles people's **face photos** and simulated results — treat them as sensitive. Don't expose images via guessable/public URLs, scope access to the owning patient/clinic, and never log image data or patient identifiers.
- Keep simulation/recommendation copy in the **education, not prescription** register (see Project). Flag anywhere the UI drifts toward guaranteeing an outcome.

## Workflow

- Feature branches → PR → CI → merge to main. Never push directly to main.
- Use graphite for stacked work: `gt c -m "msg"` to commit, `gt s` to submit the stack. Each PR in a stack should be independently reviewable so you can review them stack-by-stack in Graphite.
- No squash merges. Use `--merge` to preserve commit history.
- Don't auto-commit and don't auto-open PRs — unless the user invoked `/autopilot`, which authorizes commit + push + PR-open autonomy for the scoped task. Outside autopilot: before committing, summarize what/why and ask; before opening a PR, push the branch, summarize, let the user decide.
- Don't push empty commits to trigger CI. CI runs automatically on PRs.
- After opening a PR, monitor CI until all checks pass. If any check fails, update the user with: which check failed, why, and what you're doing to fix it. Then fix and push. Repeat until green before telling the user the PR is ready.
- **Every PR description includes a Test Plan with evidence — mandatory, not optional.** Document exactly how the change was verified: each automated check run (`tsc`/lint, CI, the e2e at `test/e2e/preview-flow.mjs`) with its pass/fail result, plus a one-line note on manual/browser verification. For any **user-facing / UI change, attach a screenshot of the changed surface to the PR** (before→after when you're altering something that already existed) — a UI PR without a screenshot is not ready to call done. If a surface genuinely can't be visually verified in this environment (e.g. mobile with no simulator, or a sub-second transient), **say so explicitly** in the test plan with what you verified instead — never silently omit it. The same evidence belongs in the message you give the user when reporting the PR.
- **Verify the blast radius, not just the new thing.** A change to a shared component, hook, API contract, or the landmark/composite/simulation pipeline can silently break surfaces it didn't obviously touch. Identify what the change could affect (every call site of an edited component/function, every screen that reads a changed value) and confirm those *still function the same* — exercise the adjacent flow, not just the new feature. **Attach a screenshot of each affected surface you checked**, not only the changed one. If you can't verify an affected surface, list it as an explicit risk in the Test Plan rather than assuming it's fine.
- Small, cohesive commits (~150 lines when the change is cohesive; larger is fine for a single logical operation like a rename or bulk delete).
- Conventional commit prefixes: `feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, `test:`.

## Development Process

- Plan before coding. For non-trivial features, use `/plan` to draft the approach in plain English first, iterate with the user, and get explicit approval before writing code. Keep the plan in the conversation — do NOT persist it to a file in the repo. Stale plan docs drift away from the code; trust the code as the source of truth.
- Feature-by-feature workflow. Work incrementally — after each logical chunk, summarize what/how/why and wait for the user to test before continuing.
- Verify and test changes. Trace through code, check edge cases (count=0, boundaries, empty/garbage photo input), read surrounding code before presenting work.
- Cover new features with a durable test. When you build a significant new feature, leave behind reusable coverage and run it before declaring done — don't rely on a throwaway one-off check. Pick the lightest coverage that actually guards the feature. For **AI/CV-generated visual output** (face landmarks, simulated previews), prefer a harness that drives the real app and asserts the output renders correctly, since these can't be unit-asserted by value. A trivial/cosmetic change just needs the browser render check — no new test.
- Run `/review` on every PR before declaring it ready to merge. For larger or higher-stakes PRs, also spawn a fresh independent review agent without conversation context — a self-review inside the same session is biased toward the work you just did.
- When reviewing, do two passes. First pass: jot every concern. Second pass: re-verify each by reading actual code; discard anything you can't confirm. Label survivors as **confirmed** (traced, real) or **suspected** (plausible, couldn't fully verify). Don't propose fixes until the user approves.
- Shipping checklist. Before saying work is done, summarize: what was done, how, why, and how it was tested.

## Code quality

- DRY: don't extract abstractions beyond what the task requires. Three similar lines is better than a premature abstraction. Inverse — extract a helper when at least 2 of these are true: (1) duplicated 3+ times, (2) the logic is complex enough that a name conveys real insight, (3) the call sites are likely to evolve together, (4) the duplication is where bugs cluster historically. If the only argument is "it's repeated," leave it inline.

## Frontend design

- For new UI surfaces (pages, modals, dialogs, significant components), invoke `/frontend-design:frontend-design` before writing styles. Skip for small tweaks (single property edits, copy changes, layout nudges). The goal: every new surface gets a deliberate aesthetic pass before it lands, instead of relying on defaults.

## Skills / Commands

- `/plan` — draft an approach in conversation before starting a non-trivial feature
- `/implement` — build a feature commit by commit, pausing for you to test
- `/autopilot` — autonomous multi-commit execution on a well-scoped task
- `/audit` — deep codebase scan for quality/security issues (two-pass, confirmed/suspected)
- `/review` — two-pass code review with confirmed/suspected labels; no fixes until approved
- `/debug` — investigate root cause of a reported issue and propose a reliable fix
- `/ui` — design or fix a frontend/UX surface through the patient/clinician lens
- `/explain-simple` — plain-English summary for a non-technical audience, typically right after a feature ships
- `web-design-guidelines` — review UI code against Web Interface Guidelines (accessibility/UX)
- `/frontend-design:frontend-design` — deliberate aesthetic pass on new UI surfaces (see Frontend design)

**Canonical per-feature loop:** `/plan` → `/explain-simple` → (you approve) → `/implement` or `/autopilot` → `/review` → `/explain-simple` → (you test) → next feature.
