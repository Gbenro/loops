import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

try {
  // Open the app
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });
  console.log('✅ App loaded');
  
  // Check the page HTML for color values
  const html = await page.content();
  
  // Count occurrences of new colors
  const newThresholdCount = (html.match(/F5E6C8/gi) || []).length + (html.match(/245,230,200/g) || []).length;
  const newFlowCount = (html.match(/C9A84C/gi) || []).length + (html.match(/201,168,76/g) || []).length;
  
  // Count old colors
  const oldThresholdCount = (html.match(/f6ad55/gi) || []).length + (html.match(/246,173,85/g) || []).length;
  const oldFlowCount = (html.match(/74c69d/gi) || []).length + (html.match(/116,198,157/g) || []).length;
  
  console.log('\n=== Color Verification ===');
  console.log(`New Threshold Color (#F5E6C8 / rgb(245,230,200)): ${newThresholdCount} occurrences`);
  console.log(`New Flow Color (#C9A84C / rgb(201,168,76)): ${newFlowCount} occurrences`);
  console.log(`\nOld Threshold Color (#f6ad55 / rgb(246,173,85)): ${oldThresholdCount} occurrences`);
  console.log(`Old Flow Color (#74c69d / rgb(116,198,157)): ${oldFlowCount} occurrences`);
  
  // Take a screenshot
  await page.screenshot({ path: '/tmp/luna-loops-main.png', fullPage: true });
  console.log('\n📸 Screenshot saved: /tmp/luna-loops-main.png');
  
  // Check for success
  if (newThresholdCount > 0 && newFlowCount > 0 && oldThresholdCount === 0 && oldFlowCount === 0) {
    console.log('\n✅ Color standardization VERIFIED - old colors not found, new colors present');
  } else if (oldThresholdCount > 0 || oldFlowCount > 0) {
    console.log('\n⚠️  Old colors still present in the code');
  } else if (newThresholdCount === 0 || newFlowCount === 0) {
    console.log('\n⚠️  New colors not yet loaded in the page');
  }
  
} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
} finally {
  await browser.close();
}
