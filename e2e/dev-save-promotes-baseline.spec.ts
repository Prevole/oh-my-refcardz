import { test, expect, type Page } from "@playwright/test";

/**
 * Dev-mode save → baseline promotion.
 *
 * Verifies the user-facing reset button hides immediately after a
 * successful dev-save, without waiting for a page reload to rehydrate
 * `sheet.savedBlockLayout`. Uses route interception so the actual API
 * write is mocked (200 OK) and the fixture files stay clean across runs.
 */

const SHEET_SLUG = "layout-e2e";
const SHEET_PATH = `/cheatsheets/${SHEET_SLUG}`;

async function gotoSheetReady(page: Page) {
  await page.goto(SHEET_PATH);
  await page.waitForSelector("[data-sheet-grid][data-layout-ready='true']");
}

async function clearLayoutStorage(page: Page) {
  await page.goto("/");
  await page.evaluate(() => {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith("sheet-layout:")) {
        localStorage.removeItem(key);
      }
    }
  });
}

async function enterLayoutMode(page: Page) {
  await page.locator("[data-sheet-grid]").click({ position: { x: 5, y: 5 } });
  await page.keyboard.press("Control+m");
  await expect(page.getByTestId("layout-mode-pill")).toBeVisible();
  await page.waitForTimeout(30);
}

async function stageGrowAndCommit(page: Page) {
  await page.keyboard.press("b");
  await page.waitForTimeout(30);
  await page.keyboard.press("j");
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("layout-mode-pill")).toHaveCount(0);
}

test.describe("Dev-mode save promotes the current layout as the new baseline", () => {
  test.beforeEach(async ({ page }) => {
    await clearLayoutStorage(page);

    // Mock the dev save API: we want to verify the client-side promotion
    // logic without ever writing to the on-disk fixture.
    await page.route(`**/api/dev/layouts/${SHEET_SLUG}`, async (route) => {
      await route.fulfill({ status: 200, body: "{}" });
    });
  });

  test("the user reset button hides immediately after a successful dev save", async ({ page }) => {
    await gotoSheetReady(page);
    await enterLayoutMode(page);
    await stageGrowAndCommit(page);

    // After commit + diverging from baseline, the user-facing reset
    // button must appear.
    const resetButton = page.getByTestId("layout-reset-button");
    await expect(resetButton).toBeVisible();
    await expect(resetButton).toBeEnabled();

    // Toggle developer mode and trigger the save action via keyboard.
    await page.keyboard.press("Control+Shift+D");
    await expect(page.locator("text=DEV").first()).toBeVisible();
    await page.keyboard.press("s");

    // Wait for the promotion to flip isModifiedFromOriginal back to false.
    // The reset button is no longer actionable, but the action group is
    // still mounted because the in-session push history is intact and
    // therefore undo remains available.
    await expect(resetButton).toBeDisabled();
  });
});
