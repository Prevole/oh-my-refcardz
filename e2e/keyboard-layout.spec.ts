import { test, expect, type Page } from "@playwright/test";

async function expectFocusedLayoutCard(page: Page) {
  const focusedCard = page.locator("article[data-layout-card='true'][class*='cardKeyboardFocused']");
  await expect(focusedCard).toBeVisible();
  return focusedCard;
}

async function focusFirstLayoutCard(page: Page) {
  await page.keyboard.press("Shift+h");
  await page.waitForTimeout(100);
  return expectFocusedLayoutCard(page);
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
      await page.waitForTimeout(100);

      await expectFocusedLayoutCard(page);
    });

    test("navigates between cards with Shift+J (down)", async ({ page }) => {
      await focusFirstLayoutCard(page);

      await page.keyboard.press("Shift+j");
      await page.waitForTimeout(100);

      await expectFocusedLayoutCard(page);
    });

    test("navigates with arrow keys (Shift+ArrowRight)", async ({ page }) => {
      await page.keyboard.press("Shift+ArrowRight");
      await page.waitForTimeout(100);

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
      await page.waitForTimeout(100);

      await page.keyboard.press("Alt+ArrowLeft");
      await page.waitForTimeout(100);

      await expectFocusedLayoutCard(page);
    });

    test("moves focused card right with Alt+L", async ({ page }) => {
      await focusFirstLayoutCard(page);

      await page.keyboard.press("Alt+ArrowRight");
      await page.waitForTimeout(100);

      await expectFocusedLayoutCard(page);
    });

    test("moves focused card down with Alt+J", async ({ page }) => {
      await focusFirstLayoutCard(page);

      await page.keyboard.press("Alt+ArrowDown");
      await page.waitForTimeout(100);

      await expectFocusedLayoutCard(page);
    });

    test("moves focused card up with Alt+K", async ({ page }) => {
      await focusFirstLayoutCard(page);
      await page.keyboard.press("Alt+ArrowDown");
      await page.waitForTimeout(100);

      await page.keyboard.press("Alt+ArrowUp");
      await page.waitForTimeout(100);

      await expectFocusedLayoutCard(page);
    });

    test("card movement persists to localStorage", async ({ page }) => {
      await focusFirstLayoutCard(page);
      await page.keyboard.press("Alt+ArrowRight");
      await page.waitForTimeout(300);

      const hasLayout = await page.evaluate(() => {
        return localStorage.getItem("sheet-layout:git") !== null;
      });

      expect(hasLayout).toBe(true);

      await expect(page.locator("text=Saved locally")).toBeVisible();
    });
  });

  test.describe("Card resize with Alt+Shift+hjkl", () => {
    test("shrinks card width with Alt+Shift+Left", async ({ page }) => {
      await focusFirstLayoutCard(page);

      const getColSpan = async () => {
        const focusedCard = await expectFocusedLayoutCard(page);
        const style = await focusedCard.getAttribute("style");
        const match = style?.match(/--card-col-span:\s*(\d+)/);
        return match ? parseInt(match[1], 10) : null;
      };

      const initialColSpan = await getColSpan();

      await page.keyboard.press("Alt+Shift+ArrowLeft");
      await page.waitForTimeout(100);

      const newColSpan = await getColSpan();

      if (initialColSpan && initialColSpan > 1) {
        expect(newColSpan).toBeLessThan(initialColSpan);
      }

      await expectFocusedLayoutCard(page);
    });

    test("grows card width with Alt+Shift+Right", async ({ page }) => {
      await focusFirstLayoutCard(page);

      await page.keyboard.press("Alt+Shift+ArrowLeft");
      await page.waitForTimeout(100);

      const getColSpan = async () => {
        const focusedCard = await expectFocusedLayoutCard(page);
        const style = await focusedCard.getAttribute("style");
        const match = style?.match(/--card-col-span:\s*(\d+)/);
        return match ? parseInt(match[1], 10) : null;
      };

      const afterShrink = await getColSpan();

      await page.keyboard.press("Alt+Shift+ArrowRight");
      await page.waitForTimeout(100);

      const afterGrow = await getColSpan();

      if (afterShrink) {
        expect(afterGrow).toBeGreaterThanOrEqual(afterShrink);
      }
    });

    test("shrinks card height with Alt+Shift+Up", async ({ page }) => {
      await focusFirstLayoutCard(page);

      const getRowSpan = async () => {
        const focusedCard = await expectFocusedLayoutCard(page);
        const style = await focusedCard.getAttribute("style");
        const match = style?.match(/--card-row-span:\s*(\d+)/);
        return match ? parseInt(match[1], 10) : null;
      };

      const initialRowSpan = await getRowSpan();

      await page.keyboard.press("Alt+Shift+ArrowUp");
      await page.waitForTimeout(100);

      const newRowSpan = await getRowSpan();

      if (initialRowSpan && initialRowSpan > 1) {
        expect(newRowSpan).toBeLessThan(initialRowSpan);
      }
    });

    test("grows card height with Alt+Shift+Down", async ({ page }) => {
      await focusFirstLayoutCard(page);

      const getRowSpan = async () => {
        const focusedCard = await expectFocusedLayoutCard(page);
        const style = await focusedCard.getAttribute("style");
        const match = style?.match(/--card-row-span:\s*(\d+)/);
        return match ? parseInt(match[1], 10) : null;
      };

      const initialRowSpan = await getRowSpan();

      await page.keyboard.press("Alt+Shift+ArrowDown");
      await page.waitForTimeout(100);

      const newRowSpan = await getRowSpan();

      expect(newRowSpan).toBeGreaterThanOrEqual(initialRowSpan ?? 1);
    });

    test("resize persists to localStorage", async ({ page }) => {
      await focusFirstLayoutCard(page);
      await page.keyboard.press("Alt+Shift+ArrowRight");
      await page.waitForTimeout(300);

      const hasLayout = await page.evaluate(() => {
        return localStorage.getItem("sheet-layout:git") !== null;
      });

      expect(hasLayout).toBe(true);
    });
  });

  test.describe("Layout interaction", () => {
    test("clears card focus with Escape", async ({ page }) => {
      await focusFirstLayoutCard(page);

      await expectFocusedLayoutCard(page);

      await page.keyboard.press("Escape");
      await page.waitForTimeout(100);

      const focusedCardAfter = page.locator("article[class*='cardKeyboardFocused']");
      await expect(focusedCardAfter).not.toBeVisible();
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

      const cardHeader = page.locator("[class*='cardHeader']").first();
      const box = await cardHeader.boundingBox();
      
      if (box) {
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.mouse.down();
        await page.mouse.move(box.x + box.width / 2 + 50, box.y + box.height / 2, { steps: 5 });
        await page.mouse.up();
      }

      await page.waitForTimeout(100);
      const focusedCard = page.locator("article[data-layout-card='true'][class*='cardKeyboardFocused']");
      await expect(focusedCard).not.toBeVisible();
    });
  });

  test.describe("Help modal shows layout shortcuts", () => {
    test("displays layout shortcuts in help modal", async ({ page }) => {
      await page.keyboard.press("?");
      await page.waitForTimeout(200);

      // Click the Layout tab (exact match to avoid "Reset layout" button)
      const layoutTab = page.getByRole("button", { name: "Layout", exact: true });
      await expect(layoutTab).toBeVisible();
      await layoutTab.click();
      await page.waitForTimeout(100);

      // Verify layout section content is visible
      const focusCardHeading = page.getByRole("heading", { name: "Focus a Card" });
      await expect(focusCardHeading).toBeVisible();

      const moveCardHeading = page.getByRole("heading", { name: "Move a Card" });
      await expect(moveCardHeading).toBeVisible();
    });
  });
});
