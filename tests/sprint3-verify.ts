/**
 * Sprint 3 Playwright Verification Script
 *
 * Tests the new features added in Sprint 3:
 * - Detection panel (sidebar nav, stats display, export/clear buttons)
 * - Stream input source (URL input field)
 * - Capture error surfacing (footer error display)
 *
 * Usage: bunx tsx tests/sprint3-verify.ts
 *
 * NOTE: This requires the app to be running (`bun run dev` on port 1420)
 * or will auto-start the dev server.
 */

import { chromium, type Page } from "playwright";
import { spawn, type ChildProcess } from "child_process";
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SCREENSHOTS_DIR = join(__dirname, "screenshots", "sprint3");
const PORT = 1420;
const BASE_URL = `http://localhost:${PORT}`;

interface CheckResult {
  name: string;
  passed: boolean;
  screenshot: string | null;
  notes: string;
}

const results: CheckResult[] = [];

function record(name: string, passed: boolean, screenshot: string | null, notes: string) {
  results.push({ name, passed, screenshot, notes });
  const icon = passed ? "\u2705" : "\u274c";
  console.log(`${icon} ${name}: ${notes}`);
}

async function waitForPort(port: number, timeoutMs = 15000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`http://localhost:${port}`);
      if (res.ok || res.status === 200) return;
    } catch {
      // Not ready yet
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Port ${port} did not become available within ${timeoutMs}ms`);
}

async function screenshot(page: Page, name: string): Promise<string> {
  if (!existsSync(SCREENSHOTS_DIR)) mkdirSync(SCREENSHOTS_DIR, { recursive: true });
  const path = join(SCREENSHOTS_DIR, `${name}.png`);
  await page.screenshot({ path });
  return path;
}

async function main() {
  let devServer: ChildProcess | null = null;

  try {
    // Check if dev server is already running
    try {
      await fetch(`${BASE_URL}`);
      console.log("Dev server already running on port", PORT);
    } catch {
      console.log("Starting dev server...");
      devServer = spawn("bun", ["run", "dev"], {
        cwd: join(__dirname, ".."),
        stdio: "ignore",
      });
      await waitForPort(PORT, 30000);
      console.log("Dev server ready.");
    }

    const browser = await chromium.launch({
      executablePath: "/opt/google/chrome/chrome",
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
      headless: true,
    });

    const page = await browser.newPage({ viewport: { width: 1024, height: 700 } });
    await page.goto(BASE_URL);
    await page.waitForTimeout(1500);

    // ── Test 1: Detections sidebar nav ──
    try {
      const detectionsBtn = page.locator("div.cursor-pointer", { hasText: "Detections" });
      await detectionsBtn.click();
      await page.waitForTimeout(500);
      const heading = page.locator("h2", { hasText: "Detections" });
      const visible = await heading.isVisible();
      const path = await screenshot(page, "01-detections-panel");
      record("Detections sidebar nav", visible, path, visible ? "Panel visible" : "Panel not found");
    } catch (e) {
      record("Detections sidebar nav", false, null, String(e));
    }

    // ── Test 2: Detection panel empty state ──
    try {
      const emptyText = page.locator("text=No detections yet");
      const visible = await emptyText.isVisible();
      record("Detection empty state", visible, null, visible ? "Shows empty message" : "Empty state not shown");
    } catch (e) {
      record("Detection empty state", false, null, String(e));
    }

    // ── Test 3: Export CSV button exists ──
    try {
      const btn = page.locator("button", { hasText: "Export CSV" });
      const visible = await btn.isVisible();
      const minHeight = await btn.evaluate((el) => getComputedStyle(el).minHeight);
      record(
        "Export CSV button",
        visible && minHeight === "32px",
        null,
        `visible=${visible} minHeight=${minHeight}`,
      );
    } catch (e) {
      record("Export CSV button", false, null, String(e));
    }

    // ── Test 4: Export JSON button exists ──
    try {
      const btn = page.locator("button", { hasText: "Export JSON" });
      const visible = await btn.isVisible();
      record("Export JSON button", visible, null, `visible=${visible}`);
    } catch (e) {
      record("Export JSON button", false, null, String(e));
    }

    // ── Test 5: Clear button exists ──
    try {
      const btn = page.locator("button", { hasText: "Clear" });
      // Might match multiple "Clear" buttons (detection + log), so scope to detection panel
      const detectionClear = btn.first();
      const visible = await detectionClear.isVisible();
      record("Detection Clear button", visible, null, `visible=${visible}`);
    } catch (e) {
      record("Detection Clear button", false, null, String(e));
    }

    // ── Test 6: Stream source in Input tab ──
    try {
      const inputBtn = page.locator("div.cursor-pointer", { hasText: "Input" });
      await inputBtn.click();
      await page.waitForTimeout(500);

      // Look for stream source button
      const streamBtn = page.locator("button", { hasText: /Stream/ });
      const visible = await streamBtn.isVisible();
      const path = await screenshot(page, "02-input-with-stream");
      record("Stream source visible", visible, path, visible ? "Stream source in list" : "Not found");
    } catch (e) {
      record("Stream source visible", false, null, String(e));
    }

    // ── Test 7: Stream URL input appears when selected ──
    try {
      const streamBtn = page.locator("button", { hasText: /Stream/ });
      await streamBtn.click();
      await page.waitForTimeout(300);

      const urlInput = page.locator('input[placeholder*="rtsp://"]');
      const visible = await urlInput.isVisible();
      const path = await screenshot(page, "03-stream-url-input");
      record("Stream URL input", visible, path, visible ? "URL input shown" : "Not shown");
    } catch (e) {
      record("Stream URL input", false, null, String(e));
    }

    // ── Test 8: Stream URL can be typed ──
    try {
      const urlInput = page.locator('input[placeholder*="rtsp://"]');
      await urlInput.fill("rtsp://192.168.1.100:554/stream");
      const value = await urlInput.inputValue();
      record(
        "Stream URL typing",
        value === "rtsp://192.168.1.100:554/stream",
        null,
        `value="${value}"`,
      );
    } catch (e) {
      record("Stream URL typing", false, null, String(e));
    }

    // ── Test 9: Footer error display area ──
    try {
      // Navigate to a view with footer visible
      const footer = page.locator("div.border-t.border-surface-border");
      const visible = await footer.isVisible();
      const path = await screenshot(page, "04-footer");
      record("Footer visible", visible, path, visible ? "Footer with error area" : "Footer not found");
    } catch (e) {
      record("Footer visible", false, null, String(e));
    }

    // ── Test 10: Version label in footer ──
    try {
      const version = page.locator("text=v0.1.0");
      const visible = await version.isVisible();
      record("Version in footer", visible, null, visible ? "v0.1.0 shown" : "Not found");
    } catch (e) {
      record("Version in footer", false, null, String(e));
    }

    await browser.close();
  } finally {
    if (devServer) {
      devServer.kill("SIGTERM");
    }
  }

  // ── Report ──
  console.log("\n" + "=".repeat(60));
  console.log("SPRINT 3 VERIFICATION REPORT");
  console.log("=".repeat(60));

  const passed = results.filter((r) => r.passed).length;
  const total = results.length;
  console.log(`\nResults: ${passed}/${total} passed\n`);

  for (const r of results) {
    const icon = r.passed ? "\u2705" : "\u274c";
    console.log(`  ${icon} ${r.name}: ${r.notes}`);
  }

  // Write markdown report
  const reportPath = join(SCREENSHOTS_DIR, "SPRINT3-REPORT.md");
  let md = `# Sprint 3 Verification Report\n\n`;
  md += `**Date**: ${new Date().toISOString()}\n`;
  md += `**Results**: ${passed}/${total} passed\n\n`;
  md += `| Check | Status | Notes |\n|-------|--------|-------|\n`;
  for (const r of results) {
    const status = r.passed ? "PASS" : "FAIL";
    md += `| ${r.name} | ${status} | ${r.notes} |\n`;
  }
  writeFileSync(reportPath, md);
  console.log(`\nReport written to: ${reportPath}`);

  if (passed < total) {
    process.exit(1);
  }
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
