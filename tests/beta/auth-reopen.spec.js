import { test, expect, chromium } from '@playwright/test';
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

test('login survives browser restart, IDB recovery and explicit signout', async ({}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Persistent Chromium profile test');
  const profile = await fs.mkdtemp(path.join(os.tmpdir(), 'luna-auth-'));
  const options = {headless:true, ...(existsSync('C:/Program Files/Google/Chrome/Application/chrome.exe') ? {channel:'chrome'} : {})};
  const source = (await fs.readFile(new URL('../../src/lib/authStorage.js',import.meta.url),'utf8')).replace(/^export /gm,'');
  const AUTH='sb-eyxvsbqyzeodsjajfqsj-auth-token';
  const fixture={access_token:'synthetic-access',refresh_token:'synthetic-refresh',expires_at:Math.floor(Date.now()/1000)+3600,user:{id:'synthetic-owner',email:'fixture@example.invalid'}};
  let context;
  async function reopen() {
    context = await chromium.launchPersistentContext(profile, options);
    await context.route('**/*', route => {
      const url=new URL(route.request().url());
      if(url.hostname==='127.0.0.1') return route.continue();
      // No live credentials, provider calls or production records.
      return route.fulfill({status:200,contentType:'application/json',body:'[]'});
    });
    const page=await context.newPage();
    await page.goto('http://127.0.0.1:4178/beta');
    return page;
  }
  try {
    let page=await reopen();
    await page.addScriptTag({content:source+'\nwindow.fixtureStorage=idbStorage;'});
    await page.evaluate(async ({AUTH,fixture}) => {await window.fixtureStorage.setItem(AUTH,JSON.stringify(fixture));},{AUTH,fixture});
    await context.close();

    page=await reopen();
    await expect.poll(()=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)||'null')?.user?.id,AUTH)).toBe('synthetic-owner');
    // Emulate localStorage loss while retaining the durable session.
    await page.evaluate(key=>localStorage.removeItem(key),AUTH);
    await context.close();

    page=await reopen();
    await expect.poll(()=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)||'null')?.user?.id,AUTH)).toBe('synthetic-owner');
    await page.addScriptTag({content:source+'\nwindow.fixtureStorage=idbStorage;'});
    await page.evaluate(async key=>{await window.fixtureStorage.removeItem(key);},AUTH);
    await context.close();

    page=await reopen();
    await expect(page.locator('[data-action="open-auth"]:visible').first()).toBeVisible();
    expect(await page.evaluate(key=>localStorage.getItem(key),AUTH)).toBeNull();
  } finally {
    await context?.close();
    if (profile) {
      await fs.rm(profile, { recursive: true, force: true }).catch(() => {});
    }
  }
});
