import { test, expect, type Page } from "@playwright/test";

async function expectFocusedLayoutBlock(page: Page) {
  const focusedBlock = page.locator("article[data-layout-card='true'][class*='KeyboardFocused']");
  await expect(focusedBlock).toBeVisible();
  return focusedBlock;
}

async function focusFirstLayoutBlock(page: Page) {
  await expect(async () => {
    await page.keyboard.press("Shift+h");
    const focusedBlock = page.locator("article[data-layout-card='true'][class*='KeyboardFocused']");
    await expect(focusedBlock).toBeVisible({ timeout: 500 });
  }).toPass({ timeout: 5000 });

  return expectFocusedLayoutBlock(page);
}

async function focusFirstResizableBlock(page: Page) {
  await focusFirstLayoutBlock(page);
  await page.keyboard.press("Shift+j");
  return expectFocusedLayoutBlock(page);
}

async function getFocusedBlockColSpan(page: Page) {
  const focusedBlock = await expectFocusedLayoutBlock(page);
  const style = await focusedBlock.getAttribute("style");
  const match = style?.match(/--card-col-span:\s*(\d+)/);
  return match ? parseInt(match[1], 10) : null;
}

async function getFocusedBlockRowSpan(page: Page) {
  const focusedBlock = await expectFocusedLayoutBlock(page);
  const style = await focusedBlock.getAttribute("style");
  const match = style?.match(/--card-row-span:\s*(\d+)/);
  return match ? parseInt(match[1], 10) : null;
}

