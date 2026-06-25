// Durable end-to-end smoke test for the before/after preview flow.
//
// Drives the REAL app in a headless browser and asserts the simulated preview
// renders — the harness CLAUDE.md asks for on AI/CV visual output, which can't
// be unit-asserted by value. Runs with MOCK_ANALYZE + MOCK_SIMULATE so it's
// deterministic and free (no Claude/Gemini calls); the mock simulate echoes the
// photo, so this exercises the whole pipeline (MediaPipe detect → composite →
// render) without hitting paid AI. Gemini's visual quality stays a manual check.
//
// Usage: node test/e2e/preview-flow.mjs   (or: npm run test:e2e)

import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { chromium } from "playwright-core";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..", "..");
const FIXTURE = join(__dirname, "..", "fixtures", "test-face.jpg");
const NO_FACE = join(__dirname, "..", "fixtures", "no-face.jpg");
const PORT = process.env.E2E_PORT || "3100";
const BASE = `http://localhost:${PORT}`;

// Benign WASM log MediaPipe emits via console.error — not a real error.
const IGNORE_CONSOLE = [/TensorFlow Lite XNNPACK/i, /Download the React DevTools/i];

function log(m) {
  console.log(`[e2e] ${m}`);
}

async function waitForServer(timeoutMs) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(BASE, { method: "HEAD" });
      if (res.ok || res.status === 200) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`dev server didn't come up on ${BASE} within ${timeoutMs}ms`);
}

async function main() {
  log("starting next dev with mocks…");
  // detached so the whole process group (npm → next dev → Turbopack workers) can
  // be killed together — SIGTERM to npm alone leaves orphans that keep node's
  // event loop alive and hang CI.
  const server = spawn("npm", ["run", "dev"], {
    cwd: ROOT,
    detached: true,
    env: {
      ...process.env,
      PORT,
      MOCK_ANALYZE: "1",
      MOCK_SIMULATE: "1",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  server.stdout.on("data", () => {});
  server.stderr.on("data", () => {});

  const stopServer = () => {
    try {
      // negative pid = kill the whole process group
      if (server.pid) process.kill(-server.pid, "SIGKILL");
    } catch {
      // already gone
    }
  };

  let browser;
  const fail = (msg) => {
    throw new Error(msg);
  };

  try {
    await waitForServer(90_000);
    log("server up; launching browser…");
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

    const consoleErrors = [];
    page.on("console", (msg) => {
      if (msg.type() !== "error") return;
      const text = msg.text();
      if (IGNORE_CONSOLE.some((re) => re.test(text))) return;
      consoleErrors.push(text);
    });
    page.on("pageerror", (err) => consoleErrors.push(`pageerror: ${err.message}`));

    log("loading app…");
    await page.goto(BASE, { waitUntil: "networkidle", timeout: 90_000 });

    // Advance past intake (all fields optional) → upload the fixture face.
    // Retry the Continue→capture transition, since an early click can be lost
    // before React hydrates (esp. on the dev server's first compile).
    const cont = page.getByRole("button", { name: /Continue/i }).first();
    await cont.waitFor({ state: "visible", timeout: 60_000 });
    const fileInput = page.locator('input[type="file"]');
    for (let i = 0; i < 5; i++) {
      await cont.click().catch(() => {});
      try {
        await fileInput.waitFor({ state: "attached", timeout: 4_000 });
        break;
      } catch {
        if (i === 4) throw new Error("intake never advanced to capture");
      }
    }
    // Capture hard-gate: a no-face photo must be rejected at capture.
    log("checking no-face photo is rejected…");
    await fileInput.setInputFiles(NO_FACE);
    await page
      .getByText(/couldn't find a face/i)
      .waitFor({ timeout: 30_000 });
    log("no-face correctly rejected ✓");

    // Now the real face. It may surface a soft framing warning — accept it.
    await fileInput.setInputFiles(FIXTURE);
    const useAnyway = page.getByRole("button", { name: /Use anyway/i });
    const seeRead = page.getByRole("button", { name: /See my read/i });
    await Promise.race([
      useAnyway.waitFor({ timeout: 30_000 }).catch(() => {}),
      seeRead.waitFor({ timeout: 30_000 }).catch(() => {}),
    ]);
    if (await useAnyway.isVisible().catch(() => false)) await useAnyway.click();

    // Add a side photo (reuse the fixture) so the profile before/after path runs.
    log("adding a side photo for the profile path…");
    await page.getByRole("button", { name: /^Add$/ }).first().click();
    await page.locator('input[type="file"]').last().setInputFiles(FIXTURE);
    const useAnyway2 = page.getByRole("button", { name: /Use anyway/i });
    await Promise.race([
      useAnyway2.waitFor({ timeout: 20_000 }).catch(() => {}),
      seeRead.waitFor({ timeout: 20_000 }).catch(() => {}),
    ]);
    if (await useAnyway2.isVisible().catch(() => false)) await useAnyway2.click();
    await seeRead.click();

    log("waiting for the read…");
    // Match the result heading specifically (intake copy also says "explore
    // together"). On timeout, surface the capture error so a fixture that fails
    // face-detection reports the real cause instead of a bare hang.
    try {
      await page
        .getByRole("heading", { name: /explore together/i })
        .waitFor({ timeout: 60_000 });
    } catch {
      const err = await page
        .locator(".bg-amber-50")
        .first()
        .textContent()
        .catch(() => null);
      throw new Error(
        err
          ? `stuck on capture — fixture face likely not detected: "${err.trim()}"`
          : "result screen never appeared",
      );
    }

    // The areas list + combined before/after render automatically.
    await page.getByText(/areas we'd explore/i).waitFor({ timeout: 30_000 });

    log("waiting for the combined before/after to render…");
    // The "With treatment" image generates in the background; wait for the front
    // one (.first(), since the profile path adds a second matching image).
    await page
      .locator('img[alt*="Simulated result"]')
      .first()
      .waitFor({ timeout: 60_000 });

    // Assert it actually decoded (non-zero dimensions).
    const dims = await page.evaluate(() => {
      const img = document.querySelector('img[alt*="Simulated result"]');
      return img ? { w: img.naturalWidth, h: img.naturalHeight } : null;
    });
    if (!dims || dims.w === 0 || dims.h === 0) {
      fail(`combined preview did not render (dims=${JSON.stringify(dims)})`);
    }
    log(`combined before/after rendered (${dims.w}×${dims.h}).`);

    // The profile (two-angle) before/after also renders from the side photo.
    log("waiting for the profile before/after…");
    await page.getByText("Profile", { exact: true }).waitFor({ timeout: 30_000 });
    await page.waitForFunction(
      () =>
        document.querySelectorAll('img[alt*="Simulated result"]').length >= 2,
      { timeout: 60_000 },
    );
    log("front + profile before/afters both rendered ✓");

    if (consoleErrors.length) {
      fail(`console errors:\n  - ${consoleErrors.join("\n  - ")}`);
    }

    log("PASS ✓");
  } finally {
    if (browser) await browser.close().catch(() => {});
    stopServer();
  }
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(`[e2e] FAIL ✗ ${err.message}`);
    process.exit(1);
  },
);
