import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 45000,
  expect: { timeout: 10000 },
  fullyParallel: true,
  workers: 3,
  reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:4173', trace: 'retain-on-failure' },
  webServer: {
    command: 'pnpm dev --port 4173',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    {
      name: 'mobile-chromium',
      use: { ...devices['Pixel 7'], viewport: { width: 360, height: 800 } },
    },
    { name: 'mobile-webkit', use: { ...devices['iPhone 13'] } },
  ],
});
