// Luna Loops Visual Testing Script
const { chromium } = require('playwright');

const TARGET_URL = 'http://localhost:5173';

const VIEWPORTS = [
  { name: 'desktop', width: 1920, height: 1080 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'mobile', width: 375, height: 667 },
];

const TABS = ['Sky', 'Loops', 'Echoes', 'Rhythm'];

(async () => {
  console.log('=== Luna Loops Visual Testing ===\n');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Clear localStorage to ensure fresh state (skip onboarding for initial screenshots)
  await page.goto(TARGET_URL);
  await page.evaluate(() => {
    localStorage.setItem('onboardingCompleted', 'true');
    localStorage.setItem('lastOnboardingVersion', '1');
    localStorage.setItem('toursCompleted', JSON.stringify(['sky', 'loops', 'echoes', 'rhythm']));
    localStorage.setItem('ceremonyNewMoonCycle', '999');
    localStorage.setItem('ceremonyWaningCrescentCycle', '999');
  });

  // Reload to apply localStorage changes
  await page.reload();
  await page.waitForLoadState('networkidle');

  const results = [];

  for (const viewport of VIEWPORTS) {
    console.log(`\n--- Testing ${viewport.name} (${viewport.width}x${viewport.height}) ---`);

    await page.setViewportSize({ width: viewport.width, height: viewport.height });

    for (let i = 0; i < TABS.length; i++) {
      const tabName = TABS[i];
      console.log(`  Capturing ${tabName} tab...`);

      // Find and click the tab
      const tabButtons = await page.locator('button[role="tab"], [data-tab], nav button').all();

      // Try to find the tab by text or data attribute
      const tabSelector = `button:has-text("${tabName}"), [data-tab="${tabName.toLowerCase()}"]`;
      try {
        await page.click(tabSelector, { timeout: 3000 });
      } catch (e) {
        // If specific selector doesn't work, try clicking by index in bottom nav
        const navButtons = await page.locator('nav button, .tab-bar button, [class*="tab"]').all();
        if (navButtons.length >= 4 && navButtons[i]) {
          await navButtons[i].click();
        }
      }

      await page.waitForTimeout(500);

      const screenshotPath = `/tmp/luna-${viewport.name}-${tabName.toLowerCase()}.png`;
      await page.screenshot({ path: screenshotPath, fullPage: true });

      results.push({
        viewport: viewport.name,
        tab: tabName,
        path: screenshotPath,
        status: 'captured'
      });

      console.log(`    Saved: ${screenshotPath}`);
    }
  }

  console.log('\n=== Visual Testing Summary ===');
  console.log(`Total screenshots captured: ${results.length}`);
  console.log('\nScreenshot locations:');
  results.forEach(r => console.log(`  - ${r.path}`));

  await browser.close();
  console.log('\nVisual testing complete.');
})();
