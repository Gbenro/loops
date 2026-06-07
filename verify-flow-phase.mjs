import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

try {
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });
  
  // Navigate to phase explorer
  const beginButton = page.locator('button:has-text("Begin")');
  if (await beginButton.isVisible()) await beginButton.click();
  await page.waitForTimeout(500);
  
  // Navigate to "The eight phases"
  const nextButton = page.locator('button:has-text("Next"), button:has-text("Show me around")');
  if (await nextButton.count() > 0) await nextButton.last().click();
  await page.waitForTimeout(500);
  
  // Click "Explore the phases"
  const exploreButton = page.locator('button:has-text("Explore the phases")');
  if (await exploreButton.isVisible()) {
    await exploreButton.click();
    await page.waitForTimeout(800);
  }
  
  // Navigate to Waxing Crescent (one Next click from New Moon)
  const nextPhaseBtn = page.locator('button:has-text("Next ›")');
  if (await nextPhaseBtn.isEnabled()) {
    await nextPhaseBtn.click();
    await page.waitForTimeout(800);
  }
  
  // Take screenshot of Waxing Crescent (Flow phase)
  const pageText = await page.textContent('body');
  const isFlowPhase = pageText.includes('Crescent') || pageText.includes('Waxing');
  console.log(`Currently viewing: ${isFlowPhase ? 'Waxing Crescent (Flow)' : 'Unknown phase'}`);
  
  await page.screenshot({ path: '/tmp/luna-flow-phase.png', fullPage: true });
  console.log('📸 Screenshot: /tmp/luna-flow-phase.png');
  
  // Check for both phase types visible
  const hasThreshold = pageText.includes('Threshold');
  const hasFlow = pageText.includes('Flow');
  
  console.log(`\nPage contains:`);
  console.log(`  Threshold: ${hasThreshold}`);
  console.log(`  Flow: ${hasFlow}`);
  
  // Check the HTML content more carefully
  const html = await page.content();
  
  // Search for color values in different formats
  const results = {
    'Hex #F5E6C8': (html.match(/F5E6C8/gi) || []).length,
    'Hex #f5e6c8': (html.match(/f5e6c8/gi) || []).length,
    'RGB 245,230,200': (html.match(/245,230,200/g) || []).length,
    'Hex #C9A84C': (html.match(/C9A84C/gi) || []).length,
    'Hex #c9a84c': (html.match(/c9a84c/gi) || []).length,
    'RGB 201,168,76': (html.match(/201,168,76/g) || []).length,
  };
  
  console.log('\n=== Color Occurrence in HTML ===');
  Object.entries(results).forEach(([label, count]) => {
    console.log(`${label}: ${count}`);
  });
  
} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
} finally {
  await browser.close();
}
