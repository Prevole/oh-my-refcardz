import { test, expect, type Page } from "@playwright/test";

async function focusFirstLayoutCard(page: Page) {
  await page.keyboard.press("H");
  await page.waitForTimeout(100);
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

  test("activates and clears the layout overlay around keyboard focus", async ({ page }) => {
    await page.goto("/cheatsheets/git");
    await page.waitForSelector("[class*='layoutToolbar']");

    const metricsText = page.locator("text=/\\d+ cols/");
    await expect(metricsText.first()).not.toBeVisible();

    await focusFirstLayoutCard(page);

    const layoutControls = page.locator("[data-card-layout-controls]");
    await expect(layoutControls.first()).toBeVisible();
    await expect(metricsText.first()).toBeVisible();

    await page.keyboard.press("Escape");
    await page.waitForTimeout(100);

    await expect(layoutControls.first()).not.toBeVisible();
    await expect(metricsText.first()).not.toBeVisible();
  });

  test("shows column metrics in layout mode", async ({ page }) => {
    await page.goto("/cheatsheets/git");
    await page.waitForSelector("[class*='layoutToolbar']");

    await focusFirstLayoutCard(page);
    const metricsText = page.locator("text=/\\d+ cols/");
    await expect(metricsText.first()).toBeVisible();
  });

  test("resizes card width with controls", async ({ page }) => {
    await page.goto("/cheatsheets/git");
    await page.waitForSelector("[class*='layoutToolbar']");

    await focusFirstLayoutCard(page);
    const controls = page.locator("[data-card-layout-controls]").first();
    await expect(controls).toBeVisible();

    const card = page.locator("article").first();
    const getColSpan = async () => {
      const style = await card.getAttribute("style");
      const match = style?.match(/--card-col-span:\s*(\d+)/);
      return match ? parseInt(match[1], 10) : null;
    };

    const initialColSpan = await getColSpan();
    expect(initialColSpan).not.toBeNull();

    const decreaseWidthButton = controls.locator("button").first();
    await decreaseWidthButton.click();

    const newColSpan = await getColSpan();
    expect(newColSpan).toBeLessThanOrEqual(initialColSpan!);
  });

  test("persists layout changes to localStorage", async ({ page }) => {
    await page.goto("/cheatsheets/git");
    await page.waitForSelector("[class*='layoutToolbar']");

    await focusFirstLayoutCard(page);
    const controls = page.locator("[data-card-layout-controls]").first();
    await expect(controls).toBeVisible();

    const firstButton = controls.locator("button").first();
    await firstButton.click();

    await page.waitForTimeout(200);
    const hasLayout = await page.evaluate(() => {
      return localStorage.getItem("sheet-layout:git") !== null;
    });

    expect(hasLayout).toBe(true);

    const savedText = page.locator("text=Saved locally");
    await expect(savedText).toBeVisible();
  });

  test("resets layout to default", async ({ page }) => {
    await page.goto("/cheatsheets/git");
    await page.waitForSelector("[class*='layoutToolbar']");

    await focusFirstLayoutCard(page);
    const controls = page.locator("[data-card-layout-controls]").first();
    await controls.locator("button").first().click();
    await page.waitForTimeout(200);

    await expect(page.locator("text=Saved locally")).toBeVisible();
    const resetButton = page.locator("text=Reset layout");
    await expect(resetButton).toBeEnabled();
    await resetButton.click();

    await page.waitForTimeout(200);
    await expect(page.locator("text=Default layout")).toBeVisible();
    const hasLayout = await page.evaluate(() => {
      return localStorage.getItem("sheet-layout:git") !== null;
    });
    expect(hasLayout).toBe(false);
  });

  test("layout persists across page reload", async ({ page }) => {
    await page.goto("/cheatsheets/git");
    await page.waitForSelector("[class*='layoutToolbar']");

    await focusFirstLayoutCard(page);
    const controls = page.locator("[data-card-layout-controls]").first();
    await controls.locator("button").first().click();
    await page.waitForTimeout(300);

    const savedLayout = await page.evaluate(() => {
      return localStorage.getItem("sheet-layout:git");
    });
    expect(savedLayout).not.toBeNull();

    await page.reload();
    await page.waitForSelector("[class*='layoutToolbar']");

    await page.waitForTimeout(500);
    const layoutAfterReload = await page.evaluate(() => {
      return localStorage.getItem("sheet-layout:git");
    });
    expect(layoutAfterReload).not.toBeNull();
    
    const savedParsed = JSON.parse(savedLayout!);
    const reloadedParsed = JSON.parse(layoutAfterReload!);
    expect(reloadedParsed).toEqual(savedParsed);
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
    await page.waitForTimeout(300);
    const hasLayout = await page.evaluate(() => {
      return localStorage.getItem("sheet-layout:git") !== null;
    });

    // Drag was processed (either position changed or layout saved)
    expect(hasLayout).toBe(true);
  });
});

test.describe("Layout persistence across navigation", () => {
  test("remembers layout when navigating back from home", async ({ page }) => {
    // Go to a cheatsheet and modify layout
    await page.goto("/cheatsheets/git");
    await page.waitForSelector("[class*='layoutToolbar']");

    // Focus a card and make a change
    await focusFirstLayoutCard(page);
    const controls = page.locator("[data-card-layout-controls]").first();
    await controls.locator("button").first().click();
    await page.waitForTimeout(200);

    // Verify saved
    await expect(page.locator("text=Saved locally")).toBeVisible();

    await page.keyboard.press("Escape");
    await page.keyboard.press("Backspace");
    await expect(page).toHaveURL("/");

    // Navigate back to the same cheatsheet
    await page.goto("/cheatsheets/git");
    await page.waitForSelector("[class*='layoutToolbar']");

    // Should still show "Saved locally"
    await expect(page.locator("text=Saved locally")).toBeVisible();
  });
});
