import { chromium, type Page } from "playwright";
import { execSync, spawn, type ChildProcess } from "child_process";
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SCREENSHOTS_DIR = join(__dirname, "screenshots");
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
  const icon = passed ? "✅" : "❌";
  console.log(`${icon} ${name}: ${notes}`);
}

async function waitForPort(port: number, timeoutMs = 15000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`http://localhost:${port}`);
      if (res.ok || res.status === 200) return;
    } catch {
      // not ready yet
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Port ${port} not reachable after ${timeoutMs}ms`);
}

async function screenshot(page: Page, name: string): Promise<string> {
  const path = join(SCREENSHOTS_DIR, name);
  await page.screenshot({ path, fullPage: true });
  return name;
}

async function main() {
  if (!existsSync(SCREENSHOTS_DIR)) {
    mkdirSync(SCREENSHOTS_DIR, { recursive: true });
  }

  // Start Vite dev server
  console.log("Starting Vite dev server...");
  const viteProcess: ChildProcess = spawn("bun", ["run", "dev"], {
    cwd: join(__dirname, ".."),
    stdio: "pipe",
    env: { ...process.env },
  });

  let viteStarted = false;
  try {
    await waitForPort(PORT);
    viteStarted = true;
    console.log("Vite dev server ready on port", PORT);
  } catch (e) {
    console.error("Failed to start Vite dev server:", e);
    viteProcess.kill();
    process.exit(1);
  }

  // Launch browser
  const browser = await chromium.launch({
    headless: true,
    executablePath: "/opt/google/chrome/chrome",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  try {
    // ── Check 1: Initial Load ──
    await page.goto(BASE_URL, { waitUntil: "networkidle" });
    await page.waitForTimeout(1000);
    const ssInitial = await screenshot(page, "01-initial-load.png");

    const title = await page.title();
    const hasTitleHailo = title.toLowerCase().includes("hailo");
    const sidebarVisible = await page.locator(".sidebar-region").isVisible();
    const hasDetectionCard = await page.getByText("Object Detection").first().isVisible();

    record("Initial Load", hasTitleHailo && sidebarVisible && hasDetectionCard, ssInitial,
      `Title="${title}", sidebar=${sidebarVisible}, detection card=${hasDetectionCard}`);

    // ── Check 2: Theme Applied ──
    const htmlClasses = await page.locator("html").getAttribute("class") || "";
    const themeApplied = htmlClasses.includes("theme-dark-galaxy-ultra");
    const ssTheme = await screenshot(page, "02-theme-applied.png");
    record("Theme Applied", themeApplied, ssTheme,
      `HTML classes: "${htmlClasses}"`);

    // ── Check 3: Pipeline Selection ──
    await page.getByText("Object Detection").first().click();
    await page.waitForTimeout(500);
    const ssSelected = await screenshot(page, "03-pipeline-selected.png");

    const detailVisible = await page.locator(".settings-card").first().isVisible();
    record("Pipeline Selection", detailVisible, ssSelected,
      `Detail panel visible=${detailVisible}`);

    // ── Check 4: Sidebar Navigation ──
    // Input tab
    await page.locator(".sidebar-region").getByText("Input", { exact: true }).click();
    await page.waitForTimeout(500);
    const ssInput = await screenshot(page, "04-input-tab.png");

    // New unified source picker shows sources from detect_sources
    // In dev mode without Tauri backend, fallback sources are shown
    const hasVideoSource = await page.getByText("Video Source").isVisible();
    const hasSourceButtons = (await page.locator(".space-y-1 > button").count()) > 0;

    // Logs tab
    await page.locator(".sidebar-region").getByText("Logs", { exact: true }).click();
    await page.waitForTimeout(300);
    const ssLogs = await screenshot(page, "05-logs-tab.png");
    const hasLogViewer = await page.getByText("Pipeline Output").isVisible() ||
                         await page.getByText("No output yet").isVisible();

    // Settings tab
    await page.locator(".sidebar-region").getByText("Settings", { exact: true }).click();
    await page.waitForTimeout(300);
    const ssSettings = await screenshot(page, "06-settings-tab.png");
    const hasThemeSelector = await page.locator("select").first().isVisible();
    const hasAbout = await page.getByText("Hailo Demo Switcher").isVisible();

    record("Sidebar Navigation", hasVideoSource && hasLogViewer && hasAbout,
      `${ssInput}, ${ssLogs}, ${ssSettings}`,
      `Input: videoSource=${hasVideoSource} sourceButtons=${hasSourceButtons}; ` +
      `Logs: viewer=${hasLogViewer}; Settings: theme=${hasThemeSelector} about=${hasAbout}`);

    // ── Check 5: Unified Source Picker ──
    await page.locator(".sidebar-region").getByText("Input", { exact: true }).click();
    await page.waitForTimeout(500);

    const sourceButtons = page.locator(".space-y-1 > button");
    const sourceCount = await sourceButtons.count();

    // Click first source
    let sourceClicked = false;
    if (sourceCount > 0) {
      const firstSource = sourceButtons.first();
      await firstSource.click();
      await page.waitForTimeout(300);
      const classes = (await firstSource.getAttribute("class")) || "";
      sourceClicked = classes.includes("border-logo-primary");
    }

    const ssSources = await screenshot(page, "07-source-picker.png");

    // Check for Video File source and browse button
    const fileSource = sourceButtons.filter({ hasText: "Video File" }).first();
    let hasBrowse = false;
    if (await fileSource.isVisible().catch(() => false)) {
      await fileSource.click();
      await page.waitForTimeout(300);
      hasBrowse = await page.getByText("Browse").isVisible();
    }

    const ssFile = await screenshot(page, "08-file-source-selected.png");

    // Check for Refresh button
    const hasRefresh = await page.locator("button", { hasText: "Refresh" }).isVisible();

    record("Unified Source Picker", sourceCount > 0 && sourceClicked,
      `${ssSources}, ${ssFile}`,
      `sources=${sourceCount}, firstSelected=${sourceClicked}, browse=${hasBrowse}, refresh=${hasRefresh}`);

    // ── Check 6: Screen Region Selector ──
    const regionSource = sourceButtons.filter({ hasText: "Screen Region" }).first();
    let hasRegionSelector = false;
    if (await regionSource.isVisible().catch(() => false)) {
      await regionSource.click();
      await page.waitForTimeout(300);
      // Check for the preset buttons (Left Half, Right Half are unique to the region selector)
      hasRegionSelector = await page.getByText("Left Half").isVisible().catch(() => false) ||
                          await page.getByText("Right Half").isVisible().catch(() => false);
    }

    const ssRegion = await screenshot(page, "09-screen-region.png");
    record("Screen Region Selector", hasRegionSelector, ssRegion,
      `regionSelector=${hasRegionSelector}`);

    // ── Check 7: No Input Compatibility Warnings ──
    await page.locator(".sidebar-region").getByText("Pipelines", { exact: true }).click();
    await page.waitForTimeout(300);

    // Click an rpicam pipeline
    const rpicamCard = page.getByText("YOLOv8 Detection").first();
    if (await rpicamCard.isVisible()) {
      await rpicamCard.click();
      await page.waitForTimeout(300);
    }

    const ssNoWarning = await screenshot(page, "10-no-input-warning.png");
    const hasWarning = await page.getByText("requires").isVisible().catch(() => false);
    record("No Input Compatibility Warning", !hasWarning, ssNoWarning,
      `warning visible=${hasWarning} (should be false — unified sources handle all inputs)`);

    // ── Check 8: Footer Status ──
    const ssFooter = await screenshot(page, "11-footer-status.png");
    const footerVisible = await page.locator(".border-t.border-surface-border").isVisible();
    const hasVersion = await page.getByText("v0.1.0").isVisible();
    record("Footer Status", footerVisible && hasVersion, ssFooter,
      `Footer visible=${footerVisible}, version=${hasVersion}`);

    // ── Check 9: Capture Controls ──
    const captureToggle = page.locator(".border-t.border-surface-border button").first();
    const captureClickable = await captureToggle.isVisible();
    let captureToggleWorks = false;
    if (captureClickable) {
      const titleBefore = await captureToggle.getAttribute("title");
      await captureToggle.click();
      await page.waitForTimeout(300);
      const titleAfter = await captureToggle.getAttribute("title");
      captureToggleWorks = titleBefore !== titleAfter;
    }

    const ssCapture = await screenshot(page, "12-capture-controls.png");
    record("Capture Controls", captureToggleWorks, ssCapture,
      `toggle=${captureToggleWorks}`);

    // ── Check 10: Refresh Button Click ──
    await page.locator(".sidebar-region").getByText("Input", { exact: true }).click();
    await page.waitForTimeout(300);

    const refreshBtn = page.locator("button", { hasText: "Refresh" }).first();
    const refreshClickable = await refreshBtn.isVisible();
    if (refreshClickable) {
      await refreshBtn.click();
      await page.waitForTimeout(500);
    }

    const ssRefresh = await screenshot(page, "13-refresh-clicked.png");
    record("Refresh Button Click", refreshClickable, ssRefresh,
      `clicked=${refreshClickable}`);

  } finally {
    await browser.close();
    viteProcess.kill("SIGTERM");
  }

  // ── Generate Report ──
  const timestamp = new Date().toISOString();
  let nodeVersion = "unknown";
  try { nodeVersion = execSync("node --version").toString().trim(); } catch {}

  const allPassed = results.every((r) => r.passed);
  const passCount = results.filter((r) => r.passed).length;

  let report = `# Visual Verification Report

**Date**: ${timestamp}
**Node**: ${nodeVersion}
**Vite Dev Server**: ${BASE_URL}

## Results

| # | Check | Status | Screenshot | Notes |
|---|-------|--------|------------|-------|
`;

  results.forEach((r, i) => {
    const status = r.passed ? "✅ PASS" : "❌ FAIL";
    const ss = r.screenshot ?? "N/A";
    report += `| ${i + 1} | ${r.name} | ${status} | ${ss} | ${r.notes} |\n`;
  });

  report += `
## Summary

**${passCount}/${results.length} checks passed.**
All screenshots saved to \`tests/screenshots/\`.
`;

  const reportPath = join(SCREENSHOTS_DIR, "VERIFICATION-REPORT.md");
  writeFileSync(reportPath, report);
  console.log(`\nReport written to ${reportPath}`);
  console.log(`${passCount}/${results.length} checks passed.`);

  process.exit(allPassed ? 0 : 1);
}

main().catch((e) => {
  console.error("Verification failed:", e);
  process.exit(1);
});
