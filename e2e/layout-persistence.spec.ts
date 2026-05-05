import { test, expect, type Page } from "@playwright/test";

async function expectFocusedLayoutCard(page: Page) {
  const focusedCard = page.locator("[class*='cardKeyboardFocused']");
  await expect(focusedCard.first()).toBeVisible();
  return focusedCard;
}

async function focusFirstLayoutCard(page: Page) {
  await expect(async () => {
    await page.keyboard.press("Shift+h");
    const focusedCard = page.locator("[class*='cardKeyboardFocused']");
    await expect(focusedCard.first()).toBeVisible({ timeout: 500 });
  }).toPass({ timeout: 5000 });
}

async function expectLocalStorageLayout(page: Page) {
  await expect(async () => {
    const hasLayout = await page.evaluate(() => {
      return localStorage.getItem("sheet-layout:git") !== null;
    });
    expect(hasLayout).toBe(true);
  }).toPass({ timeout: 5000 });
}

async function expectNoLocalStorageLayout(page: Page) {
  await expect(async () => {
    const hasLayout = await page.evaluate(() => {
      return localStorage.getItem("sheet-layout:git") !== null;
    });
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

    const statusText = page.locator("text=Default layout");
    await expect(statusText).toBeVisible();
  });

  test("activates layout overlay when card is focused", async ({ page }) => {
    await page.goto("/cheatsheets/git");
    await page.waitForSelector("[class*='layoutToolbar']");

    const metricsText = page.locator("text=/\\d+ cols/");
    await expect(metricsText.first()).not.toBeVisible();

    await focusFirstLayoutCard(page);

    await expect(metricsText.first()).toBeVisible();
  });

  test("clears layout overlay when focus is cleared with Escape", async ({ page }) => {
    await page.goto("/cheatsheets/git");
    await page.waitForSelector("[class*='layoutToolbar']");

    await focusFirstLayoutCard(page);

    const focusedCard = page.locator("[class*='cardKeyboardFocused']");
    const metricsText = page.locator("text=/\\d+ cols/");
    await expect(focusedCard.first()).toBeVisible();

    await page.keyboard.press("Escape");

    await expect(focusedCard).toHaveCount(0);
    await expect(metricsText.first()).not.toBeVisible();
  });

  test("shows column metrics when card is focused", async ({ page }) => {
    await page.goto("/cheatsheets/git");
    await page.waitForSelector("[class*='layoutToolbar']");

    await focusFirstLayoutCard(page);
    const metricsText = page.locator("text=/\\d+ cols/");
    await expect(metricsText.first()).toBeVisible();
  });

  test("resizes card width with keyboard", async ({ page }) => {
    await page.goto("/cheatsheets/git");
    await page.waitForSelector("[class*='layoutToolbar']");

    await focusFirstLayoutCard(page);

    const card = page.locator("article[data-layout-card='true']").first();
    const getColSpan = async () => {
      const style = await card.getAttribute("style");
      const match = style?.match(/--card-col-span:\s*(\d+)/);
      return match ? parseInt(match[1], 10) : null;
    };

    const initialColSpan = await getColSpan();
    expect(initialColSpan).not.toBeNull();

    await page.keyboard.press("Alt+Shift+l");

    await expect(async () => {
      const newColSpan = await getColSpan();
      expect(newColSpan).toBeGreaterThanOrEqual(initialColSpan!);
    }).toPass({ timeout: 2000 });
  });

  test("persists layout changes to localStorage", async ({ page }) => {
    await page.goto("/cheatsheets/git");
    await page.waitForSelector("[class*='layoutToolbar']");

    await focusFirstLayoutCard(page);

    await page.keyboard.press("Alt+Shift+l");

    await expectLocalStorageLayout(page);

    const savedText = page.locator("text=Saved locally");
    await expect(savedText).toBeVisible();
  });

  test("resets layout to default", async ({ page }) => {
    await page.goto("/cheatsheets/git");
    await page.waitForSelector("[class*='layoutToolbar']");

    await focusFirstLayoutCard(page);
    await page.keyboard.press("Alt+Shift+l");

    await expect(page.locator("text=Saved locally")).toBeVisible();

    await page.keyboard.press("Escape");
    const focusedCard = page.locator("[class*='cardKeyboardFocused']");
    await expect(focusedCard).toHaveCount(0);

    const resetButton = page.locator("text=Reset layout");
    await expect(resetButton).toBeEnabled();
    await resetButton.click();

    await expect(page.locator("text=Default layout")).toBeVisible();
    await expectNoLocalStorageLayout(page);
  });

  test("layout persists across page reload", async ({ page }) => {
    await page.goto("/cheatsheets/git");
    await page.waitForSelector("[class*='layoutToolbar']");

    await focusFirstLayoutCard(page);
    await page.keyboard.press("Alt+Shift+l");

    await expectLocalStorageLayout(page);

    const savedLayout = await page.evaluate(() => {
      return localStorage.getItem("sheet-layout:git");
    });
    expect(savedLayout).not.toBeNull();

    await page.reload();
    await page.waitForSelector("[class*='layoutToolbar']");

    await expect(async () => {
      const layoutAfterReload = await page.evaluate(() => {
        return localStorage.getItem("sheet-layout:git");
      });
      expect(layoutAfterReload).not.toBeNull();

      const savedParsed = JSON.parse(savedLayout!);
      const reloadedParsed = JSON.parse(layoutAfterReload!);
      expect(reloadedParsed).toEqual(savedParsed);
    }).toPass({ timeout: 5000 });
  });

  test("drags card to new position", async ({ page }) => {
    await page.goto("/cheatsheets/git");
    await page.waitForSelector("[class*='layoutToolbar']");

    const firstCard = page.locator("article").first();
    await expect(firstCard).toBeVisible();
    const cardHeader = firstCard.locator("[class*='cardHeader']").first();
    await expect(cardHeader).toBeVisible();
    const box = await cardHeader.boundingBox();
    if (box) {
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width / 2 + 150, box.y + box.height / 2, { steps: 10 });
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

    await focusFirstLayoutCard(page);
    await page.keyboard.press("Alt+Shift+l");

    await expect(page.locator("text=Saved locally")).toBeVisible();

    await page.goto("/");
    await expect(page).toHaveURL("/");

    await page.goto("/cheatsheets/git");
    await page.waitForSelector("[class*='layoutToolbar']");

    await expect(page.locator("text=Saved locally")).toBeVisible();
  });
});
