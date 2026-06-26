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
const FIXTURE_CLOSED = join(__dirname, "..", "fixtures", "test-face-closed.jpg");
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

    // Count the texture-finish calls so we can assert the closed-mouth GATE:
    // the finish must NOT fire on this open-mouth fixture (it would just burn a
    // paid call to fail the identity-lock harness). See finishFront in ScanFlow.
    let finishCalls = 0;
    page.on("request", (req) => {
      if (req.method() !== "POST" || !req.url().includes("/api/simulate")) return;
      const body = req.postData() || "";
      if (body.includes("finishAreas")) finishCalls++;
    });

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
    // The "With treatment" image generates in the background. Wait until it's
    // actually DECODED (not just laid out) — visibility alone leaves naturalWidth
    // at 0 and would flake. .first() since the profile path adds a 2nd match.
    await page.waitForFunction(
      () => {
        const img = document.querySelector('img[alt*="Simulated preview"]');
        return !!img && img.complete && img.naturalWidth > 0;
      },
      { timeout: 60_000 },
    );
    log("combined before/after rendered (decoded).");

    // The profile (two-angle) before/after also renders — now a deterministic
    // geometric WARP of the side photo (detect → warp), so give the wait
    // headroom for the MediaPipe detect in headless.
    log("waiting for the profile before/after…");
    await page.getByText("Profile", { exact: true }).waitFor({ timeout: 45_000 });
    await page.waitForFunction(
      () =>
        document.querySelectorAll('img[alt*="Simulated preview"]').length >= 2,
      { timeout: 90_000 },
    );
    log("front + profile before/afters both rendered ✓");

    // Assert the warp's core guarantee: it changes the projection region
    // (chin/jaw) while leaving the upper face (eyes/brow) pixel-locked.
    const lock = await page.evaluate(() => {
      const befores = [...document.querySelectorAll('img[alt=""]')].filter(
        (i) => i.naturalWidth > 50,
      );
      const afters = [
        ...document.querySelectorAll('img[alt*="Simulated preview"]'),
      ];
      const before = befores[1];
      const after = afters[1]; // [0] = front, [1] = profile
      if (!before || !after) return { ok: false };
      const W = 120,
        H = 150;
      const data = (im) => {
        const c = document.createElement("canvas");
        c.width = W;
        c.height = H;
        const x = c.getContext("2d");
        x.drawImage(im, 0, 0, W, H);
        return x.getImageData(0, 0, W, H).data;
      };
      const A = data(before),
        B = data(after);
      const diff = (y0, y1) => {
        let s = 0,
          n = 0;
        for (let y = Math.floor(y0 * H); y < Math.floor(y1 * H); y++)
          for (let xp = 0; xp < W; xp++) {
            const i = (y * W + xp) * 4;
            s += Math.abs(A[i] - B[i]);
            n++;
          }
        return s / n;
      };
      return { ok: true, eye: diff(0.2, 0.45), projection: diff(0.6, 0.98) };
    });
    if (!lock.ok) fail("warp identity-lock check: profile pair not found");
    // The locked upper face must change far less than the projection region.
    if (lock.projection <= lock.eye) {
      fail(
        `warp not behaving: projection Δ${lock.projection.toFixed(2)} ≤ locked-eye Δ${lock.eye.toFixed(2)}`,
      );
    }
    log(
      `warp identity-lock verified (eye Δ${lock.eye.toFixed(2)} < projection Δ${lock.projection.toFixed(2)}) ✓`,
    );

    // Lip-warp GATE on an open mouth. This fixture is open-mouthed, so the lip
    // warp must be SKIPPED — everting a parted lip distorts it (pushes the lower
    // lip into the teeth). We assert the patient-facing "retake closed-mouth"
    // note is shown, which fires iff the gate engaged (lips selected + mouth open
    // → no lip warp). Guards the open-mouth lip distortion regression.
    const lipGateNote = await page
      .getByText(/retake with a relaxed, closed mouth/i)
      .count();
    if (lipGateNote === 0) {
      fail(
        "lip-warp gate broken: open mouth should skip the lip warp and show the closed-mouth note",
      );
    }
    log("lip warp correctly gated on open mouth (note shown) ✓");

    // Closed-mouth GATE: open mouth ⇒ the texture finish must NOT fire either (it
    // would burn a paid call to fail the identity-lock harness). Give any
    // debounced finish a beat to (not) fire, then assert zero calls.
    await page.waitForTimeout(800);
    if (finishCalls !== 0) {
      fail(`finish gate broken: ${finishCalls} finish call(s) on an open mouth`);
    }
    log("texture-finish correctly skipped on open mouth (0 calls) ✓");

    // Toggle every area OFF → the "after" preview must clear. Guards the
    // empty-selection path where an in-flight (async) chin/jaw warp could
    // otherwise resume and clobber the blank the patient just asked for.
    log("toggling all areas off…");
    const switches = page.locator('button[role="switch"]');
    const count = await switches.count();
    for (let i = 0; i < count; i++) {
      const sw = switches.nth(i);
      if ((await sw.getAttribute("aria-checked")) === "true") {
        await sw.click();
      }
    }
    await page.waitForFunction(
      () =>
        document.querySelectorAll('img[alt*="Simulated preview"]').length === 0,
      { timeout: 15_000 },
    );
    log("all-off clears the preview ✓");

    // ── Second flow: CLOSED-mouth fixture — the wedge happy path. Here the lip
    // warp SHOULD fire (fuller lips), so we assert the lip region changes far
    // more than the locked upper face. Covers the positive lip-warp the
    // open-mouth flow above intentionally gates off.
    log("closed-mouth flow: verifying the lip warp fires…");
    await page.goto(BASE, { waitUntil: "networkidle", timeout: 90_000 });
    const cont2 = page.getByRole("button", { name: /Continue/i }).first();
    await cont2.waitFor({ state: "visible", timeout: 60_000 });
    const fileInput2 = page.locator('input[type="file"]');
    for (let i = 0; i < 5; i++) {
      await cont2.click().catch(() => {});
      try {
        await fileInput2.waitFor({ state: "attached", timeout: 4_000 });
        break;
      } catch {
        if (i === 4) throw new Error("intake never advanced (closed flow)");
      }
    }
    await fileInput2.setInputFiles(FIXTURE_CLOSED);
    // Closed mouth → the framing nudge may or may not appear; accept it if shown.
    const useAnyway3 = page.getByRole("button", { name: /Use anyway/i });
    const seeRead2 = page.getByRole("button", { name: /See my read/i });
    await Promise.race([
      useAnyway3.waitFor({ timeout: 30_000 }).catch(() => {}),
      seeRead2.waitFor({ timeout: 30_000 }).catch(() => {}),
    ]);
    if (await useAnyway3.isVisible().catch(() => false)) await useAnyway3.click();
    await seeRead2.click();
    await page
      .getByRole("heading", { name: /explore together/i })
      .waitFor({ timeout: 60_000 });
    await page.waitForFunction(
      () => {
        const img = document.querySelector('img[alt*="Simulated preview"]');
        return !!img && img.complete && img.naturalWidth > 0;
      },
      { timeout: 60_000 },
    );
    // Isolate the lip warp by toggling LIPS off and comparing the two "after"
    // images: only the lip warp differs between them. Its lip region must change
    // a lot while the eye region stays put — this can't pass off the chin/jaw
    // warp (that's identical in both), unlike a before/after region diff.
    const afterOn = await page.evaluate(
      () => document.querySelector('img[alt*="Simulated preview"]')?.src,
    );
    await page.getByRole("switch", { name: /lips in preview/i }).click();
    await page.waitForFunction(
      (prev) => {
        const img = document.querySelector('img[alt*="Simulated preview"]');
        return !!img && img.complete && img.naturalWidth > 0 && img.src !== prev;
      },
      afterOn,
      { timeout: 30_000 },
    );
    const lipWarp = await page.evaluate((onSrc) => {
      const off = document.querySelector('img[alt*="Simulated preview"]');
      if (!off || !onSrc) return Promise.resolve({ ok: false });
      const W = 160,
        H = 200;
      const draw = (src) =>
        new Promise((res) => {
          const im = new Image();
          im.onload = () => {
            const c = document.createElement("canvas");
            c.width = W;
            c.height = H;
            const x = c.getContext("2d");
            x.drawImage(im, 0, 0, W, H);
            res(x.getImageData(0, 0, W, H).data);
          };
          im.src = src;
        });
      return Promise.all([draw(onSrc), draw(off.src)]).then(([A, B]) => {
        const diff = (y0, y1) => {
          let s = 0,
            n = 0;
          for (let y = Math.floor(y0 * H); y < Math.floor(y1 * H); y++)
            for (let xp = 0; xp < W; xp++) {
              const i = (y * W + xp) * 4;
              s += Math.abs(A[i] - B[i]);
              n++;
            }
          return s / n;
        };
        return { ok: true, eye: diff(0.2, 0.42), lip: diff(0.58, 0.74) };
      });
    }, afterOn);
    if (!lipWarp.ok) fail("closed-mouth lip warp: preview not found");
    // The lip toggle must move the lips substantially more than the eyes.
    if (lipWarp.lip < 1.0 || lipWarp.lip <= lipWarp.eye * 3) {
      fail(
        `lip warp not firing on a closed mouth: lip Δ${lipWarp.lip.toFixed(2)} vs eye Δ${lipWarp.eye.toFixed(2)} (toggling lips barely changed the lips)`,
      );
    }
    log(
      `closed-mouth lip warp isolated (lips-on vs off: lip Δ${lipWarp.lip.toFixed(2)} ≫ eye Δ${lipWarp.eye.toFixed(2)}) ✓`,
    );

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
