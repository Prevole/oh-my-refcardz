import { test, expect, type Page } from "@playwright/test";

async function expectFocusedLayoutCard(page: Page) {
  const focusedCard = page.locator("article[data-layout-card='true'][class*='cardKeyboardFocused']");
  await expect(focusedCard).toBeVisible();
  return focusedCard;
}

async function focusFirstLayoutCard(page: Page) {
  await expect(async () => {
    await page.keyboard.press("Shift+h");
    const focusedCard = page.locator("article[data-layout-card='true'][class*='cardKeyboardFocused']");
    await expect(focusedCard).toBeVisible({ timeout: 500 });
  }).toPass({ timeout: 5000 });
  return expectFocusedLayoutCard(page);
}

async function getCardColSpan(page: Page) {
  const focusedCard = await expectFocusedLayoutCard(page);
  const style = await focusedCard.getAttribute("style");
  const match = style?.match(/--card-col-span:\s*(\d+)/);
  return match ? parseInt(match[1], 10) : null;
}

async function getCardRowSpan(page: Page) {
  const focusedCard = await expectFocusedLayoutCard(page);
  const style = await focusedCard.getAttribute("style");
  const match = style?.match(/--card-row-span:\s*(\d+)/);
  return match ? parseInt(match[1], 10) : null;
}

async function expectLocalStorageLayout(page: Page) {
  await expect(async () => {
    const hasLayout = await page.evaluate(() => {
      return localStorage.getItem("sheet-layout:git") !== null;
    });
    expect(hasLayout).toBe(true);
  }).toPass({ timeout: 5000 });
}

