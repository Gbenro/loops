/* Browser verification for the isolated study. Uses the repository's existing tools. */
const { chromium } = require('playwright');
const AxeBuilder = require('@axe-core/playwright').default;
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const output = path.resolve(__dirname, '../../../../outputs/luna-astra');
const base = 'http://127.0.0.1:5179/';
fs.mkdirSync(output, { recursive: true });

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  const errors = [], unexpectedRequests = [], results = [];
  page.on('pageerror', error => errors.push(error.message));
  await context.route('**/*', route => {
    if (!route.request().url().startsWith(base)) { unexpectedRequests.push(route.request().url()); return route.abort(); }
    return route.continue();
  });
  await context.addInitScript(() => {
    window.__microphoneCalls = 0;
    if (navigator.mediaDevices) navigator.mediaDevices.getUserMedia = () => { window.__microphoneCalls++; throw new Error('The design study must never open a microphone.'); };
  });
  const shot = async name => { await page.screenshot({ path: path.join(output, `${name}.png`), fullPage: false, animations: 'disabled' }); };
  const count = async (selector, expected) => page.waitForFunction(({ selector, expected }) => document.querySelectorAll(selector).length === expected, { selector, expected });
  const navigate = async hash => { await page.goto(base + '#' + hash); await page.locator('#view-title').waitFor(); };
  const check = async (name, run) => { await run(); results.push({ name, passed: true }); };
  const audit = async name => {
    const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    results.push({ name: `Accessibility: ${name}`, violations: result.violations.map(v => ({ id: v.id, impact: v.impact, nodes: v.nodes.map(n => ({ target: n.target, summary: n.failureSummary })) })) });
  };
  try {
    await navigate('field');
    await shot('01-field-desktop');
    await audit('dark Field');
    await navigate('echo/space');
    await shot('02-voice-desktop');
    await audit('dark Echo');
    await navigate('cycle/hunter/2');
    await shot('03-cycle-desktop');
    await audit('dark Cycle');
    await navigate('returns');
    await shot('04-returns-desktop');
    await audit('dark Returns');
    await navigate('field');
    await page.getByRole('button', { name: 'Light appearance', exact: true }).click();
    await shot('05-field-light');
    await audit('light Field');
    await page.getByRole('button', { name: 'Dark appearance', exact: true }).click();
    await page.setViewportSize({ width: 390, height: 844 });
    await shot('06-field-mobile');
    await navigate('echo/space');
    await shot('07-voice-mobile');
    await audit('mobile Echo');
    await navigate('cycle/hunter/2');
    await shot('08-cycle-mobile');
    await navigate('field');
    await page.getByRole('button', { name: 'Record an Echo', exact: true }).click();
    await shot('09-capture-mobile');
    await audit('capture permission dialog');
    await page.keyboard.press('Escape');

    if (!process.argv.includes('--screenshots-only')) {
      await check('Search, format filters, and empty state', async () => {
        await page.getByRole('button', { name: 'Voice', exact: true }).click();
        assert.equal(await page.locator('.echo-row').count(), 3);
        await page.getByRole('textbox', { name: 'Search sample Echoes' }).fill('zz-no-matching-echo');
        assert.equal(await page.locator('.echo-row').count(), 0);
        await page.getByRole('button', { name: 'Show all Echoes', exact: true }).click();
        assert.equal(await page.locator('.echo-row').count(), 7);
      });
      await check('Local audio plays, seeks, pauses, changes speed, and continues across views', async () => {
        await page.getByRole('link', { name: 'The space between things', exact: true }).click();
        await page.getByRole('button', { name: 'Play sample audio', exact: true }).click();
        await page.waitForFunction(() => Number(document.querySelector('input[aria-label="Audio position"]').value) > .3);
        await page.getByRole('button', { name: 'Pause sample audio', exact: true }).click();
        const slider = page.getByRole('slider', { name: 'Audio position' });
        await slider.fill('7');
        assert.ok(Number(await slider.inputValue()) >= 6.9);
        await page.getByRole('button', { name: 'Forward 5 seconds' }).click();
        assert.ok(Number(await slider.inputValue()) >= 11.9);
        await page.getByRole('button', { name: 'Back 5 seconds' }).click();
        await page.getByRole('button', { name: 'Playback speed 1 times' }).click();
        assert.equal(await page.getByRole('button', { name: 'Playback speed 1.25 times' }).count(), 1);
        await page.getByRole('button', { name: 'Hide transcript' }).click();
        assert.equal(await page.locator('.transcript-section blockquote').count(), 0);
        await page.getByRole('button', { name: 'Show transcript' }).click();
        await page.getByRole('link', { name: 'Back to your Field' }).click();
        await page.getByRole('complementary', { name: 'Continuing playback' }).waitFor();
        await page.getByRole('button', { name: 'Resume continuing audio' }).click();
        await page.getByRole('button', { name: 'Pause continuing audio' }).waitFor();
        await page.getByRole('button', { name: 'Close audio player' }).click();
      });
      await check('Echo → Phase → Cycle and empty phase', async () => {
        await page.getByRole('link', { name: 'The space between things', exact: true }).click();
        await page.locator('.detail-context').getByRole('link', { name: 'First Quarter', exact: true }).click();
        await page.waitForURL('**/#cycle/hunter/2');
        await count('.echo-row', 1);
        assert.equal(await page.locator('.echo-row').count(), 1);
        await page.locator('.phase-strip').getByRole('button', { name: 'Full Moon 0 Echoes' }).click();
        await page.getByRole('heading', { name: 'Space, for now.' }).waitFor();
        await page.getByRole('button', { name: 'Whole cycle' }).click();
        await count('.echo-row', 4);
        assert.equal(await page.locator('.echo-row').count(), 4);
      });
      await check('Cycle geography stays constant across phase and time; cycle changes world', async () => {
        await page.getByRole('button', { name: 'Explore atmosphere', exact: true }).click();
        const landscape = page.locator('.atmosphere-preview .landscape');
        const before = await landscape.locator('g > path').evaluateAll(nodes => nodes.map(n => n.getAttribute('d')));
        await page.getByLabel('Phase condition').selectOption('0');
        await page.getByRole('button', { name: 'night', exact: true }).click();
        const after = await landscape.locator('g > path').evaluateAll(nodes => nodes.map(n => n.getAttribute('d')));
        assert.deepEqual(before, after);
        assert.equal(await landscape.getAttribute('data-time'), 'night');
        assert.equal(await landscape.getAttribute('data-phase'), '0');
        await page.getByLabel('Cycle world · proposed mapping').selectOption('harvest');
        await page.waitForFunction(() => document.querySelector('.atmosphere-preview .landscape')?.dataset.world === 'coast');
        assert.equal(await landscape.getAttribute('data-world'), 'coast');
        await page.keyboard.press('Escape');
        assert.equal(await page.locator('dialog[open]').count(), 0);
      });
      await check('Proposed Returns and linked personal reflection preserve original text', async () => {
        await navigate('echo/space');
        const original = await page.locator('.transcript-section blockquote').innerText();
        await page.getByRole('button', { name: 'Add a reflection', exact: true }).click();
        await page.getByLabel('Your reflection', { exact: true }).fill('A synthetic observation added during interface verification.');
        await page.getByRole('button', { name: 'Keep reflection in preview' }).click();
        await page.getByText('A synthetic observation added during interface verification.', { exact: true }).waitFor();
        assert.equal(await page.locator('.transcript-section blockquote').innerText(), original);
        await page.getByRole('link', { name: 'Meet this phase again', exact: false }).click();
        await page.getByText('Proposed experience', { exact: true }).waitFor();
        await count('.return-timeline .echo-row', 3);
        assert.equal(await page.locator('.return-timeline .echo-row').count(), 3);
        await page.getByRole('button', { name: 'Connected moments' }).click();
        assert.ok(await page.locator('.return-timeline .echo-row').count() >= 3);
        await page.getByRole('link', { name: 'The longer way home', exact: true }).click();
        await page.getByRole('heading', { name: 'The longer way home', exact: true }).waitFor();
      });
      await check('Simulated permission denial and written Echo save', async () => {
        await navigate('field');
        await page.getByRole('button', { name: 'Record an Echo', exact: true }).click();
        await page.getByRole('button', { name: 'Explore permission denied' }).click();
        await page.getByRole('dialog').getByRole('button', { name: 'Write instead', exact: true }).click();
        await page.getByLabel('Your words', { exact: true }).fill('A small sample moment, written here.');
        await page.getByRole('button', { name: 'Keep in preview', exact: true }).click();
        await page.getByRole('link', { name: 'Open this Echo' }).click();
        await page.getByRole('heading', { name: 'A small sample moment, written here.', exact: true }).waitFor();
        assert.equal(await page.locator('.voice-player').count(), 0);
      });
      await check('Simulated recording pauses, retains an in-tab draft, retries a failed save', async () => {
        await navigate('field');
        await page.getByRole('button', { name: 'Record an Echo', exact: true }).click();
        await page.getByRole('button', { name: 'Allow in demo' }).click();
        await page.waitForFunction(() => document.querySelector('.capture-timer')?.textContent.includes('0:01'));
        await page.getByRole('button', { name: 'Pause', exact: true }).click();
        await page.getByRole('heading', { name: 'Take your time.' }).waitFor();
        await page.getByRole('button', { name: 'Leave and keep a demo draft' }).click();
        await page.getByRole('button', { name: 'Resume draft' }).click();
        await page.getByRole('heading', { name: 'Take your time.' }).waitFor();
        await page.getByRole('button', { name: 'Resume', exact: true }).click();
        await shot('10-recording-mobile');
        await page.getByRole('button', { name: 'Finish', exact: true }).click();
        await page.getByText('Explore a save state', { exact: true }).click();
        await page.getByLabel('Simulate a failed save').check();
        await page.getByRole('button', { name: 'Keep in preview', exact: true }).click();
        await page.getByRole('button', { name: 'Retry adding Echo' }).waitFor();
        await audit('capture retry dialog');
        await page.getByRole('button', { name: 'Retry adding Echo' }).click();
        await page.getByRole('link', { name: 'Open this Echo' }).click();
        await page.getByRole('heading', { name: 'A new sample Echo', exact: true }).waitFor();
        assert.equal(await page.locator('.voice-player').count(), 1);
      });
      await check('Modal focus stays inside, Escape restores trigger, keyboard navigation works', async () => {
        await navigate('field');
        const trigger = page.getByRole('button', { name: 'Record an Echo', exact: true });
        await trigger.click();
        for (let i = 0; i < 12; i++) {
          await page.keyboard.press('Tab');
          assert.equal(await page.evaluate(() => !!document.activeElement.closest('dialog')), true);
        }
        await page.keyboard.press('Escape');
        assert.equal(await trigger.evaluate(node => document.activeElement === node), true);
        await page.getByRole('link', { name: 'The space between things', exact: true }).focus();
        await page.keyboard.press('Enter');
        await page.getByRole('heading', { name: 'The space between things', exact: true }).waitFor();
        await page.waitForFunction(() => document.activeElement.id === 'view-title');
      });
      await check('Responsive views do not overflow at 320, 390, 768, 1024, and 1440 pixels', async () => {
        for (const width of [320, 390, 768, 1024, 1440]) {
          await page.setViewportSize({ width, height: 900 });
          for (const route of ['field', 'echo/space', 'cycle/hunter/2', 'returns']) {
            await navigate(route);
            const size = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, viewport: innerWidth }));
            assert.ok(size.scroll <= size.viewport + 1, `${route} overflows at ${width}: ${size.scroll}`);
          }
        }
      });
      await check('200% zoom reflows and reduced motion disables simulated wave animation', async () => {
        await navigate('field');
        await page.evaluate(() => { document.documentElement.style.zoom = '2'; });
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
        await page.evaluate(() => { document.documentElement.style.zoom = ''; });
        await page.getByRole('button', { name: 'Record an Echo', exact: true }).click();
        await page.getByRole('button', { name: 'Allow in demo' }).click();
        assert.equal(await page.locator('.voice-wave.is-moving line').first().evaluate(node => getComputedStyle(node).animationName), 'none');
        await page.keyboard.press('Escape');
      });
      await check('No microphone calls, external requests, durable storage, or runtime errors', async () => {
        assert.equal(await page.evaluate(() => window.__microphoneCalls), 0);
        assert.equal(await page.evaluate(() => localStorage.length), 0);
        assert.deepEqual(await page.evaluate(() => indexedDB.databases()), []);
        assert.deepEqual(unexpectedRequests, []);
        assert.deepEqual(errors, []);
      });
      await check('Reload restores the synthetic Field', async () => {
        await navigate('field');
        await page.reload();
        await count('.echo-row', 7);
        assert.equal(await page.locator('.echo-row').count(), 7);
        assert.equal(await page.locator('.draft-strip').count(), 0);
      });
    }
    fs.writeFileSync(path.join(output, 'verification.json'), JSON.stringify({ date: new Date().toISOString(), results, errors, unexpectedRequests }, null, 2));
    const violations = results.filter(r => r.violations?.length);
    console.log(JSON.stringify({ checks: results.length, violations, errors, unexpectedRequests, output }, null, 2));
    if (violations.length) process.exitCode = 1;
  } catch (error) {
    await shot('verification-failure');
    console.error(error);
    fs.writeFileSync(path.join(output, 'verification.json'), JSON.stringify({ results, failure: error.message, errors, unexpectedRequests }, null, 2));
    process.exitCode = 1;
  } finally { await browser.close(); }
})();
