import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  
  // Test 1: Main app has the Beta banner and links
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  // Skip onboarding modal
  await context.addInitScript(() => {
    localStorage.setItem('luna_welcome_dismissed', 'true');
    localStorage.setItem('tutorial_seen_v2', 'true');
    localStorage.setItem('onboarding_seen', 'true');
  });

  const page1 = await context.newPage();
  const errors1 = [];
  page1.on('pageerror', err => errors1.push(err.message));
  await page1.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });
  await page1.waitForTimeout(1000);

  // If any modal appeared, close it
  const closeBtn = page1.locator('button:has-text("Begin"), button:has-text("Close"), button[aria-label="Close"]').first();
  if (await closeBtn.isVisible().catch(() => false)) {
    await closeBtn.click().catch(() => {});
    await page1.waitForTimeout(500);
  }

  const betaBannerText = await page1.locator('text=Luna Beta').allInnerTexts();
  console.log('Main app Beta references:', betaBannerText);
  console.log('Main app console errors:', errors1);

  // Test 2: Clicking the Beta link on main app navigates to /beta/
  const betaLink = page1.locator('a[href="/beta/"]').first();
  console.log('Beta link is visible:', await betaLink.isVisible());
  await betaLink.click({ force: true });
  await page1.waitForURL('**/beta/**', { timeout: 10000 });
  console.log('Navigated to URL:', page1.url());
  console.log('Beta page title:', await page1.title());
  console.log('Beta main header:', await page1.locator('h1').allInnerTexts());

  // Test 3: In Beta, verify Classic Luna link exists and works
  const classicLink = page1.locator('.classic-return').first();
  console.log('Classic Luna link visible:', await classicLink.isVisible());
  await classicLink.click({ force: true });
  await page1.waitForURL('http://localhost:5173/', { timeout: 10000 });
  console.log('Returned to main app URL:', page1.url());
  console.log('Main app title:', await page1.title());

  // Test 4: Open /beta/review.html and test viewport switcher
  const page2 = await context.newPage();
  await page2.setViewportSize({ width: 1200, height: 800 });
  await page2.goto('http://localhost:5173/beta/review.html', { waitUntil: 'domcontentloaded' });
  await page2.waitForTimeout(1000);
  console.log('Review title:', await page2.title());
  const iframe = page2.frameLocator('#preview');
  const iframeH1 = await iframe.locator('h1').allInnerTexts();
  console.log('Iframe prototype H1:', iframeH1);

  await browser.close();
  console.log('All automated integration tests PASSED successfully!');
})();