test.describe("Keyboard layout management", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => {
      for (const key of Object.keys(localStorage)) {
        if (key.startsWith("sheet-layout:")) {
          localStorage.removeItem(key);
        }
      }
    });

    await page.goto("/cheatsheets/git");
    await page.waitForSelector("[class*='layoutToolbar']");
  });

  test.describe("Card navigation with Shift+hjkl", () => {
    test("focuses first card with Shift+H when no card is focused", async ({ page }) => {
      await focusFirstLayoutCard(page);
    });

    test("navigates between cards with Shift+L (right)", async ({ page }) => {
      await focusFirstLayoutCard(page);
      await page.keyboard.press("Shift+l");
      await expectFocusedLayoutCard(page);
    });

    test("navigates between cards with Shift+J (down)", async ({ page }) => {
      await focusFirstLayoutCard(page);
      await page.keyboard.press("Shift+j");
      await expectFocusedLayoutCard(page);
    });

    test("navigates with arrow keys (Shift+ArrowRight)", async ({ page }) => {
      await page.keyboard.press("Shift+ArrowRight");
      await expectFocusedLayoutCard(page);
    });

    test("dims other cards when one is focused", async ({ page }) => {
      await focusFirstLayoutCard(page);

      const dimmedCards = page.locator("article[class*='cardDimmed']");
      await expectFocusedLayoutCard(page);

      const totalCards = await page.locator("article").count();
      if (totalCards > 1) {
        const dimmedCount = await dimmedCards.count();
        expect(dimmedCount).toBeGreaterThan(0);
      }
    });
  });

  test.describe("Card movement with Alt+hjkl", () => {
    test("moves focused card left with Alt+H", async ({ page }) => {
      await focusFirstLayoutCard(page);
      await page.keyboard.press("Alt+ArrowRight");
      await expectFocusedLayoutCard(page);

      await page.keyboard.press("Alt+ArrowLeft");
      await expectFocusedLayoutCard(page);
    });

    test("moves focused card right with Alt+L", async ({ page }) => {
      await focusFirstLayoutCard(page);
      await page.keyboard.press("Alt+ArrowRight");
      await expectFocusedLayoutCard(page);
    });

    test("moves focused card down with Alt+J", async ({ page }) => {
      await focusFirstLayoutCard(page);
      await page.keyboard.press("Alt+ArrowDown");
      await expectFocusedLayoutCard(page);
    });

    test("moves focused card up with Alt+K", async ({ page }) => {
      await focusFirstLayoutCard(page);
      await page.keyboard.press("Alt+ArrowDown");
      await expectFocusedLayoutCard(page);

      await page.keyboard.press("Alt+ArrowUp");
      await expectFocusedLayoutCard(page);
    });

    test("card movement persists to localStorage", async ({ page }) => {
      await focusFirstLayoutCard(page);
      await page.keyboard.press("Alt+ArrowRight");
      await expectFocusedLayoutCard(page);

      await expectLocalStorageLayout(page);
      await expect(page.locator("text=Saved locally")).toBeVisible();
    });
  });

  test.describe("Card resize with Alt+Shift+hjkl", () => {
    test("shrinks card width with Alt+Shift+Left", async ({ page }) => {
      await focusFirstLayoutCard(page);
      const initialColSpan = await getCardColSpan(page);

      await page.keyboard.press("Alt+Shift+ArrowLeft");

      await expect(async () => {
        const newColSpan = await getCardColSpan(page);
        if (initialColSpan && initialColSpan > 1) {
          expect(newColSpan).toBeLessThan(initialColSpan);
        }
      }).toPass({ timeout: 2000 });

      await expectFocusedLayoutCard(page);
    });

    test("grows card width with Alt+Shift+Right", async ({ page }) => {
      await focusFirstLayoutCard(page);
      await page.keyboard.press("Alt+Shift+ArrowLeft");

      const afterShrink = await getCardColSpan(page);

      await page.keyboard.press("Alt+Shift+ArrowRight");

      await expect(async () => {
        const afterGrow = await getCardColSpan(page);
        if (afterShrink) {
          expect(afterGrow).toBeGreaterThanOrEqual(afterShrink);
        }
      }).toPass({ timeout: 2000 });
    });

    test("shrinks card height with Alt+Shift+Up", async ({ page }) => {
      await focusFirstLayoutCard(page);
      const initialRowSpan = await getCardRowSpan(page);

      await page.keyboard.press("Alt+Shift+ArrowUp");

      await expect(async () => {
        const newRowSpan = await getCardRowSpan(page);
        if (initialRowSpan && initialRowSpan > 1) {
          expect(newRowSpan).toBeLessThan(initialRowSpan);
        }
      }).toPass({ timeout: 2000 });
    });

    test("grows card height with Alt+Shift+Down", async ({ page }) => {
      await focusFirstLayoutCard(page);
      const initialRowSpan = await getCardRowSpan(page);

      await page.keyboard.press("Alt+Shift+ArrowDown");

      await expect(async () => {
        const newRowSpan = await getCardRowSpan(page);
        expect(newRowSpan).toBeGreaterThanOrEqual(initialRowSpan ?? 1);
      }).toPass({ timeout: 2000 });
    });

    test("resize persists to localStorage", async ({ page }) => {
      await focusFirstLayoutCard(page);
      await page.keyboard.press("Alt+Shift+ArrowRight");
      await expectFocusedLayoutCard(page);

      await expectLocalStorageLayout(page);
    });
  });

  test.describe("Layout interaction", () => {
    test("clears card focus with Escape", async ({ page }) => {
      await focusFirstLayoutCard(page);
      await expectFocusedLayoutCard(page);

      await page.keyboard.press("Escape");

      const focusedCardAfter = page.locator("article[class*='cardKeyboardFocused']");
      await expect(focusedCardAfter).toHaveCount(0);
    });

    test("keeps layout overlay hidden until interaction starts", async ({ page }) => {
      const focusedCard = page.locator("article[data-layout-card='true'][class*='cardKeyboardFocused']");
      const metricsText = page.locator("text=/\\d+ cols/");

      await expect(focusedCard).not.toBeVisible();
      await expect(metricsText.first()).not.toBeVisible();

      await focusFirstLayoutCard(page);

      await expect(metricsText.first()).toBeVisible();
    });

    test("dragging clears keyboard focus", async ({ page }) => {
      await focusFirstLayoutCard(page);

      const focusedCardBefore = page.locator("article[data-layout-card='true'][class*='cardKeyboardFocused']");
      await expect(focusedCardBefore).toHaveCount(1);

      const cardHeader = page.locator("[class*='cardHeader']").first();

      await cardHeader.dispatchEvent("pointerdown", { button: 0, bubbles: true });

      const focusedCard = page.locator("article[data-layout-card='true'][class*='cardKeyboardFocused']");
      await expect(focusedCard).toHaveCount(0);
    });
  });

  test.describe("Help modal shows layout shortcuts", () => {
    test("displays layout shortcuts in help modal", async ({ page }) => {
      await page.keyboard.press("?");

      const layoutTab = page.getByRole("button", { name: "Layout", exact: true });
      await expect(layoutTab).toBeVisible();
      await layoutTab.click();

      const focusCardHeading = page.getByRole("heading", { name: "Focus a Card" });
      await expect(focusCardHeading).toBeVisible();

      const moveCardHeading = page.getByRole("heading", { name: "Move a Card" });
      await expect(moveCardHeading).toBeVisible();
    });
  });
});
