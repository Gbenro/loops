// Luna Loops Visual Testing Script
const { chromium } = require('playwright');

const TARGET_URL = 'http://localhost:5173';
const OUTPUT_DIR = '/tmp/luna-visual';

const VIEWPORTS = [
  { name: 'desktop', width: 1920, height: 1080 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'mobile', width: 375, height: 667 },
];

const TABS = ['Sky', 'Loops', 'Echoes', 'Rhythm'];

async function ensureDir(dir) {
  const fs = require('fs');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

async function dismissAllModals(page) {
  // Dismiss welcome modal ("Skip for now")
  try {
    const skipButton = page.locator('text=Skip for now');
    if (await skipButton.isVisible({ timeout: 1000 })) {
      console.log('  Dismissing welcome modal...');
      await skipButton.click();
      await page.waitForTimeout(300);
    }
  } catch (e) {}

  // Dismiss tour prompt modal ("Show me around" or close button)
  try {
    // Try clicking close/X button on any modal
    const closeButtons = page.locator('button:has-text("×"), button[aria-label="Close"], .modal-close, [data-dismiss]');
    if (await closeButtons.first().isVisible({ timeout: 500 })) {
      await closeButtons.first().click();
      await page.waitForTimeout(300);
    }
  } catch (e) {}

  // Try pressing Escape to close any overlay
  try {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
  } catch (e) {}

  // Click outside any modal overlay
  try {
    const overlay = page.locator('.modal-overlay, [class*="overlay"], [class*="backdrop"]');
    if (await overlay.isVisible({ timeout: 300 })) {
      await page.mouse.click(10, 10);
      await page.waitForTimeout(200);
    }
  } catch (e) {}
}

async function clickTab(page, tabName, tabIndex) {
  // Try multiple selectors to find the tab
  const selectors = [
    `text="${tabName}"`,
    `button:has-text("${tabName}")`,
    `[data-tab="${tabName.toLowerCase()}"]`,
    `[aria-label*="${tabName}"]`,
  ];

  for (const selector of selectors) {
    try {
      const element = page.locator(selector);
      if (await element.isVisible({ timeout: 500 })) {
        await element.click();
        await page.waitForTimeout(300);
        return true;
      }
    } catch (e) {
      continue;
    }
  }

  // Fallback: click by index in navigation
  try {
    const navButtons = page.locator('nav button, .bottom-nav button, [class*="tab-bar"] button');
    const count = await navButtons.count();
    if (count >= 4 && tabIndex < count) {
      await navButtons.nth(tabIndex).click();
      await page.waitForTimeout(300);
      return true;
    }
  } catch (e) {
    console.log(`    Warning: Could not click ${tabName} tab`);
  }

  return false;
}

async function runAxeAudit(page, tabName) {
  try {
    // Inject axe-core
    await page.addScriptTag({
      url: 'https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.8.2/axe.min.js'
    });

    // Run audit
    const results = await page.evaluate(async () => {
      return await axe.run(document, {
        runOnly: {
          type: 'tag',
          values: ['wcag2a', 'wcag2aa', 'best-practice']
        }
      });
    });

    return {
      tab: tabName,
      violations: results.violations,
      passes: results.passes.length,
      incomplete: results.incomplete.length
    };
  } catch (e) {
    console.log(`    Warning: axe-core audit failed for ${tabName}: ${e.message}`);
    return null;
  }
}

(async () => {
  console.log('=== Luna Loops Visual Testing ===\n');

  await ensureDir(OUTPUT_DIR);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Initial load - set localStorage BEFORE the app renders
  await page.goto(TARGET_URL);

  // Set localStorage to skip all onboarding
  await page.evaluate(() => {
    localStorage.setItem('onboardingCompleted', 'true');
    localStorage.setItem('lastOnboardingVersion', '1.0');
    localStorage.setItem('welcomeModalDismissed', 'true');
    localStorage.setItem('toursCompleted', JSON.stringify(['sky', 'loops', 'echoes', 'rhythm']));
    localStorage.setItem('ceremonyNewMoonCycle', '999');
    localStorage.setItem('ceremonyWaningCrescentCycle', '999');
  });

  // Reload to apply localStorage settings before React renders
  await page.reload();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(500);

  // Double-check and dismiss any modals that might still appear
  await dismissAllModals(page);

  const visualResults = [];
  const a11yResults = [];

  // Test each viewport
  for (const viewport of VIEWPORTS) {
    console.log(`\n--- Testing ${viewport.name} (${viewport.width}x${viewport.height}) ---`);

    await page.setViewportSize({ width: viewport.width, height: viewport.height });

    for (let i = 0; i < TABS.length; i++) {
      const tabName = TABS[i];
      console.log(`  ${tabName} tab:`);

      // Navigate to tab
      await clickTab(page, tabName, i);

      // Dismiss any modal that might appear
      await dismissAllModals(page);

      await page.waitForTimeout(500);

      // Screenshot
      const screenshotPath = `${OUTPUT_DIR}/${viewport.name}-${tabName.toLowerCase()}.png`;
      await page.screenshot({ path: screenshotPath, fullPage: true });
      console.log(`    Screenshot: ${screenshotPath}`);

      visualResults.push({
        viewport: viewport.name,
        tab: tabName,
        path: screenshotPath,
        status: 'captured'
      });

      // Run accessibility audit (only on desktop to avoid duplicates)
      if (viewport.name === 'desktop') {
        const auditResult = await runAxeAudit(page, tabName);
        if (auditResult) {
          a11yResults.push(auditResult);
          console.log(`    A11y: ${auditResult.violations.length} violations, ${auditResult.passes} passes`);
        }
      }
    }
  }

  // Test onboarding flow
  console.log('\n--- Testing Onboarding Flow ---');

  // Clear localStorage to show onboarding again
  await page.evaluate(() => {
    localStorage.removeItem('onboardingCompleted');
    localStorage.removeItem('lastOnboardingVersion');
    localStorage.removeItem('welcomeModalDismissed');
    localStorage.removeItem('toursCompleted');
    localStorage.removeItem('ceremonyNewMoonCycle');
    localStorage.removeItem('ceremonyWaningCrescentCycle');
  });

  await page.reload();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);

  // Capture welcome modal
  await page.screenshot({ path: `${OUTPUT_DIR}/onboarding-welcome.png`, fullPage: true });
  console.log('  Welcome modal captured');

  // Click Begin to start tour
  try {
    await page.click('text=Begin', { timeout: 3000 });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: `${OUTPUT_DIR}/onboarding-tour-start.png`, fullPage: true });
    console.log('  Tour start captured');
  } catch (e) {
    console.log('  Could not click Begin button');
  }

  // Summary
  console.log('\n=== Visual Testing Summary ===');
  console.log(`Screenshots captured: ${visualResults.length + 2}`);
  console.log(`Output directory: ${OUTPUT_DIR}`);

  console.log('\n=== Accessibility Summary ===');
  let totalViolations = 0;
  for (const result of a11yResults) {
    if (result) {
      console.log(`\n${result.tab} tab:`);
      console.log(`  Passes: ${result.passes}`);
      console.log(`  Violations: ${result.violations.length}`);
      totalViolations += result.violations.length;

      if (result.violations.length > 0) {
        for (const v of result.violations.slice(0, 5)) {
          console.log(`    - ${v.id}: ${v.description} (${v.nodes.length} nodes)`);
        }
        if (result.violations.length > 5) {
          console.log(`    ... and ${result.violations.length - 5} more`);
        }
      }
    }
  }
  console.log(`\nTotal violations across all tabs: ${totalViolations}`);

  // Write JSON report
  const fs = require('fs');
  const report = {
    timestamp: new Date().toISOString(),
    screenshots: visualResults,
    accessibility: a11yResults,
    summary: {
      totalScreenshots: visualResults.length + 2,
      totalA11yViolations: totalViolations
    }
  };
  fs.writeFileSync(`${OUTPUT_DIR}/report.json`, JSON.stringify(report, null, 2));
  console.log(`\nFull report: ${OUTPUT_DIR}/report.json`);

  await browser.close();
  console.log('\nVisual testing complete.');
})();
