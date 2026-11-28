import {test,expect} from '@playwright/test';
test('Cosmic Wisdom subsections respond to taps and only the backdrop or close button dismisses the sheet',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.routeWebSocket('**/*',ws=>ws.close());
 await page.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.fulfill({json:[]}));
 await page.goto('/beta#/sky');await page.waitForLoadState('networkidle');
 await page.locator('[data-action="open-deep-sheet"]').first().click();
 await expect(page.locator('.deep-sheet-dialog')).toBeVisible();
 const first=await page.locator('.sheet-body').innerText();
 await page.locator('[data-action="deep-sheet-tab"][data-value="moon"] span').last().click();
 await expect(page.locator('.sheet-body')).not.toHaveText(first);
 for(const id of ['sign','season','weave','phase']){
  await page.locator('[data-action="deep-sheet-tab"][data-value="'+id+'"]').click();
  await expect(page.locator('[data-action="deep-sheet-tab"][data-value="'+id+'"]').first()).toHaveAttribute('aria-pressed','true');
  await expect(page.locator('.sheet-body')).not.toBeEmpty();
 }
 await page.locator('.sheet-body').click({position:{x:10,y:10}});
 await expect(page.locator('.deep-sheet-dialog')).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.getByRole('button',{name:'Close wisdom sheet'}).click();await expect(page.locator('.deep-sheet-dialog')).toHaveCount(0);
 await page.locator('[data-action="open-deep-sheet"]').first().click();
 await page.locator('.deep-sheet-backdrop').click({position:{x:8,y:8}});await expect(page.locator('.deep-sheet-dialog')).toHaveCount(0);
});
