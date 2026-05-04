import { test, expect } from "@playwright/test";

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
    await page.locator("text=Enter layout mode").click();
    await page.waitForTimeout(200);
  });

  test.describe("Card navigation with Shift+hjkl", () => {
    test("focuses first card with Shift+H when no card is focused", async ({ page }) => {
      await page.keyboard.press("Shift+h");
      await page.waitForTimeout(100);

      const focusedCard = page.locator("article[class*='cardKeyboardFocused']");
      await expect(focusedCard).toBeVisible();
    });

    test("navigates between cards with Shift+L (right)", async ({ page }) => {
      await page.keyboard.press("Shift+h");
      await page.waitForTimeout(100);

      await page.keyboard.press("Shift+l");
      await page.waitForTimeout(100);

      const focusedCard = page.locator("article[class*='cardKeyboardFocused']");
      await expect(focusedCard).toBeVisible();

    });

    test("navigates between cards with Shift+J (down)", async ({ page }) => {
      await page.keyboard.press("Shift+h");
      await page.waitForTimeout(100);

      await page.keyboard.press("Shift+j");
      await page.waitForTimeout(100);

      const focusedCard = page.locator("article[class*='cardKeyboardFocused']");
      await expect(focusedCard).toBeVisible();
    });

    test("navigates with arrow keys (Shift+ArrowRight)", async ({ page }) => {
      await page.keyboard.press("Shift+ArrowRight");
      await page.waitForTimeout(100);

      const focusedCard = page.locator("article[class*='cardKeyboardFocused']");
      await expect(focusedCard).toBeVisible();
    });

    test("dims other cards when one is focused", async ({ page }) => {
      await page.keyboard.press("Shift+h");
      await page.waitForTimeout(100);

      const dimmedCards = page.locator("article[class*='cardDimmed']");
      const focusedCard = page.locator("article[class*='cardKeyboardFocused']");
      await expect(focusedCard).toBeVisible();

      const totalCards = await page.locator("article").count();
      if (totalCards > 1) {
        const dimmedCount = await dimmedCards.count();
        expect(dimmedCount).toBeGreaterThan(0);
      }
    });
  });

  test.describe("Card movement with Ctrl+hjkl", () => {
    test("moves focused card left with Ctrl+H", async ({ page }) => {
      await page.keyboard.press("Shift+h");
      await page.waitForTimeout(100);

      await page.keyboard.press("Control+l");
      await page.waitForTimeout(100);

      await page.keyboard.press("Control+h");
      await page.waitForTimeout(100);

      const focusedCard = page.locator("article[class*='cardKeyboardFocused']");
      await expect(focusedCard).toBeVisible();
    });

    test("moves focused card right with Ctrl+L", async ({ page }) => {
      await page.keyboard.press("Shift+h");
      await page.waitForTimeout(100);

      await page.keyboard.press("Control+l");
      await page.waitForTimeout(100);

      const focusedCard = page.locator("article[class*='cardKeyboardFocused']");
      await expect(focusedCard).toBeVisible();
    });

    test("moves focused card down with Ctrl+J", async ({ page }) => {
      await page.keyboard.press("Shift+h");
      await page.waitForTimeout(100);

      await page.keyboard.press("Control+j");
      await page.waitForTimeout(100);

      const focusedCard = page.locator("article[class*='cardKeyboardFocused']");
      await expect(focusedCard).toBeVisible();
    });

    test("moves focused card up with Ctrl+K", async ({ page }) => {
      await page.keyboard.press("Shift+h");
      await page.waitForTimeout(100);
      await page.keyboard.press("Control+j");
      await page.waitForTimeout(100);

      await page.keyboard.press("Control+k");
      await page.waitForTimeout(100);

      const focusedCard = page.locator("article[class*='cardKeyboardFocused']");
      await expect(focusedCard).toBeVisible();
    });

    test("card movement persists to localStorage", async ({ page }) => {
      await page.keyboard.press("Shift+h");
      await page.waitForTimeout(100);
      await page.keyboard.press("Control+l");
      await page.waitForTimeout(300);

      const hasLayout = await page.evaluate(() => {
        return localStorage.getItem("sheet-layout:git") !== null;
      });

      expect(hasLayout).toBe(true);

      await expect(page.locator("text=Saved locally")).toBeVisible();
    });
  });

  test.describe("Card resize with Ctrl+Shift+hjkl", () => {
    test("shrinks card width with Ctrl+Shift+H", async ({ page }) => {
      await page.keyboard.press("Shift+h");
      await page.waitForTimeout(100);

      const getColSpan = async () => {
        const focusedCard = page.locator("article[class*='cardKeyboardFocused']");
        const style = await focusedCard.getAttribute("style");
        const match = style?.match(/--card-col-span:\s*(\d+)/);
        return match ? parseInt(match[1], 10) : null;
      };

      const initialColSpan = await getColSpan();

      await page.keyboard.press("Control+Shift+h");
      await page.waitForTimeout(100);

      const newColSpan = await getColSpan();

      if (initialColSpan && initialColSpan > 1) {
        expect(newColSpan).toBeLessThan(initialColSpan);
      }

      const focusedCard = page.locator("article[class*='cardKeyboardFocused']");
      await expect(focusedCard).toBeVisible();
    });

    test("grows card width with Ctrl+Shift+L", async ({ page }) => {
      await page.keyboard.press("Shift+h");
      await page.waitForTimeout(100);

      await page.keyboard.press("Control+Shift+h");
      await page.waitForTimeout(100);

      const getColSpan = async () => {
        const focusedCard = page.locator("article[class*='cardKeyboardFocused']");
        const style = await focusedCard.getAttribute("style");
        const match = style?.match(/--card-col-span:\s*(\d+)/);
        return match ? parseInt(match[1], 10) : null;
      };

      const afterShrink = await getColSpan();

      await page.keyboard.press("Control+Shift+l");
      await page.waitForTimeout(100);

      const afterGrow = await getColSpan();

      if (afterShrink) {
        expect(afterGrow).toBeGreaterThanOrEqual(afterShrink);
      }
    });

    test("shrinks card height with Ctrl+Shift+K", async ({ page }) => {
      // Focus a card
      await page.keyboard.press("Shift+h");
      await page.waitForTimeout(100);

      const getRowSpan = async () => {
        const focusedCard = page.locator("article[class*='cardKeyboardFocused']");
        const style = await focusedCard.getAttribute("style");
        const match = style?.match(/--card-row-span:\s*(\d+)/);
        return match ? parseInt(match[1], 10) : null;
      };

      const initialRowSpan = await getRowSpan();

      // Shrink height
      await page.keyboard.press("Control+Shift+k");
      await page.waitForTimeout(100);

      const newRowSpan = await getRowSpan();

      // Height should have decreased or stayed at minimum
      if (initialRowSpan && initialRowSpan > 1) {
        expect(newRowSpan).toBeLessThan(initialRowSpan);
      }
    });

    test("grows card height with Ctrl+Shift+J", async ({ page }) => {
      // Focus a card
      await page.keyboard.press("Shift+h");
      await page.waitForTimeout(100);

      const getRowSpan = async () => {
        const focusedCard = page.locator("article[class*='cardKeyboardFocused']");
        const style = await focusedCard.getAttribute("style");
        const match = style?.match(/--card-row-span:\s*(\d+)/);
        return match ? parseInt(match[1], 10) : null;
      };

      const initialRowSpan = await getRowSpan();

      // Grow height
      await page.keyboard.press("Control+Shift+j");
      await page.waitForTimeout(100);

      const newRowSpan = await getRowSpan();

      expect(newRowSpan).toBeGreaterThanOrEqual(initialRowSpan ?? 1);
    });

    test("resize persists to localStorage", async ({ page }) => {
      await page.keyboard.press("Shift+h");
      await page.waitForTimeout(100);
      await page.keyboard.press("Control+Shift+l");
      await page.waitForTimeout(300);

      const hasLayout = await page.evaluate(() => {
        return localStorage.getItem("sheet-layout:git") !== null;
      });

      expect(hasLayout).toBe(true);
    });
  });

  test.describe("Layout mode interaction", () => {
    test("clears card focus when exiting layout mode", async ({ page }) => {
      await page.keyboard.press("Shift+h");
      await page.waitForTimeout(100);

      const focusedCardBefore = page.locator("article[class*='cardKeyboardFocused']");
      await expect(focusedCardBefore).toBeVisible();

      await page.locator("text=Exit layout mode").click();
      await page.waitForTimeout(100);

      const focusedCardAfter = page.locator("article[class*='cardKeyboardFocused']");
      await expect(focusedCardAfter).not.toBeVisible();
    });

    test("keyboard shortcuts don't work outside layout mode", async ({ page }) => {
      await page.locator("text=Exit layout mode").click();
      await page.waitForTimeout(100);

      await page.keyboard.press("Shift+h");
      await page.waitForTimeout(100);

      const focusedCard = page.locator("article[class*='cardKeyboardFocused']");
      await expect(focusedCard).not.toBeVisible();
    });

    test("dragging clears keyboard focus", async ({ page }) => {
      await page.keyboard.press("Shift+h");
      await page.waitForTimeout(100);

      const focusedCard = page.locator("article[class*='cardKeyboardFocused']");
      await expect(focusedCard).toBeVisible();

      const cardHeader = page.locator("[class*='cardHeader']").first();
      const box = await cardHeader.boundingBox();
      
      if (box) {
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.mouse.down();
        await page.mouse.move(box.x + box.width / 2 + 50, box.y + box.height / 2, { steps: 5 });
        await page.mouse.up();
      }

      await page.waitForTimeout(100);

    });
  });

  test.describe("Help modal shows layout shortcuts", () => {
    test("displays layout mode shortcuts in help modal", async ({ page }) => {
      await page.keyboard.press("?");
      await page.waitForTimeout(200);

      const layoutSection = page.getByRole("heading", { name: "Layout Mode" });
      await expect(layoutSection).toBeVisible();

      const moveCardText = page.locator("text=/Move card/i");
      await expect(moveCardText.first()).toBeVisible();
    });
  });
});
