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
  const server = spawn("npm", ["run", "dev"], {
    cwd: ROOT,
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

    // Skip intake → upload the fixture face. Retry the Skip→capture transition,
    // since an early click can be lost before React hydrates (esp. on the dev
    // server's first compile).
    const skip = page.getByRole("button", { name: /Skip/i }).first();
    await skip.waitFor({ state: "visible", timeout: 60_000 });
    const fileInput = page.locator('input[type="file"]');
    for (let i = 0; i < 5; i++) {
      await skip.click().catch(() => {});
      try {
        await fileInput.waitFor({ state: "attached", timeout: 4_000 });
        break;
      } catch {
        if (i === 4) throw new Error("intake never advanced to capture");
      }
    }
    await fileInput.setInputFiles(FIXTURE);
    await page.getByRole("button", { name: /See my read/i }).click();

    log("waiting for the read…");
    await page.getByText(/explore together/i).first().waitFor({ timeout: 60_000 });

    // Tap the first area chip, then request its preview.
    const areaChip = page.locator('button:has-text("Lips"), button:has-text("Chin"), button:has-text("Cheeks"), button:has-text("Jawline")').first();
    await areaChip.click();
    await page.getByRole("button", { name: /See your .* preview/i }).click();

    log("waiting for the preview to render…");
    await page.getByText("Simulated preview").waitFor({ timeout: 60_000 });

    // Assert the preview image actually decoded (non-zero dimensions).
    const dims = await page.evaluate(() => {
      const img = document.querySelector('img[alt=""]');
      return img ? { w: img.naturalWidth, h: img.naturalHeight } : null;
    });
    if (!dims || dims.w === 0 || dims.h === 0) {
      fail(`preview image did not render (dims=${JSON.stringify(dims)})`);
    }
    log(`preview rendered (${dims.w}×${dims.h}).`);

    if (consoleErrors.length) {
      fail(`console errors:\n  - ${consoleErrors.join("\n  - ")}`);
    }

    log("PASS ✓");
  } finally {
    if (browser) await browser.close().catch(() => {});
    server.kill("SIGTERM");
  }
}

main().catch((err) => {
  console.error(`[e2e] FAIL ✗ ${err.message}`);
  process.exit(1);
});
