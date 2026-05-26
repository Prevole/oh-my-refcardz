import { test, expect, type Page } from "@playwright/test";

const SHEET_SLUG = "nav-fixture";
const SHEET_URL = `/cheatsheets/${SHEET_SLUG}`;

// Locators
const helpDialog = (page: Page) =>
  page.getByRole("dialog").filter({ hasText: "HELP" });
const settingsPanel = (page: Page) => page.getByTestId("settings-panel");
const commandModalOverlay = (page: Page) =>
  page.locator("[data-command-modal-overlay]");

test.describe("Help / Settings interaction", () => {
  test.describe("on home page", () => {
    test.beforeEach(async ({ page }) => {
      await page.goto("/");
      await page.waitForSelector("[data-testid='hex-board']");
      await page.evaluate(() => localStorage.clear());
      await page.reload();
      await page.waitForSelector("[data-testid='hex-board']");
    });

    test("'?' then ',' closes Help and opens Settings (S-1c)", async ({
      page,
    }) => {
      await page.keyboard.press("?");
      await expect(helpDialog(page)).toBeVisible();

      await page.keyboard.press(",");
      await expect(helpDialog(page)).not.toBeVisible();
      await expect(settingsPanel(page)).toBeVisible();
    });

    test("',' then '?' closes Settings and opens Help (S-1c)", async ({
      page,
    }) => {
      await page.keyboard.press(",");
      await expect(settingsPanel(page)).toBeVisible();

      await page.keyboard.press("?");
      await expect(settingsPanel(page)).not.toBeVisible();
      await expect(helpDialog(page)).toBeVisible();
    });

    test("second '?' closes Help (re-toggle)", async ({ page }) => {
      await page.keyboard.press("?");
      await expect(helpDialog(page)).toBeVisible();

      await page.keyboard.press("?");
      await expect(helpDialog(page)).not.toBeVisible();
    });

    test("second ',' closes Settings (re-toggle)", async ({ page }) => {
      await page.keyboard.press(",");
      await expect(settingsPanel(page)).toBeVisible();

      await page.keyboard.press(",");
      await expect(settingsPanel(page)).not.toBeVisible();
    });
  });

  test.describe("on cheatsheet page", () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(SHEET_URL);
      await page.waitForSelector("[data-item]");
    });

    test("'?' then ',' closes Help and opens Settings (S-1c)", async ({
      page,
    }) => {
      await page.keyboard.press("?");
      await expect(helpDialog(page)).toBeVisible();

      await page.keyboard.press(",");
      await expect(helpDialog(page)).not.toBeVisible();
      await expect(settingsPanel(page)).toBeVisible();
    });

    test("',' then '?' closes Settings and opens Help (S-1c)", async ({
      page,
    }) => {
      await page.keyboard.press(",");
      await expect(settingsPanel(page)).toBeVisible();

      await page.keyboard.press("?");
      await expect(settingsPanel(page)).not.toBeVisible();
      await expect(helpDialog(page)).toBeVisible();
    });

    test("second '?' closes Help (re-toggle)", async ({ page }) => {
      await page.keyboard.press("?");
      await expect(helpDialog(page)).toBeVisible();

      await page.keyboard.press("?");
      await expect(helpDialog(page)).not.toBeVisible();
    });

    test("'?' from within an item-detail modal opens Help on top (S-1b, universals)", async ({
      page,
    }) => {
      // Open the item-detail modal on an entry that has detailedEntries.
      const copyable = page.locator("[data-copyable='nav-fixture-detailed']");
      await copyable.click();
      await page.keyboard.press("i");

      const itemDetail = commandModalOverlay(page);
      await expect(itemDetail).toBeVisible();

      // The dev/info/copy scopes are modal but '?' is a universal action
      // that pierces the cascade and reaches the global TOGGLE_HELP handler.
      await page.keyboard.press("?");
      const help = helpDialog(page);
      await expect(help).toBeVisible();

      // The cheat-info modal stays open underneath (universals do not close
      // other modals — they just pierce the keyboard cascade).
      await expect(itemDetail).toBeVisible();

      // Verify Help layers visually above the cheat-info modal: compare the
      // resolved z-index of the two overlay containers. Help (--z-popover
      // = 150) must be strictly greater than cheat-info (--z-modal = 100).
      const helpZ = await help
        .evaluate((el) => {
          const overlay = el.closest("[class*='overlay']") ?? el.parentElement;
          return overlay ? Number(getComputedStyle(overlay).zIndex) : NaN;
        });
      const itemZ = await itemDetail.evaluate((el) =>
        Number(getComputedStyle(el).zIndex),
      );
      expect(helpZ).toBeGreaterThan(itemZ);
    });
  });
});
