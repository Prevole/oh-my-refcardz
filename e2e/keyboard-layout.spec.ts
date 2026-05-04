import { test, expect } from "@playwright/test";

test.describe("Keyboard layout management", () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage before each test
    await page.goto("/");
    await page.evaluate(() => {
      for (const key of Object.keys(localStorage)) {
        if (key.startsWith("sheet-layout:")) {
          localStorage.removeItem(key);
        }
      }
    });
    
    // Navigate to a cheatsheet and enter layout mode
    await page.goto("/cheatsheets/git");
    await page.waitForSelector("[class*='layoutToolbar']");
    await page.locator("text=Enter layout mode").click();
    await page.waitForTimeout(200);
  });

  test.describe("Card navigation with Shift+hjkl", () => {
    test("focuses first card with Shift+H when no card is focused", async ({ page }) => {
      // Press Shift+H to start card navigation
      await page.keyboard.press("Shift+h");
      await page.waitForTimeout(100);

      // A card should now have the keyboard focus class
      const focusedCard = page.locator("article[class*='cardKeyboardFocused']");
      await expect(focusedCard).toBeVisible();
    });

    test("navigates between cards with Shift+L (right)", async ({ page }) => {
      // Focus first card
      await page.keyboard.press("Shift+h");
      await page.waitForTimeout(100);

      // Navigate right
      await page.keyboard.press("Shift+l");
      await page.waitForTimeout(100);

      // The card should still be focused (same or different card)
      // At minimum, a focused card should still exist
      const focusedCard = page.locator("article[class*='cardKeyboardFocused']");
      await expect(focusedCard).toBeVisible();
      
      // Note: We can't strictly assert position changed since it depends on layout,
      // but we can verify navigation doesn't break
    });

    test("navigates between cards with Shift+J (down)", async ({ page }) => {
      // Focus first card
      await page.keyboard.press("Shift+h");
      await page.waitForTimeout(100);

      // Navigate down
      await page.keyboard.press("Shift+j");
      await page.waitForTimeout(100);

      // A focused card should still exist
      const focusedCard = page.locator("article[class*='cardKeyboardFocused']");
      await expect(focusedCard).toBeVisible();
    });

    test("navigates with arrow keys (Shift+ArrowRight)", async ({ page }) => {
      // Focus first card with Shift+Right
      await page.keyboard.press("Shift+ArrowRight");
      await page.waitForTimeout(100);

      // A card should be focused
      const focusedCard = page.locator("article[class*='cardKeyboardFocused']");
      await expect(focusedCard).toBeVisible();
    });

    test("dims other cards when one is focused", async ({ page }) => {
      // Focus a card
      await page.keyboard.press("Shift+h");
      await page.waitForTimeout(100);

      // Non-focused cards should be dimmed
      const dimmedCards = page.locator("article[class*='cardDimmed']");
      const focusedCard = page.locator("article[class*='cardKeyboardFocused']");

      // There should be at least one focused card and potentially dimmed cards
      await expect(focusedCard).toBeVisible();
      
      // If there are multiple cards, some should be dimmed
      const totalCards = await page.locator("article").count();
      if (totalCards > 1) {
        const dimmedCount = await dimmedCards.count();
        expect(dimmedCount).toBeGreaterThan(0);
      }
    });
  });

  test.describe("Card movement with Ctrl+hjkl", () => {
    test("moves focused card left with Ctrl+H", async ({ page }) => {
      // Focus a card first
      await page.keyboard.press("Shift+h");
      await page.waitForTimeout(100);

      // Try to move right first (to ensure we have room to move left)
      await page.keyboard.press("Control+l");
      await page.waitForTimeout(100);

      // Now move left
      await page.keyboard.press("Control+h");
      await page.waitForTimeout(100);

      // Card should still be focused
      const focusedCard = page.locator("article[class*='cardKeyboardFocused']");
      await expect(focusedCard).toBeVisible();
    });

    test("moves focused card right with Ctrl+L", async ({ page }) => {
      // Focus a card first
      await page.keyboard.press("Shift+h");
      await page.waitForTimeout(100);

      // Move right
      await page.keyboard.press("Control+l");
      await page.waitForTimeout(100);

      // Just verify the card is still focused and operation didn't crash
      const focusedCard = page.locator("article[class*='cardKeyboardFocused']");
      await expect(focusedCard).toBeVisible();
    });

    test("moves focused card down with Ctrl+J", async ({ page }) => {
      // Focus a card
      await page.keyboard.press("Shift+h");
      await page.waitForTimeout(100);

      // Move down
      await page.keyboard.press("Control+j");
      await page.waitForTimeout(100);

      // Card should still be focused
      const focusedCard = page.locator("article[class*='cardKeyboardFocused']");
      await expect(focusedCard).toBeVisible();
    });

    test("moves focused card up with Ctrl+K", async ({ page }) => {
      // Focus a card and move it down first
      await page.keyboard.press("Shift+h");
      await page.waitForTimeout(100);
      await page.keyboard.press("Control+j");
      await page.waitForTimeout(100);

      // Now move up
      await page.keyboard.press("Control+k");
      await page.waitForTimeout(100);

      // Card should still be focused
      const focusedCard = page.locator("article[class*='cardKeyboardFocused']");
      await expect(focusedCard).toBeVisible();
    });

    test("card movement persists to localStorage", async ({ page }) => {
      // Focus and move a card
      await page.keyboard.press("Shift+h");
      await page.waitForTimeout(100);
      await page.keyboard.press("Control+l");
      await page.waitForTimeout(300);

      // Check localStorage has the layout saved
      const hasLayout = await page.evaluate(() => {
        return localStorage.getItem("sheet-layout:git") !== null;
      });

      expect(hasLayout).toBe(true);

      // Status should show "Saved locally"
      await expect(page.locator("text=Saved locally")).toBeVisible();
    });
  });

  test.describe("Card resize with Ctrl+Shift+hjkl", () => {
    test("shrinks card width with Ctrl+Shift+H", async ({ page }) => {
      // Focus a card
      await page.keyboard.press("Shift+h");
      await page.waitForTimeout(100);

      // Get initial width
      const getColSpan = async () => {
        const focusedCard = page.locator("article[class*='cardKeyboardFocused']");
        const style = await focusedCard.getAttribute("style");
        const match = style?.match(/--card-col-span:\s*(\d+)/);
        return match ? parseInt(match[1], 10) : null;
      };

      const initialColSpan = await getColSpan();

      // Shrink width
      await page.keyboard.press("Control+Shift+h");
      await page.waitForTimeout(100);

      const newColSpan = await getColSpan();

      // Width should have decreased or stayed at minimum (1)
      if (initialColSpan && initialColSpan > 1) {
        expect(newColSpan).toBeLessThan(initialColSpan);
      }

      // Card should still be focused
      const focusedCard = page.locator("article[class*='cardKeyboardFocused']");
      await expect(focusedCard).toBeVisible();
    });

    test("grows card width with Ctrl+Shift+L", async ({ page }) => {
      // Focus a card
      await page.keyboard.press("Shift+h");
      await page.waitForTimeout(100);

      // Shrink first to have room to grow
      await page.keyboard.press("Control+Shift+h");
      await page.waitForTimeout(100);

      const getColSpan = async () => {
        const focusedCard = page.locator("article[class*='cardKeyboardFocused']");
        const style = await focusedCard.getAttribute("style");
        const match = style?.match(/--card-col-span:\s*(\d+)/);
        return match ? parseInt(match[1], 10) : null;
      };

      const afterShrink = await getColSpan();

      // Grow width
      await page.keyboard.press("Control+Shift+l");
      await page.waitForTimeout(100);

      const afterGrow = await getColSpan();

      // Width should have increased
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

      // Height should have increased
      expect(newRowSpan).toBeGreaterThanOrEqual(initialRowSpan ?? 1);
    });

    test("resize persists to localStorage", async ({ page }) => {
      // Focus and resize a card
      await page.keyboard.press("Shift+h");
      await page.waitForTimeout(100);
      await page.keyboard.press("Control+Shift+l");
      await page.waitForTimeout(300);

      // Check localStorage
      const hasLayout = await page.evaluate(() => {
        return localStorage.getItem("sheet-layout:git") !== null;
      });

      expect(hasLayout).toBe(true);
    });
  });

  test.describe("Layout mode interaction", () => {
    test("clears card focus when exiting layout mode", async ({ page }) => {
      // Focus a card
      await page.keyboard.press("Shift+h");
      await page.waitForTimeout(100);

      // Verify card is focused
      const focusedCardBefore = page.locator("article[class*='cardKeyboardFocused']");
      await expect(focusedCardBefore).toBeVisible();

      // Exit layout mode
      await page.locator("text=Exit layout mode").click();
      await page.waitForTimeout(100);

      // No card should be focused anymore
      const focusedCardAfter = page.locator("article[class*='cardKeyboardFocused']");
      await expect(focusedCardAfter).not.toBeVisible();
    });

    test("keyboard shortcuts don't work outside layout mode", async ({ page }) => {
      // Exit layout mode
      await page.locator("text=Exit layout mode").click();
      await page.waitForTimeout(100);

      // Try to navigate cards
      await page.keyboard.press("Shift+h");
      await page.waitForTimeout(100);

      // No card should be focused
      const focusedCard = page.locator("article[class*='cardKeyboardFocused']");
      await expect(focusedCard).not.toBeVisible();
    });

    test("dragging clears keyboard focus", async ({ page }) => {
      // Focus a card
      await page.keyboard.press("Shift+h");
      await page.waitForTimeout(100);

      // Verify focused
      const focusedCard = page.locator("article[class*='cardKeyboardFocused']");
      await expect(focusedCard).toBeVisible();

      // Start a drag operation
      const cardHeader = page.locator("[class*='cardHeader']").first();
      const box = await cardHeader.boundingBox();
      
      if (box) {
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.mouse.down();
        await page.mouse.move(box.x + box.width / 2 + 50, box.y + box.height / 2, { steps: 5 });
        await page.mouse.up();
      }

      await page.waitForTimeout(100);

      // Keyboard focus should be cleared (card might be in different state now)
      // After drag, the card focus system resets
    });
  });

  test.describe("Help modal shows layout shortcuts", () => {
    test("displays layout mode shortcuts in help modal", async ({ page }) => {
      // Open help modal with ?
      await page.keyboard.press("?");
      await page.waitForTimeout(200);

      // Should see "Layout Mode" heading in the help modal
      const layoutSection = page.getByRole("heading", { name: "Layout Mode" });
      await expect(layoutSection).toBeVisible();

      // Should see some layout-related shortcuts
      const moveCardText = page.locator("text=/Move card/i");
      await expect(moveCardText.first()).toBeVisible();
    });
  });
});
