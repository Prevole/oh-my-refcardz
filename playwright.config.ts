import { defineConfig, devices } from "@playwright/test";

// E2E tests run against a dedicated Next.js dev server on port 3100 with the
// content root overridden to `content_test/cheatsheets/`. This keeps the test
// fixtures fully isolated from the production content tree and avoids any
// clash with a developer's `npm run dev` on port 3000.
const TEST_PORT = 3100;
const TEST_BASE_URL = `http://localhost:${TEST_PORT}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  use: {
    baseURL: TEST_BASE_URL,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: `npm run dev -- --port ${TEST_PORT}`,
    url: TEST_BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
    env: {
      OH_MY_REFCARDZ_CONTENT_ROOT: "content_test/cheatsheets",
    },
  },
});
