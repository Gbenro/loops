import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  
  await context.addInitScript(() => {
    localStorage.setItem('welcomeModalDismissed', 'true');
    localStorage.setItem('onboardingCompleted', 'true');
    localStorage.setItem('tutorial_seen_v2', 'true');
    localStorage.setItem('onboarding_seen', 'true');
  });

  const page = await context.newPage();
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  await page.screenshot({ path: 'public/main-app-clean.png' });
  await browser.close();
  console.log('Saved clean screenshot to public/main-app-clean.png');
})();
