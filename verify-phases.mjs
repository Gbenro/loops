import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

try {
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });
  console.log('✅ App loaded');
  
  // Click the "Begin" button to start the tutorial
  const beginButton = page.locator('button:has-text("Begin")');
  if (await beginButton.isVisible()) {
    await beginButton.click();
    await page.waitForTimeout(500);
    console.log('✅ Clicked Begin button');
  }
  
  // Look for phase cards and navigate through them
  let phaseCount = 0;
  for (let i = 0; i < 3; i++) {
    const nextButton = page.locator('button:has-text("Next"), button:has-text("Show me around")');
    if (await nextButton.count() > 0) {
      await nextButton.last().click();
      await page.waitForTimeout(300);
      phaseCount++;
    }
  }
  
  console.log(`✅ Navigated through ${phaseCount} screens`);
  
  // Take a screenshot
  await page.screenshot({ path: '/tmp/luna-loops-phases.png', fullPage: true });
  console.log('📸 Screenshot saved: /tmp/luna-loops-phases.png');
  
  // Check the HTML for the new flow color
  const html = await page.content();
  
  const thresholdCount = (html.match(/F5E6C8/gi) || []).length;
  const flowCount = (html.match(/C9A84C/gi) || []).length;
  const oldThresholdCount = (html.match(/f6ad55/gi) || []).length;
  const oldFlowCount = (html.match(/74c69d/gi) || []).length;
  
  console.log('\n=== Color Check ===');
  console.log(`Threshold (#F5E6C8): ${thresholdCount}`);
  console.log(`Flow (#C9A84C): ${flowCount}`);
  console.log(`Old Threshold (#f6ad55): ${oldThresholdCount}`);
  console.log(`Old Flow (#74c69d): ${oldFlowCount}`);
  
  // Get visible text to understand what phase we're looking at
  const pageText = await page.textContent('body');
  if (pageText.includes('Threshold')) console.log('✅ Threshold text found');
  if (pageText.includes('Flow')) console.log('✅ Flow text found');
  
} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
} finally {
  await browser.close();
}
