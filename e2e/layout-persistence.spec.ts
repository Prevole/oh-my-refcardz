import { test, expect, type Page } from "@playwright/test";

async function focusFirstLayoutBlock(page: Page) {
  await expect(async () => {
    await page.keyboard.press("Shift+h");
    const focusedBlock = page.locator("article[data-layout-card='true'][class*='KeyboardFocused']");
    await expect(focusedBlock.first()).toBeVisible({ timeout: 500 });
  }).toPass({ timeout: 5000 });
}

async function focusFirstResizableLayoutBlock(page: Page) {
  await focusFirstLayoutBlock(page);
  await page.keyboard.press("Shift+j");
}

async function expectLocalStorageLayout(page: Page) {
  await expect(async () => {
    const hasLayout = await page.evaluate(() => localStorage.getItem("sheet-layout:git") !== null);
    expect(hasLayout).toBe(true);
  }).toPass({ timeout: 5000 });
}

async function expectNoLocalStorageLayout(page: Page) {
  await expect(async () => {
    const hasLayout = await page.evaluate(() => localStorage.getItem("sheet-layout:git") !== null);
    expect(hasLayout).toBe(false);
  }).toPass({ timeout: 5000 });
}

test.describe("Drag & drop and layout persistence", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => {
      for (const key of Object.keys(localStorage)) {
        if (key.startsWith("sheet-layout:")) {
          localStorage.removeItem(key);
        }
      }
    });
  });

  test("displays default layout status initially", async ({ page }) => {
    await page.goto("/cheatsheets/git");
    await page.waitForSelector("[class*='layoutToolbar']");
    await expect(page.locator("text=Default layout")).toBeVisible();
  });

  test("activates layout overlay when a block is focused", async ({ page }) => {
    await page.goto("/cheatsheets/git");
    await page.waitForSelector("[class*='layoutToolbar']");

    const metricsText = page.locator("text=/\\d+ cols/");
    await expect(metricsText.first()).not.toBeVisible();

    await focusFirstLayoutBlock(page);
    await expect(metricsText.first()).toBeVisible();
  });

  test("clears layout overlay when focus is cleared with Escape", async ({ page }) => {
    await page.goto("/cheatsheets/git");
    await page.waitForSelector("[class*='layoutToolbar']");

    await focusFirstLayoutBlock(page);
    const focusedBlock = page.locator("article[data-layout-card='true'][class*='KeyboardFocused']");
    const metricsText = page.locator("text=/\\d+ cols/");
    await expect(focusedBlock.first()).toBeVisible();

    await page.keyboard.press("Escape");

    await expect(focusedBlock).toHaveCount(0);
    await expect(metricsText.first()).not.toBeVisible();
  });

  test("keyboard focus can land on a heading block", async ({ page }) => {
    await page.goto("/cheatsheets/git");
    await page.waitForSelector("[class*='layoutToolbar']");

    await focusFirstLayoutBlock(page);
    const focusedBlock = page.locator("article[data-layout-card='true'][class*='KeyboardFocused']").first();
    await expect(focusedBlock).toHaveAttribute("data-layout-block-id", "inspect-and-diff");
  });

  test("keyboard navigation can move from a heading to another block", async ({ page }) => {
    await page.goto("/cheatsheets/git");
    await page.waitForSelector("[class*='layoutToolbar']");

    await focusFirstLayoutBlock(page);
    await page.keyboard.press("Shift+ArrowDown");

    await expect(async () => {
      const focusedBlock = page.locator("article[data-layout-card='true'][class*='KeyboardFocused']").first();
      await expect(focusedBlock).toBeVisible();
      const currentBlockId = await focusedBlock.getAttribute("data-layout-block-id");
      expect(currentBlockId).not.toBe("inspect-and-diff");
    }).toPass({ timeout: 3000 });
  });

  test("persists layout changes to localStorage after resizing a resizable block", async ({ page }) => {
    await page.goto("/cheatsheets/git");
    await page.waitForSelector("[class*='layoutToolbar']");

    await focusFirstResizableLayoutBlock(page);
    await page.keyboard.press("Alt+Shift+l");

    await expectLocalStorageLayout(page);
    await expect(page.locator("text=Saved locally")).toBeVisible();
  });

  test("resets layout to default", async ({ page }) => {
    await page.goto("/cheatsheets/git");
    await page.waitForSelector("[class*='layoutToolbar']");

    await focusFirstResizableLayoutBlock(page);
    await page.keyboard.press("Alt+Shift+l");
    await expect(page.locator("text=Saved locally")).toBeVisible();

    await page.keyboard.press("Escape");

    const resetButton = page.locator("text=Reset layout");
    await expect(resetButton).toBeEnabled();
    await resetButton.click();

    await expect(page.locator("text=Default layout")).toBeVisible();
    await expectNoLocalStorageLayout(page);
  });

  test("layout persists across page reload", async ({ page }) => {
    await page.goto("/cheatsheets/git");
    await page.waitForSelector("[class*='layoutToolbar']");

    await focusFirstResizableLayoutBlock(page);
    await page.keyboard.press("Alt+Shift+l");
    await expectLocalStorageLayout(page);

    const savedLayout = await page.evaluate(() => localStorage.getItem("sheet-layout:git"));
    expect(savedLayout).not.toBeNull();

    await page.reload();
    await page.waitForSelector("[class*='layoutToolbar']");

    await expect(async () => {
      const layoutAfterReload = await page.evaluate(() => localStorage.getItem("sheet-layout:git"));
      expect(layoutAfterReload).not.toBeNull();
      expect(JSON.parse(layoutAfterReload!)).toEqual(JSON.parse(savedLayout!));
    }).toPass({ timeout: 5000 });
  });

  test("drags a block to a new position", async ({ page }) => {
    await page.goto("/cheatsheets/git");
    await page.waitForSelector("[class*='layoutToolbar']");

    const firstBlock = page
      .locator("article[data-layout-card='true'] [class*='cardHeader'], article[data-layout-card='true'] [class*='headingBlockHeader']")
      .first()
      .locator("xpath=ancestor::article[1]");
    await expect(firstBlock).toBeVisible();

    const blockHeader = firstBlock.locator("[class*='cardHeader'], [class*='headingBlockHeader']").first();
    const box = await blockHeader.boundingBox();
    if (box) {
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width / 2 + 320, box.y + box.height / 2 + 220, { steps: 12 });
      await page.mouse.up();
    }

    await expectLocalStorageLayout(page);
  });
});

test.describe("Layout persistence across navigation", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => {
      for (const key of Object.keys(localStorage)) {
        if (key.startsWith("sheet-layout:")) {
          localStorage.removeItem(key);
        }
      }
    });
  });

  test("remembers layout when navigating back from home", async ({ page }) => {
    await page.goto("/cheatsheets/git");
    await page.waitForSelector("[class*='layoutToolbar']");

    await focusFirstResizableLayoutBlock(page);
    await page.keyboard.press("Alt+Shift+l");
    await expectLocalStorageLayout(page);

    await page.goto("/");
    await expect(page).toHaveURL("/");

    await page.goto("/cheatsheets/git");
    await page.waitForSelector("[class*='layoutToolbar']");

    await expectLocalStorageLayout(page);
  });
});
