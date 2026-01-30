import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for parallel CoAuth tests
 * This config allows multiple test instances to run in parallel
 */
export default defineConfig({
  testDir: './tests',
  /* Run tests in files in parallel */
  fullyParallel: true, // Enable parallel execution
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Allow multiple workers for parallel execution */
  workers: 5, // Run 3 tests in parallel (adjust based on your machine's capacity)
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: [
    ['list'],
    ['html', { open: 'never' }]
  ],
  /* Test timeout - increased for parallel runs */
  timeout: 600000, // 10 minutes per test
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',

    /* Screenshot on failure */
    screenshot: 'only-on-failure',

    /* Video on failure */
    video: 'retain-on-failure',

    /* Default timeout for actions */
    actionTimeout: 60000,

    /* Default timeout for navigation */
    navigationTimeout: 60000,
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1920, height: 1080 },
      },
    },
  ],
});