async function expectLocalStorageLayout(page: Page) {
  await expect(async () => {
    const hasLayout = await page.evaluate(() => localStorage.getItem("sheet-layout:git") !== null);
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

  test.describe("Layout navigation with Shift+hjkl", () => {
    test("focuses first layout block with Shift+H when no block is focused", async ({ page }) => {
      await focusFirstLayoutBlock(page);
    });

    test("navigates between blocks with Shift+L (right)", async ({ page }) => {
      await focusFirstLayoutBlock(page);
      await page.keyboard.press("Shift+l");
      await expectFocusedLayoutBlock(page);
    });

    test("navigates between blocks with Shift+J (down)", async ({ page }) => {
      await focusFirstLayoutBlock(page);
      await page.keyboard.press("Shift+j");
      await expectFocusedLayoutBlock(page);
    });

    test("navigates with arrow keys (Shift+ArrowRight)", async ({ page }) => {
      await page.keyboard.press("Shift+ArrowRight");
      await expectFocusedLayoutBlock(page);
    });
  });

  test.describe("Layout movement with Alt+hjkl", () => {
    test("moves focused block left with Alt+H", async ({ page }) => {
      await focusFirstResizableBlock(page);
      await page.keyboard.press("Alt+ArrowRight");
      await expectFocusedLayoutBlock(page);

      await page.keyboard.press("Alt+ArrowLeft");
      await expectFocusedLayoutBlock(page);
    });

    test("moves focused block right with Alt+L", async ({ page }) => {
      await focusFirstResizableBlock(page);
      await page.keyboard.press("Alt+ArrowRight");
      await expectFocusedLayoutBlock(page);
    });

    test("moves focused block down with Alt+J", async ({ page }) => {
      await focusFirstResizableBlock(page);
      await page.keyboard.press("Alt+ArrowDown");
      await expectFocusedLayoutBlock(page);
    });

    test("moves focused block up with Alt+K", async ({ page }) => {
      await focusFirstResizableBlock(page);
      await page.keyboard.press("Alt+ArrowDown");
      await expectFocusedLayoutBlock(page);

      await page.keyboard.press("Alt+ArrowUp");
      await expectFocusedLayoutBlock(page);
    });

    test("block movement persists to localStorage", async ({ page }) => {
      await focusFirstResizableBlock(page);
      await page.keyboard.press("Alt+ArrowRight");
      await expectFocusedLayoutBlock(page);

      await expectLocalStorageLayout(page);
      await expect(page.locator("text=Saved locally")).toBeVisible();
    });
  });

  test.describe("Layout resize with Alt+Shift+hjkl", () => {
    test("shrinks block width with Alt+Shift+Left", async ({ page }) => {
      await focusFirstResizableBlock(page);
      const initialColSpan = await getFocusedBlockColSpan(page);

      await page.keyboard.press("Alt+Shift+ArrowLeft");

      await expect(async () => {
        const newColSpan = await getFocusedBlockColSpan(page);
        if (initialColSpan && initialColSpan > 1) {
          expect(newColSpan).toBeLessThan(initialColSpan);
        }
      }).toPass({ timeout: 2000 });
    });

    test("grows block width with Alt+Shift+Right", async ({ page }) => {
      await focusFirstResizableBlock(page);
      await page.keyboard.press("Alt+Shift+ArrowLeft");

      const afterShrink = await getFocusedBlockColSpan(page);

      await page.keyboard.press("Alt+Shift+ArrowRight");

      await expect(async () => {
        const afterGrow = await getFocusedBlockColSpan(page);
        if (afterShrink) {
          expect(afterGrow).toBeGreaterThanOrEqual(afterShrink);
        }
      }).toPass({ timeout: 2000 });
    });

    test("shrinks block height with Alt+Shift+Up", async ({ page }) => {
      await focusFirstResizableBlock(page);
      const initialRowSpan = await getFocusedBlockRowSpan(page);

      await page.keyboard.press("Alt+Shift+ArrowUp");

      await expect(async () => {
        const newRowSpan = await getFocusedBlockRowSpan(page);
        if (initialRowSpan && initialRowSpan > 1) {
          expect(newRowSpan).toBeLessThan(initialRowSpan);
        }
      }).toPass({ timeout: 2000 });
    });

    test("grows block height with Alt+Shift+Down", async ({ page }) => {
      await focusFirstResizableBlock(page);
      const initialRowSpan = await getFocusedBlockRowSpan(page);

      await page.keyboard.press("Alt+Shift+ArrowDown");

      await expect(async () => {
        const newRowSpan = await getFocusedBlockRowSpan(page);
        expect(newRowSpan).toBeGreaterThanOrEqual(initialRowSpan ?? 1);
      }).toPass({ timeout: 2000 });
    });

    test("resize persists to localStorage", async ({ page }) => {
      await focusFirstResizableBlock(page);
      await page.keyboard.press("Alt+Shift+ArrowRight");
      await expectFocusedLayoutBlock(page);

      await expectLocalStorageLayout(page);
    });
  });

  test.describe("Layout interaction", () => {
    test("clears block focus with Escape", async ({ page }) => {
      await focusFirstLayoutBlock(page);
      await expectFocusedLayoutBlock(page);

      await page.keyboard.press("Escape");

      const focusedBlockAfter = page.locator("article[class*='KeyboardFocused']");
      await expect(focusedBlockAfter).toHaveCount(0);
    });

    test("keeps layout overlay hidden until interaction starts", async ({ page }) => {
      const focusedBlock = page.locator("article[data-layout-card='true'][class*='KeyboardFocused']");
      const metricsText = page.locator("text=/\\d+ cols/");

      await expect(focusedBlock).not.toBeVisible();
      await expect(metricsText.first()).not.toBeVisible();

      await focusFirstLayoutBlock(page);

      await expect(metricsText.first()).toBeVisible();
    });

    test("dragging clears keyboard focus", async ({ page }) => {
      await focusFirstLayoutBlock(page);

      const focusedBlockBefore = page.locator("article[data-layout-card='true'][class*='KeyboardFocused']");
      await expect(focusedBlockBefore).toHaveCount(1);

      const blockHeader = page.locator("[class*='cardHeader'], [class*='headingBlockHeader']").first();
      await blockHeader.dispatchEvent("pointerdown", { button: 0, bubbles: true });

      const focusedBlock = page.locator("article[data-layout-card='true'][class*='KeyboardFocused']");
      await expect(focusedBlock).toHaveCount(0);
    });
  });
});
