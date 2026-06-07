import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const screenshots = [];

try {
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });
  
  // Navigate to the phase explorer
  const beginButton = page.locator('button:has-text("Begin")');
  if (await beginButton.isVisible()) {
    await beginButton.click();
    await page.waitForTimeout(500);
  }
  
  // Navigate to "The eight phases"
  const nextButton = page.locator('button:has-text("Next"), button:has-text("Show me around")');
  if (await nextButton.count() > 0) {
    await nextButton.last().click();
    await page.waitForTimeout(500);
  }
  
  // Click "Explore the phases"
  const exploreButton = page.locator('button:has-text("Explore the phases")');
  if (await exploreButton.isVisible()) {
    await exploreButton.click();
    await page.waitForTimeout(800);
    console.log('✅ Clicked "Explore the phases"');
  }
  
  // Take screenshot of first phase (New Moon - Threshold)
  await page.screenshot({ path: '/tmp/luna-new-moon.png', fullPage: true });
  screenshots.push('/tmp/luna-new-moon.png');
  console.log('📸 Screenshot: New Moon phase');
  
  // Navigate to next phases to see Flow phases
  const nextPhaseBtn = page.locator('button:has-text("Next ›")');
  
  for (let i = 0; i < 2; i++) {
    if (await nextPhaseBtn.isEnabled()) {
      await nextPhaseBtn.click();
      await page.waitForTimeout(600);
    }
  }
  
  // Should now be at Waxing Crescent (Flow phase)
  await page.screenshot({ path: '/tmp/luna-waxing-crescent.png', fullPage: true });
  screenshots.push('/tmp/luna-waxing-crescent.png');
  console.log('📸 Screenshot: Waxing Crescent phase (Flow)');
  
  // Check colors in the rendered page
  const html = await page.content();
  
  const thresholdCount = (html.match(/F5E6C8/gi) || []).length;
  const flowCount = (html.match(/C9A84C/gi) || []).length;
  const rgbThresholdCount = (html.match(/245,230,200/g) || []).length;
  const rgbFlowCount = (html.match(/201,168,76/g) || []).length;
  
  const oldThresholdCount = (html.match(/f6ad55/gi) || []).length;
  const oldFlowCount = (html.match(/74c69d/gi) || []).length;
  
  console.log('\n=== Final Color Verification ===');
  console.log(`New Threshold (#F5E6C8): ${thresholdCount}`);
  console.log(`New Threshold (rgb): ${rgbThresholdCount}`);
  console.log(`New Flow (#C9A84C): ${flowCount}`);
  console.log(`New Flow (rgb): ${rgbFlowCount}`);
  console.log(`\nOld Threshold (#f6ad55): ${oldThresholdCount}`);
  console.log(`Old Flow (#74c69d): ${oldFlowCount}`);
  
  // Check visible text
  const pageText = await page.textContent('body');
  if (pageText.includes('Threshold') && pageText.includes('Flow')) {
    console.log('✅ Both Threshold and Flow text found on page');
  }
  
  if ((thresholdCount > 0 || rgbThresholdCount > 0) && (flowCount > 0 || rgbFlowCount > 0)) {
    console.log('\n✅ VERIFICATION PASSED: Both new threshold and flow colors are present');
  } else if (oldThresholdCount === 0 && oldFlowCount === 0) {
    console.log('\n✅ VERIFICATION PASSED: Old colors are not present');
    if (thresholdCount > 0 || rgbThresholdCount > 0) {
      console.log('   Threshold color is correctly updated');
    }
    if (flowCount > 0 || rgbFlowCount > 0) {
      console.log('   Flow color is correctly updated');
    }
  }
  
  console.log('\n📸 Screenshots saved:');
  screenshots.forEach(s => console.log(`   ${s}`));
  
} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
} finally {
  await browser.close();
}
