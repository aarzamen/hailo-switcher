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
      const navItem = page.locator(".sidebar-region").getByText(label, { exact: true });
      const clickable = await isClickable(navItem);

      if (clickable) {
        await navItem.click();
        await page.waitForTimeout(300);
      }

      const afterSs = await ss(page, `button-audit-sidebar-${label.toLowerCase()}-after.png`);
      const parentDiv = navItem.locator("..");
      const classes = (await parentDiv.getAttribute("class")) || "";
      const isActive = classes.includes("bg-logo-primary");

      record(
        `Sidebar: ${label}`,
        clickable && isActive,
        beforeSs,
        afterSs,
        `clickable=${clickable}, active=${isActive}`,
      );
    }

    // ═══════════════════════════════════════════════
    // PIPELINE CARDS
    // ═══════════════════════════════════════════════
    console.log("\n── Pipeline Cards ──");

    await page.locator(".sidebar-region").getByText("Pipelines", { exact: true }).click();
    await page.waitForTimeout(300);

    const pipelineCards = page.locator(".settings-group-hover");
    const cardCount = await pipelineCards.count();
    console.log(`Found ${cardCount} pipeline cards`);

    for (const idx of [0, 1, 2]) {
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

      const detailVisible = await page.locator(".settings-card").first().isVisible().catch(() => false);
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

    // Deselect
    await pipelineCards.first().click();
    await page.waitForTimeout(200);

    // ═══════════════════════════════════════════════
    // UNIFIED SOURCE PICKER
    // ═══════════════════════════════════════════════
    console.log("\n── Unified Source Picker ──");

    // Select a pipeline first so sources work in context
    await page.locator(".sidebar-region").getByText("Pipelines", { exact: true }).click();
    await page.waitForTimeout(200);
    await pipelineCards.first().click();
    await page.waitForTimeout(200);
    await page.locator(".sidebar-region").getByText("Input", { exact: true }).click();
    await page.waitForTimeout(500);

    // Source picker uses <button> elements inside the source list
    const sourceButtons = page.locator(".space-y-1 > button");
    const sourceCount = await sourceButtons.count();
    console.log(`  Found ${sourceCount} source buttons`);

    // Test clicking each available source
    for (let i = 0; i < sourceCount; i++) {
      const btn = sourceButtons.nth(i);
      const label = ((await btn.locator("h3").textContent()) || `source-${i}`).trim();
      const safeName = label.replace(/[^a-zA-Z0-9]/g, "-").toLowerCase();

      const beforeSs = await ss(page, `button-audit-source-${safeName}-before.png`);
      const clickable = await isClickable(btn);
      const disabled = await btn.isDisabled();

      if (clickable && !disabled) {
        await btn.click();
        await page.waitForTimeout(300);
      }

      const afterSs = await ss(page, `button-audit-source-${safeName}-after.png`);
      const classes = (await btn.getAttribute("class")) || "";
      const isActive = classes.includes("border-logo-primary");

      record(
        `Source: ${label}`,
        (clickable && !disabled && isActive) || disabled,
        beforeSs,
        afterSs,
        `clickable=${clickable}, disabled=${disabled}, active=${isActive}`,
      );
    }

    // ═══════════════════════════════════════════════
    // REFRESH SOURCES BUTTON
    // ═══════════════════════════════════════════════
    console.log("\n── Refresh Sources Button ──");

    const refreshBtn = page.locator("button", { hasText: "Refresh" });
    const refreshCount = await refreshBtn.count();
    console.log(`  Found ${refreshCount} refresh buttons`);
    const beforeRefresh = await ss(page, "button-audit-refresh-sources-before.png");
    const refreshClickable = refreshCount > 0 && await isClickable(refreshBtn.first());

    if (refreshClickable) {
      await refreshBtn.first().click();
      await page.waitForTimeout(1000);
    }

    const afterRefresh = await ss(page, "button-audit-refresh-sources-after.png");
    const refreshBox = refreshClickable ? await refreshBtn.first().boundingBox() : null;
    const refreshSize = refreshBox ? `${Math.round(refreshBox.width)}x${Math.round(refreshBox.height)}` : "n/a";

    record(
      "Refresh Sources Button",
      refreshClickable,
      beforeRefresh,
      afterRefresh,
      `clickable=${refreshClickable}, size=${refreshSize}`,
    );

    // ═══════════════════════════════════════════════
    // FILE BROWSE BUTTON (select Video File source first)
    // ═══════════════════════════════════════════════
    console.log("\n── File Browse Button ──");

    const fileBtn = sourceButtons.filter({ hasText: "Video File" }).first();
    if (await isClickable(fileBtn)) {
      await fileBtn.click();
      await page.waitForTimeout(300);
    }

    const browseBtn = page.getByText("Browse", { exact: true });
    const beforeBrowse = await ss(page, "button-audit-browse-before.png");
    const browseClickable = await isClickable(browseBtn);
    const browseBox = browseClickable ? await browseBtn.boundingBox() : null;
    const browseSize = browseBox ? `${Math.round(browseBox.width)}x${Math.round(browseBox.height)}` : "n/a";

    const afterBrowse = await ss(page, "button-audit-browse-after.png");

    record(
      "File Browse Button",
      browseClickable && (browseBox ? browseBox.width >= 30 && browseBox.height >= 20 : false),
      beforeBrowse,
      afterBrowse,
      `clickable=${browseClickable}, size=${browseSize}`,
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
      const currentVal = await themeSelect.inputValue();
      const optionValues = await themeSelect.locator("option").evaluateAll((els) =>
        els.map((el) => (el as HTMLOptionElement).value),
      );
      const otherVal = optionValues.find((v) => v !== currentVal) || optionValues[0];

      await themeSelect.selectOption(otherVal);
      await page.waitForTimeout(500);

      const htmlClasses = (await page.locator("html").getAttribute("class")) || "";
      const themeChanged = currentVal !== otherVal;

      const afterTheme = await ss(page, "button-audit-theme-selector-after.png");

      record(
        "Theme Selector Dropdown",
        themeClickable && themeChanged,
        beforeTheme,
        afterTheme,
        `clickable=${themeClickable}, changed=${themeChanged}, classes="${htmlClasses}"`,
      );

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
    if (clearClickable) await clearBtn.click();
    await page.waitForTimeout(300);
    const afterClear = await ss(page, "button-audit-clear-logs-after.png");

    record("Clear Logs Button", clearClickable, beforeClear, afterClear, `clickable=${clearClickable}`);

    // ═══════════════════════════════════════════════
    // FOOTER CONTROLS
    // ═══════════════════════════════════════════════
    console.log("\n── Footer Controls ──");

    const footer = page.locator(".border-t.border-surface-border");

    // Capture mode toggle
    const captureModeBtn = footer.locator("button").first();
    const beforeCM = await ss(page, "button-audit-capture-mode-before.png");
    const cmClickable = await isClickable(captureModeBtn);
    let cmChanged = false;
    if (cmClickable) {
      const titleBefore = await captureModeBtn.getAttribute("title");
      await captureModeBtn.click();
      await page.waitForTimeout(300);
      const titleAfter = await captureModeBtn.getAttribute("title");
      cmChanged = titleBefore !== titleAfter;
    }
    const afterCM = await ss(page, "button-audit-capture-mode-after.png");
    record("Capture Mode Toggle", cmClickable && cmChanged, beforeCM, afterCM, `clickable=${cmClickable}, changed=${cmChanged}`);

    // Capture button
    const captureBtn = footer.locator("button").nth(1);
    const beforeCap = await ss(page, "button-audit-capture-btn-before.png");
    const capClickable = await isClickable(captureBtn);
    const capBox = capClickable ? await captureBtn.boundingBox() : null;
    const capSize = capBox ? `${Math.round(capBox.width)}x${Math.round(capBox.height)}` : "n/a";
    const afterCap = await ss(page, "button-audit-capture-btn-after.png");
    record("Capture Button", capClickable && (capBox ? capBox.height >= 28 : false), beforeCap, afterCap, `clickable=${capClickable}, size=${capSize}`);

    // Run/Stop button — need pipeline selected
    await page.locator(".sidebar-region").getByText("Pipelines", { exact: true }).click();
    await page.waitForTimeout(200);
    await pipelineCards.first().click();
    await page.waitForTimeout(300);

    const runBtn = footer.locator("button").last();
    const beforeRun = await ss(page, "button-audit-run-btn-before.png");
    const runClickable = await isClickable(runBtn);
    const runBox = runClickable ? await runBtn.boundingBox() : null;
    const runSize = runBox ? `${Math.round(runBox.width)}x${Math.round(runBox.height)}` : "n/a";
    const afterRun = await ss(page, "button-audit-run-btn-after.png");
    record("Run/Stop Pipeline Button", runClickable && (runBox ? runBox.width >= 44 && runBox.height >= 28 : false), beforeRun, afterRun, `clickable=${runClickable}, size=${runSize}`);

    // ═══════════════════════════════════════════════
    // TOUCH TARGET AUDIT
    // ═══════════════════════════════════════════════
    console.log("\n── Touch Target Audit ──");

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
        ? `All ${buttonCount} visible buttons have adequate touch targets`
        : `${smallButtons} buttons too small: ${smallButtonNames.join(", ")}`,
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
