import { test, expect } from '@playwright/test';
test('built Beta starts and opens capture without live services', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = async () => { throw new DOMException('Synthetic denial', 'NotAllowedError'); };
  });
  // Never contact production or send user data from PR checks.
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    return url.hostname === '127.0.0.1' ? route.continue() : route.abort();
  });
  const response = await page.goto('/beta');
  expect(response.status()).toBe(200);
  await expect(page.locator('#app')).not.toBeEmpty();
  await expect(page.locator('a[href="#/echoes"]:visible').first()).toBeVisible();
  await page.locator('a[href="#/echoes"]:visible').first().click();
  await expect(page.locator('#echo-results')).toBeVisible();
  await page.goto('/beta#/field');
  await page.locator('[data-action="capture-voice"]:visible').first().click();
  await expect(page.locator('dialog[open]')).toBeVisible();
  await expect(page.locator('[data-action="record-start"]')).toBeVisible();
  expect(errors).toEqual([]);
});

