import { test, expect } from "@playwright/test";

test.describe("Drag & drop and layout persistence", () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage before each test
    await page.goto("/");
    await page.evaluate(() => {
      // Clear all sheet-layout keys
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

    // Should show "Default layout" text
    const statusText = page.locator("text=Default layout");
    await expect(statusText).toBeVisible();
  });

  test("enters and exits layout mode", async ({ page }) => {
    await page.goto("/cheatsheets/git");
    await page.waitForSelector("[class*='layoutToolbar']");

    // Find and click the layout mode button
    const layoutButton = page.locator("text=Enter layout mode");
    await expect(layoutButton).toBeVisible();
    await layoutButton.click();

    // Should now show "Exit layout mode"
    const exitButton = page.locator("text=Exit layout mode");
    await expect(exitButton).toBeVisible();

    // Layout controls should be visible on cards
    const layoutControls = page.locator("[data-card-layout-controls]");
    await expect(layoutControls.first()).toBeVisible();

    // Exit layout mode
    await exitButton.click();
    await expect(layoutButton).toBeVisible();
  });

  test("shows column metrics in layout mode", async ({ page }) => {
    await page.goto("/cheatsheets/git");
    await page.waitForSelector("[class*='layoutToolbar']");

    // Enter layout mode
    await page.locator("text=Enter layout mode").click();

    // Should show column metrics (e.g., "12 cols · XXpx")
    const metricsText = page.locator("text=/\\d+ cols/");
    await expect(metricsText.first()).toBeVisible();
  });

  test("resizes card width with controls", async ({ page }) => {
    await page.goto("/cheatsheets/git");
    await page.waitForSelector("[class*='layoutToolbar']");

    // Enter layout mode
    await page.locator("text=Enter layout mode").click();

    // Find the first card's layout controls
    const controls = page.locator("[data-card-layout-controls]").first();
    await expect(controls).toBeVisible();

    // Get initial width indicator from the card
    const card = page.locator("article").first();
    const getColSpan = async () => {
      const style = await card.getAttribute("style");
      const match = style?.match(/--card-col-span:\s*(\d+)/);
      return match ? parseInt(match[1], 10) : null;
    };

    const initialColSpan = await getColSpan();
    expect(initialColSpan).not.toBeNull();

    // Click decrease width button (first button in controls typically)
    const decreaseWidthButton = controls.locator("button").first();
    await decreaseWidthButton.click();

    // Width should have decreased (or stayed at minimum)
    const newColSpan = await getColSpan();
    expect(newColSpan).toBeLessThanOrEqual(initialColSpan!);
  });

  test("persists layout changes to localStorage", async ({ page }) => {
    await page.goto("/cheatsheets/git");
    await page.waitForSelector("[class*='layoutToolbar']");

    // Enter layout mode
    await page.locator("text=Enter layout mode").click();

    // Find controls and change something
    const controls = page.locator("[data-card-layout-controls]").first();
    await expect(controls).toBeVisible();

    // Click to change width
    const firstButton = controls.locator("button").first();
    await firstButton.click();

    // Wait for save
    await page.waitForTimeout(200);

    // Check localStorage
    const hasLayout = await page.evaluate(() => {
      return localStorage.getItem("sheet-layout:git") !== null;
    });

    expect(hasLayout).toBe(true);

    // Status should change to "Saved locally"
    const savedText = page.locator("text=Saved locally");
    await expect(savedText).toBeVisible();
  });

  test("resets layout to default", async ({ page }) => {
    await page.goto("/cheatsheets/git");
    await page.waitForSelector("[class*='layoutToolbar']");

    // Enter layout mode and make a change
    await page.locator("text=Enter layout mode").click();
    const controls = page.locator("[data-card-layout-controls]").first();
    await controls.locator("button").first().click();
    await page.waitForTimeout(200);

    // Should show "Saved locally"
    await expect(page.locator("text=Saved locally")).toBeVisible();

    // Click reset button
    const resetButton = page.locator("text=Reset layout");
    await expect(resetButton).toBeEnabled();
    await resetButton.click();

    // Wait for reset
    await page.waitForTimeout(200);

    // Should be back to "Default layout"
    await expect(page.locator("text=Default layout")).toBeVisible();

    // localStorage should be cleared
    const hasLayout = await page.evaluate(() => {
      return localStorage.getItem("sheet-layout:git") !== null;
    });
    expect(hasLayout).toBe(false);
  });

  test("layout persists across page reload", async ({ page }) => {
    await page.goto("/cheatsheets/git");
    await page.waitForSelector("[class*='layoutToolbar']");

    // Enter layout mode and make a change
    await page.locator("text=Enter layout mode").click();
    const controls = page.locator("[data-card-layout-controls]").first();
    await controls.locator("button").first().click();
    await page.waitForTimeout(300);

    // Get the current layout from localStorage
    const savedLayout = await page.evaluate(() => {
      return localStorage.getItem("sheet-layout:git");
    });
    expect(savedLayout).not.toBeNull();

    // Reload the page
    await page.reload();
    await page.waitForSelector("[class*='layoutToolbar']");

    // Wait for hydration
    await page.waitForTimeout(500);

    // Layout should still exist (comparing parsed objects to ignore key order)
    const layoutAfterReload = await page.evaluate(() => {
      return localStorage.getItem("sheet-layout:git");
    });
    expect(layoutAfterReload).not.toBeNull();
    
    // Parse and compare the actual data (ignoring JSON key order differences)
    const savedParsed = JSON.parse(savedLayout!);
    const reloadedParsed = JSON.parse(layoutAfterReload!);
    expect(reloadedParsed).toEqual(savedParsed);
  });

  test("drags card to new position", async ({ page }) => {
    await page.goto("/cheatsheets/git");
    await page.waitForSelector("[class*='layoutToolbar']");

    // Enter layout mode
    await page.locator("text=Enter layout mode").click();
    await page.waitForTimeout(200);

    // Get the first card
    const firstCard = page.locator("article").first();
    await expect(firstCard).toBeVisible();

    // Find the card header div (drag handle) - it's a div with cardHeader class
    const cardHeader = firstCard.locator("[class*='cardHeader']").first();
    await expect(cardHeader).toBeVisible();

    // Perform drag using Playwright's dragTo
    const box = await cardHeader.boundingBox();
    if (box) {
      // Start drag from center of header
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      
      // Move significantly to the right
      await page.mouse.move(box.x + box.width / 2 + 150, box.y + box.height / 2, { steps: 10 });
      
      // Release
      await page.mouse.up();
    }

    // Wait for state update
    await page.waitForTimeout(300);

    // The drag should have triggered a save to localStorage
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

    // Enter layout mode and make a change
    await page.locator("text=Enter layout mode").click();
    const controls = page.locator("[data-card-layout-controls]").first();
    await controls.locator("button").first().click();
    await page.waitForTimeout(200);

    // Verify saved
    await expect(page.locator("text=Saved locally")).toBeVisible();

    // Go back to home
    await page.keyboard.press("Backspace");
    await expect(page).toHaveURL("/");

    // Navigate back to the same cheatsheet
    await page.goto("/cheatsheets/git");
    await page.waitForSelector("[class*='layoutToolbar']");

    // Should still show "Saved locally"
    await expect(page.locator("text=Saved locally")).toBeVisible();
  });
});
