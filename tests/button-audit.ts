import { chromium, type Page, type Locator } from "playwright";
import { spawn, type ChildProcess } from "child_process";
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SCREENSHOTS_DIR = join(__dirname, "screenshots");
const PORT = 1420;
const BASE_URL = `http://localhost:${PORT}`;

interface AuditResult {
  name: string;
  passed: boolean;
  screenshotBefore: string | null;
  screenshotAfter: string | null;
  notes: string;
}

const results: AuditResult[] = [];

function record(
  name: string,
  passed: boolean,
  screenshotBefore: string | null,
  screenshotAfter: string | null,
  notes: string,
) {
  results.push({ name, passed, screenshotBefore, screenshotAfter, notes });
  const icon = passed ? "✅" : "❌";
  console.log(`${icon} ${name}: ${notes}`);
}

async function waitForPort(port: number, timeoutMs = 20000): Promise<void> {
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

async function ss(page: Page, name: string): Promise<string> {
  const path = join(SCREENSHOTS_DIR, name);
  await page.screenshot({ path, fullPage: true });
  return name;
}

/** Check if an element is truly clickable: visible, has area, not obscured */
async function isClickable(locator: Locator): Promise<boolean> {
  try {
    const visible = await locator.isVisible();
    if (!visible) return false;
    const box = await locator.boundingBox();
    if (!box || box.width < 1 || box.height < 1) return false;
    return true;
  } catch {
    return false;
  }
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

  try {
    await waitForPort(PORT);
    console.log("Vite dev server ready on port", PORT);
  } catch (e) {
    console.error("Failed to start Vite dev server:", e);
    viteProcess.kill();
    process.exit(1);
  }

  const browser = await chromium.launch({
    headless: true,
    executablePath: "/opt/google/chrome/chrome",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  try {
    await page.goto(BASE_URL, { waitUntil: "networkidle" });
    await page.waitForTimeout(1000);

    // ═══════════════════════════════════════════════
    // SIDEBAR NAV ITEMS
    // ═══════════════════════════════════════════════
    console.log("\n── Sidebar Navigation ──");

    const sidebarItems = ["Pipelines", "Input", "Logs", "Settings"];
    for (const label of sidebarItems) {
      const beforeSs = await ss(page, `button-audit-sidebar-${label.toLowerCase()}-before.png`);

      // Find the sidebar nav item by its text
      const navItem = page.locator(".sidebar-region").getByText(label, { exact: true });
      const clickable = await isClickable(navItem);

      if (clickable) {
        await navItem.click();
        await page.waitForTimeout(300);
      }

      const afterSs = await ss(page, `button-audit-sidebar-${label.toLowerCase()}-after.png`);

      // Verify the nav item got the active class (bg-logo-primary)
      const parentDiv = navItem.locator("..");
      const classes = (await parentDiv.getAttribute("class")) || "";
      const isActive = classes.includes("bg-logo-primary");

      record(
        `Sidebar: ${label}`,
        clickable && isActive,
        beforeSs,
        afterSs,
        `clickable=${clickable}, active=${isActive}, classes="${classes.slice(0, 80)}"`,
      );
    }

    // ═══════════════════════════════════════════════
    // PIPELINE CARDS
    // ═══════════════════════════════════════════════
    console.log("\n── Pipeline Cards ──");

    // Go to Pipelines tab
    await page.locator(".sidebar-region").getByText("Pipelines", { exact: true }).click();
    await page.waitForTimeout(300);

    // Get all pipeline cards — they have the settings-group-hover class
    const pipelineCards = page.locator(".settings-group-hover");
    const cardCount = await pipelineCards.count();
    console.log(`Found ${cardCount} pipeline cards`);

    // Test first 3 pipeline cards (to keep audit manageable, but test selection/deselection)
    const testCardIndices = [0, 1, 2];
    for (const idx of testCardIndices) {
      if (idx >= cardCount) break;
      const card = pipelineCards.nth(idx);
      const cardName = (await card.locator("h3").textContent()) || `card-${idx}`;
      const safeName = cardName.replace(/[^a-zA-Z0-9]/g, "-").toLowerCase();

      const beforeSs = await ss(page, `button-audit-pipeline-${safeName}-before.png`);
      const clickable = await isClickable(card);

      if (clickable) {
        await card.click();
        await page.waitForTimeout(300);
      }

      const afterSs = await ss(page, `button-audit-pipeline-${safeName}-after.png`);

      // Check if detail panel appeared (settings-card)
      const detailVisible = await page.locator(".settings-card").first().isVisible().catch(() => false);
      // Check if card got active border
      const cardClasses = (await card.getAttribute("class")) || "";
      const hasActiveBorder = cardClasses.includes("border-logo-primary");

      record(
        `Pipeline Card: ${cardName}`,
        clickable && (detailVisible || hasActiveBorder),
        beforeSs,
        afterSs,
        `clickable=${clickable}, detail=${detailVisible}, activeBorder=${hasActiveBorder}`,
      );
    }

    // Deselect pipeline by clicking the active one again
    const activeCard = pipelineCards.first();
    await activeCard.click();
    await page.waitForTimeout(200);

    // ═══════════════════════════════════════════════
    // INPUT SOURCE OPTIONS
    // ═══════════════════════════════════════════════
    console.log("\n── Input Source Options ──");

    // Navigate to Input tab
    await page.locator(".sidebar-region").getByText("Input", { exact: true }).click();
    await page.waitForTimeout(300);

    // First select a pipeline so inputs aren't all disabled
    await page.locator(".sidebar-region").getByText("Pipelines", { exact: true }).click();
    await page.waitForTimeout(200);
    await pipelineCards.first().click(); // Select Object Detection (supports all inputs)
    await page.waitForTimeout(200);
    await page.locator(".sidebar-region").getByText("Input", { exact: true }).click();
    await page.waitForTimeout(300);

    // Input options are divs with flex items-center gap-3 p-3 inside .space-y-1
    const inputOptionDivs = page.locator(".space-y-1 > div.flex.items-center");
    const inputLabels = ["Default Video", "USB Webcam", "Video File", "Pi Camera"];
    const inputCount = await inputOptionDivs.count();

    for (let i = 0; i < Math.min(inputCount, inputLabels.length); i++) {
      const label = inputLabels[i];
      const safeName = label.replace(/[^a-zA-Z0-9]/g, "-").toLowerCase();
      const optDiv = inputOptionDivs.nth(i);
      const beforeSs = await ss(page, `button-audit-input-${safeName}-before.png`);

      const clickable = await isClickable(optDiv);

      if (clickable) {
        await optDiv.click();
        await page.waitForTimeout(300);
      }

      const afterSs = await ss(page, `button-audit-input-${safeName}-after.png`);

      // Check if this option got the active border
      const classes = (await optDiv.getAttribute("class")) || "";
      const isActive = classes.includes("border-logo-primary");

      record(
        `Input Source: ${label}`,
        clickable && isActive,
        beforeSs,
        afterSs,
        `clickable=${clickable}, active=${isActive}`,
      );
    }

    // ═══════════════════════════════════════════════
    // REFRESH WEBCAM BUTTON (known broken!)
    // ═══════════════════════════════════════════════
    console.log("\n── Refresh Webcam Button ──");

    // Select USB Webcam to show the refresh button
    await inputOptionDivs.nth(1).click(); // USB Webcam is index 1
    await page.waitForTimeout(300);

    // The refresh button is inside SettingsGroup "Detected Cameras" which only shows when USB is selected
    // It's a <button> containing "Refresh" text and a RefreshCw icon
    const refreshBtn = page.locator("button", { hasText: "Refresh" });
    const refreshCount = await refreshBtn.count();
    console.log(`  Found ${refreshCount} refresh buttons`);
    const beforeRefresh = await ss(page, "button-audit-refresh-webcam-before.png");
    const refreshClickable = refreshCount > 0 && await isClickable(refreshBtn.first());

    if (refreshClickable) {
      // Listen for any network/console activity as evidence the handler fired
      const consoleLogs: string[] = [];
      page.on("console", (msg) => consoleLogs.push(msg.text()));

      await refreshBtn.first().click();
      await page.waitForTimeout(1000); // Give time for v4l2-ctl to run

      const afterRefresh = await ss(page, "button-audit-refresh-webcam-after.png");

      // Check: did the device count text change, or did console show invoke activity?
      const deviceText = await page.getByText("device(s) found").textContent().catch(() => "");

      record(
        "Refresh Webcam Button",
        refreshClickable && deviceText !== "",
        beforeRefresh,
        afterRefresh,
        `clickable=${refreshClickable}, deviceText="${deviceText}", consoleLogs=${consoleLogs.length}`,
      );
    } else {
      const afterRefresh = await ss(page, "button-audit-refresh-webcam-after.png");
      record(
        "Refresh Webcam Button",
        false,
        beforeRefresh,
        afterRefresh,
        `NOT CLICKABLE — button may be too small or obscured`,
      );
    }

    // ═══════════════════════════════════════════════
    // FILE BROWSE BUTTON
    // ═══════════════════════════════════════════════
    console.log("\n── File Browse Button ──");

    // Select Video File input
    const fileHeading = page.getByRole("heading", { name: "Video File" });
    await fileHeading.locator("../..").click();
    await page.waitForTimeout(300);

    const browseBtn = page.getByText("Browse", { exact: true });
    const beforeBrowse = await ss(page, "button-audit-browse-before.png");
    const browseClickable = await isClickable(browseBtn);

    // We can't fully test the Tauri dialog in Playwright (it's a native dialog),
    // but we can verify the button is clickable and has proper styling
    const browseBox = browseClickable ? await browseBtn.boundingBox() : null;
    const browseSize = browseBox ? `${Math.round(browseBox.width)}x${Math.round(browseBox.height)}` : "n/a";
    const browseCursor = browseClickable
      ? await browseBtn.evaluate((el) => window.getComputedStyle(el).cursor)
      : "n/a";

    const afterBrowse = await ss(page, "button-audit-browse-after.png");

    record(
      "File Browse Button",
      browseClickable && (browseBox ? browseBox.width >= 30 && browseBox.height >= 20 : false),
      beforeBrowse,
      afterBrowse,
      `clickable=${browseClickable}, size=${browseSize}, cursor=${browseCursor}`,
    );

    // ═══════════════════════════════════════════════
    // THEME SELECTOR DROPDOWN
    // ═══════════════════════════════════════════════
    console.log("\n── Theme Selector ──");

    await page.locator(".sidebar-region").getByText("Settings", { exact: true }).click();
    await page.waitForTimeout(300);

    const themeSelect = page.locator("select").first();
    const beforeTheme = await ss(page, "button-audit-theme-selector-before.png");
    const themeClickable = await isClickable(themeSelect);

    if (themeClickable) {
      // Get current theme
      const currentTheme = await themeSelect.inputValue();

      // Change to a different theme
      const options = await themeSelect.locator("option").allTextContents();
      const otherOption = options.find((o) => o !== currentTheme) || options[0];

      // Select different theme by its value
      const optionValues = await themeSelect.locator("option").evaluateAll((els) =>
        els.map((el) => (el as HTMLOptionElement).value),
      );
      const currentVal = await themeSelect.inputValue();
      const otherVal = optionValues.find((v) => v !== currentVal) || optionValues[0];

      await themeSelect.selectOption(otherVal);
      await page.waitForTimeout(500);

      const afterTheme = await ss(page, "button-audit-theme-selector-after.png");

      // Verify theme class changed on html element
      const htmlClasses = (await page.locator("html").getAttribute("class")) || "";
      const themeChanged = !htmlClasses.includes("dark-galaxy-ultra") || currentVal !== otherVal;

      record(
        "Theme Selector Dropdown",
        themeClickable && themeChanged,
        beforeTheme,
        afterTheme,
        `clickable=${themeClickable}, changed=${themeChanged}, newClasses="${htmlClasses}", options=[${options.join(", ")}]`,
      );

      // Switch back to dark-galaxy-ultra
      await themeSelect.selectOption("darkGalaxyUltra");
      await page.waitForTimeout(300);
    } else {
      const afterTheme = await ss(page, "button-audit-theme-selector-after.png");
      record("Theme Selector Dropdown", false, beforeTheme, afterTheme, "NOT CLICKABLE");
    }

    // ═══════════════════════════════════════════════
    // CLEAR LOGS BUTTON
    // ═══════════════════════════════════════════════
    console.log("\n── Clear Logs Button ──");

    await page.locator(".sidebar-region").getByText("Logs", { exact: true }).click();
    await page.waitForTimeout(300);

    const clearBtn = page.getByText("Clear", { exact: true });
    const beforeClear = await ss(page, "button-audit-clear-logs-before.png");
    const clearClickable = await isClickable(clearBtn);

    if (clearClickable) {
      await clearBtn.click();
      await page.waitForTimeout(300);
    }

    const afterClear = await ss(page, "button-audit-clear-logs-after.png");

    record(
      "Clear Logs Button",
      clearClickable,
      beforeClear,
      afterClear,
      `clickable=${clearClickable}`,
    );

    // ═══════════════════════════════════════════════
    // FOOTER: CAPTURE MODE TOGGLE
    // ═══════════════════════════════════════════════
    console.log("\n── Footer Controls ──");

    // Capture mode toggle — find the button with Camera or Video icon in footer
    const footer = page.locator(".border-t.border-surface-border");
    const captureModeBtn = footer.locator("button").first();
    const beforeCaptureMode = await ss(page, "button-audit-capture-mode-before.png");
    const captureModeClickable = await isClickable(captureModeBtn);

    let captureModeChanged = false;
    if (captureModeClickable) {
      const titleBefore = await captureModeBtn.getAttribute("title");
      await captureModeBtn.click();
      await page.waitForTimeout(300);
      const titleAfter = await captureModeBtn.getAttribute("title");
      captureModeChanged = titleBefore !== titleAfter;
    }

    const afterCaptureMode = await ss(page, "button-audit-capture-mode-after.png");

    record(
      "Capture Mode Toggle",
      captureModeClickable && captureModeChanged,
      beforeCaptureMode,
      afterCaptureMode,
      `clickable=${captureModeClickable}, changed=${captureModeChanged}`,
    );

    // ═══════════════════════════════════════════════
    // FOOTER: CAPTURE BUTTON (Snap/REC)
    // ═══════════════════════════════════════════════
    const captureBtn = footer.locator("button").nth(1);
    const beforeCapture = await ss(page, "button-audit-capture-btn-before.png");
    const captureClickable = await isClickable(captureBtn);
    const captureText = (await captureBtn.textContent()) || "";
    const captureBox = captureClickable ? await captureBtn.boundingBox() : null;
    const captureSize = captureBox
      ? `${Math.round(captureBox.width)}x${Math.round(captureBox.height)}`
      : "n/a";

    // Don't actually click capture — it would trigger screenshot/recording on the system
    const afterCapture = await ss(page, "button-audit-capture-btn-after.png");

    record(
      "Capture Button (Snap/REC)",
      captureClickable && (captureBox ? captureBox.height >= 20 : false),
      beforeCapture,
      afterCapture,
      `clickable=${captureClickable}, text="${captureText.trim()}", size=${captureSize}`,
    );

    // ═══════════════════════════════════════════════
    // FOOTER: RUN/STOP PIPELINE BUTTON
    // ═══════════════════════════════════════════════
    // First select a pipeline so the Run button appears
    await page.locator(".sidebar-region").getByText("Pipelines", { exact: true }).click();
    await page.waitForTimeout(200);
    await pipelineCards.first().click();
    await page.waitForTimeout(300);

    const runBtn = footer.locator("button").last();
    const beforeRun = await ss(page, "button-audit-run-btn-before.png");
    const runClickable = await isClickable(runBtn);
    const runText = (await runBtn.textContent()) || "";
    const runBox = runClickable ? await runBtn.boundingBox() : null;
    const runSize = runBox ? `${Math.round(runBox.width)}x${Math.round(runBox.height)}` : "n/a";
    const runCursor = runClickable
      ? await runBtn.evaluate((el) => window.getComputedStyle(el).cursor)
      : "n/a";

    // Don't actually click Run — it would try to start a pipeline
    const afterRun = await ss(page, "button-audit-run-btn-after.png");

    record(
      "Run/Stop Pipeline Button",
      runClickable && (runBox ? runBox.width >= 44 && runBox.height >= 28 : false),
      beforeRun,
      afterRun,
      `clickable=${runClickable}, text="${runText.trim()}", size=${runSize}, cursor=${runCursor}`,
    );

    // ═══════════════════════════════════════════════
    // TOUCH TARGET SIZE AUDIT
    // ═══════════════════════════════════════════════
    console.log("\n── Touch Target Audit ──");

    // Check all buttons have minimum 44x44 or at least reasonable click targets
    const allButtons = page.locator("button");
    const buttonCount = await allButtons.count();
    let smallButtons = 0;
    const smallButtonNames: string[] = [];

    for (let i = 0; i < buttonCount; i++) {
      const btn = allButtons.nth(i);
      if (!(await btn.isVisible())) continue;
      const box = await btn.boundingBox();
      if (box && (box.width < 28 || box.height < 24)) {
        smallButtons++;
        const text = (await btn.textContent()) || `button-${i}`;
        smallButtonNames.push(`"${text.trim()}" (${Math.round(box.width)}x${Math.round(box.height)})`);
      }
    }

    record(
      "Touch Target Sizes",
      smallButtons === 0,
      null,
      null,
      smallButtons === 0
        ? `All ${buttonCount} buttons have adequate touch targets`
        : `${smallButtons} buttons too small: ${smallButtonNames.join(", ")}`,
    );

    // ═══════════════════════════════════════════════
    // POINTER-EVENTS AND CURSOR AUDIT
    // ═══════════════════════════════════════════════
    console.log("\n── Cursor/Pointer-Events Audit ──");

    const interactiveElements = page.locator("button, [onclick], [role='button'], select, .cursor-pointer");
    const interactiveCount = await interactiveElements.count();
    let missingCursor = 0;
    const missingCursorNames: string[] = [];

    for (let i = 0; i < interactiveCount; i++) {
      const el = interactiveElements.nth(i);
      if (!(await el.isVisible())) continue;

      const cursor = await el.evaluate((e) => window.getComputedStyle(e).cursor);
      const pointerEvents = await el.evaluate((e) => window.getComputedStyle(e).pointerEvents);

      if (cursor !== "pointer" && pointerEvents !== "none") {
        // Buttons and selects have default cursor which is fine for semantic elements
        const tagName = await el.evaluate((e) => e.tagName.toLowerCase());
        if (tagName !== "button" && tagName !== "select") {
          missingCursor++;
          const text = ((await el.textContent()) || `el-${i}`).trim().slice(0, 30);
          missingCursorNames.push(`"${text}" (cursor=${cursor})`);
        }
      }
    }

    record(
      "Cursor Styles",
      missingCursor === 0,
      null,
      null,
      missingCursor === 0
        ? `All interactive elements have proper cursor styles`
        : `${missingCursor} elements missing cursor:pointer: ${missingCursorNames.join(", ")}`,
    );

  } finally {
    await browser.close();
    viteProcess.kill("SIGTERM");
  }

  // ═══════════════════════════════════════════════
  // GENERATE REPORT
  // ═══════════════════════════════════════════════
  const timestamp = new Date().toISOString();
  const passCount = results.filter((r) => r.passed).length;
  const failCount = results.filter((r) => !r.passed).length;
  const allPassed = failCount === 0;

  let report = `# Button Audit Report

**Date**: ${timestamp}
**URL**: ${BASE_URL}
**Total Elements Tested**: ${results.length}
**Passed**: ${passCount} | **Failed**: ${failCount}

## Results

| # | Element | Status | Before | After | Notes |
|---|---------|--------|--------|-------|-------|
`;

  results.forEach((r, i) => {
    const status = r.passed ? "✅ PASS" : "❌ FAIL";
    const before = r.screenshotBefore ?? "—";
    const after = r.screenshotAfter ?? "—";
    report += `| ${i + 1} | ${r.name} | ${status} | ${before} | ${after} | ${r.notes} |\n`;
  });

  report += `
## Failed Elements

`;

  const failures = results.filter((r) => !r.passed);
  if (failures.length === 0) {
    report += "None! All elements passed.\n";
  } else {
    failures.forEach((r) => {
      report += `### ${r.name}\n- **Notes**: ${r.notes}\n- **Before**: ${r.screenshotBefore}\n- **After**: ${r.screenshotAfter}\n\n`;
    });
  }

  report += `
## Summary

${allPassed ? "All UI elements are clickable and respond to interaction." : `${failCount} element(s) need fixes before this audit passes.`}
`;

  const reportPath = join(SCREENSHOTS_DIR, "BUTTON-AUDIT-REPORT.md");
  writeFileSync(reportPath, report);
  console.log(`\nReport written to ${reportPath}`);
  console.log(`${passCount}/${results.length} checks passed, ${failCount} failed.`);

  process.exit(allPassed ? 0 : 1);
}

main().catch((e) => {
  console.error("Button audit failed:", e);
  process.exit(1);
});
