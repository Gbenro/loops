import { defineConfig, devices } from '@playwright/test';
import fs from 'node:fs';

const hasLocalChrome = !process.env.CI && fs.existsSync('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe');

export default defineConfig({
  testDir: './tests/beta',
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  use: { baseURL: 'http://127.0.0.1:4178', trace: 'retain-on-failure' },
  projects: [
    {
      name: 'desktop',
      use: {
        ...devices['Desktop Chrome'],
        ...(hasLocalChrome ? { channel: 'chrome' } : {})
      }
    },
    { name: 'mobile-webkit', use: { ...devices['iPhone 12'] } },
  ],
  webServer: {
    command: 'node scripts/serve-beta-ci.mjs',
    url: 'http://127.0.0.1:4178/beta',
    reuseExistingServer: false,
  },
});

