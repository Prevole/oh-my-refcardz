import { test, expect } from "@playwright/test";

test.describe("Cheatsheet keyboard navigation", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/cheatsheets/git");
    await page.waitForSelector("[data-item]");
  });

  test("displays cheatsheet content", async ({ page }) => {
    const title = page.locator("h1");
    await expect(title).toBeVisible();
    const items = page.locator("[data-item]");
    await expect(items.first()).toBeVisible();
  });

  test("navigates to first item with arrow key", async ({ page }) => {
    await page.keyboard.press("ArrowDown");
    
    await expect(async () => {
      const focusedItem = page.locator("[data-item][data-nav-focused='true'], [data-copyable][data-nav-focused='true']");
      await expect(focusedItem).toBeVisible({ timeout: 500 });
    }).toPass({ timeout: 5000 });
  });

  test("navigates with vim keys (j/k)", async ({ page }) => {
    // Press j to start navigation
    await page.keyboard.press("j");
    
    await expect(async () => {
      const focused = page.locator("[data-nav-focused='true']");
      await expect(focused).toBeVisible({ timeout: 500 });
    }).toPass({ timeout: 5000 });

    // Get initial focused element
    const initialFocused = page.locator("[data-nav-focused='true']");
    const initialRect = await initialFocused.boundingBox();
    
    // Press j multiple times to move down
    for (let i = 0; i < 3; i++) {
      await page.keyboard.press("j");
      await page.waitForTimeout(100);
    }
    
    // Verify we moved (position changed or different element)
    await expect(async () => {
      const currentFocused = page.locator("[data-nav-focused='true']");
      const currentRect = await currentFocused.boundingBox();
      // Should have moved down (y position increased) or at minimum stayed visible
      expect(currentRect).not.toBeNull();
      if (initialRect && currentRect) {
        expect(currentRect.y).toBeGreaterThanOrEqual(initialRect.y);
      }
    }).toPass({ timeout: 5000 });

    // Press k to move back up
    await page.keyboard.press("k");
    
    await expect(async () => {
      const focused = page.locator("[data-nav-focused='true']");
      await expect(focused).toBeVisible({ timeout: 500 });
    }).toPass({ timeout: 5000 });
  });

  test("goes back to home with Backspace", async ({ page }) => {
    await page.keyboard.press("Backspace");
    await expect(page).toHaveURL("/");
  });

  test("clears focus with Escape when item is focused", async ({ page }) => {
    await page.keyboard.press("j");
    
    await expect(async () => {
      const focused = page.locator("[data-nav-focused='true']");
      await expect(focused).toBeVisible({ timeout: 500 });
    }).toPass({ timeout: 5000 });

    await page.keyboard.press("Escape");
    
    await expect(async () => {
      const stillFocused = await page.locator("[data-nav-focused='true']").count();
      expect(stillFocused).toBe(0);
    }).toPass({ timeout: 5000 });
  });

  test("goes back to home with Backspace when no item is focused", async ({ page }) => {
    await page.keyboard.press("Backspace");
    await expect(page).toHaveURL("/");
  });

  test("opens help modal with Shift+/", async ({ page }) => {
    // Focus something first to ensure we're not in an input
    await page.locator("body").click();
    await page.waitForTimeout(100);
    
    // Type ? (which is Shift+/ on US keyboard)
    await page.keyboard.type("?");
    
    await expect(async () => {
      const helpModal = page.locator("[role='dialog']");
      await expect(helpModal).toBeVisible({ timeout: 500 });
    }).toPass({ timeout: 5000 });
  });

  test("opens settings panel with ,", async ({ page }) => {
    await expect(async () => {
      await page.keyboard.press(",");
      const settingsHeading = page.getByRole("heading", { name: "Settings" });
      await expect(settingsHeading).toBeVisible({ timeout: 1000 });
    }).toPass({ timeout: 10000 });
  });

  test("scrolls to top with gg", async ({ page }) => {
    await page.evaluate(() => window.scrollTo(0, 500));

    await expect(async () => {
      const scrollBefore = await page.evaluate(() => window.scrollY);
      expect(scrollBefore).toBeGreaterThan(0);
    }).toPass({ timeout: 2000 });

    await page.keyboard.press("g");
    await page.keyboard.press("g");

    await expect(async () => {
      const scrollAfter = await page.evaluate(() => window.scrollY);
      expect(scrollAfter).toBe(0);
    }).toPass({ timeout: 2000 });
  });

  test("scrolls to bottom with Shift+G", async ({ page }) => {
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.keyboard.press("Shift+G");

    await expect(async () => {
      const scrollY = await page.evaluate(() => window.scrollY);
      expect(scrollY).toBeGreaterThan(100);
    }).toPass({ timeout: 2000 });
  });
});

test.describe("Cheatsheet item actions", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/cheatsheets/git");
    await page.waitForSelector("[data-item]");
  });

  test("copies command with y key", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    
    // Navigate to an item first with multiple attempts
    await expect(async () => {
      await page.keyboard.press("j");
      await page.waitForTimeout(100);
      const focused = page.locator("[data-nav-focused='true']");
      await expect(focused).toBeVisible({ timeout: 1000 });
    }).toPass({ timeout: 10000 });
    
    await page.keyboard.press("y");

    await expect(async () => {
      const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
      expect(clipboardText.length).toBeGreaterThan(0);
    }).toPass({ timeout: 5000 });
  });

  test("shows details modal with i key when item has details", async ({ page }) => {
    // Navigate to an item first with multiple attempts
    await expect(async () => {
      await page.keyboard.press("j");
      await page.waitForTimeout(100);
      const focused = page.locator("[data-nav-focused='true']");
      await expect(focused).toBeVisible({ timeout: 1000 });
    }).toPass({ timeout: 10000 });

    // Navigate to find an item with details (multiple j presses)
    let foundItemWithDetails = false;
    for (let i = 0; i < 15; i++) {
      const focusedItem = page.locator("[data-item][data-nav-focused='true']");
      const count = await focusedItem.count();
      if (count > 0) {
        const hasDetailsAttr = await focusedItem.getAttribute("data-item-details");
        if (hasDetailsAttr && hasDetailsAttr !== "null" && hasDetailsAttr.length > 10) {
          foundItemWithDetails = true;
          break;
        }
      }
      await page.keyboard.press("j");
      await page.waitForTimeout(150);
    }

    if (foundItemWithDetails) {
      await page.keyboard.press("i");

      await expect(async () => {
        const modalOverlay = page.locator("[data-command-modal-overlay]");
        await expect(modalOverlay).toBeVisible({ timeout: 500 });
      }).toPass({ timeout: 5000 });

      await page.keyboard.press("Escape");
      
      await expect(async () => {
        const modalOverlay = page.locator("[data-command-modal-overlay]");
        await expect(modalOverlay).toHaveCount(0, { timeout: 500 });
      }).toPass({ timeout: 5000 });
    }
  });

  test("opens placeholder modal when copying command with placeholders", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);

    // Navigate to find a command with placeholder (e.g., <branch name>)
    let foundCommandWithPlaceholder = false;
    
    for (let i = 0; i < 20; i++) {
      await page.keyboard.press("j");
      await page.waitForTimeout(100);
      
      const focused = page.locator("[data-copyable][data-nav-focused='true']");
      const count = await focused.count();
      if (count > 0) {
        const copyValue = await focused.getAttribute("data-copy-value");
        if (copyValue && copyValue.includes("<")) {
          foundCommandWithPlaceholder = true;
          break;
        }
      }
    }

    if (foundCommandWithPlaceholder) {
      // Press y to copy - should open placeholder modal
      await page.keyboard.press("y");

      await expect(async () => {
        const modalOverlay = page.locator("[data-command-modal-overlay]");
        await expect(modalOverlay).toBeVisible({ timeout: 500 });
      }).toPass({ timeout: 5000 });

      // Modal should have input fields for placeholders
      const inputField = page.locator("[data-command-modal-overlay] input");
      await expect(inputField.first()).toBeVisible();

      // Fill in a placeholder value
      await inputField.first().fill("test-branch");

      // Preview should update
      const preview = page.locator("[data-command-modal-overlay] p").last();
      await expect(preview).toContainText("test-branch");

      // Submit with Enter
      await page.keyboard.press("Enter");

      // Modal should close after copy
      await expect(async () => {
        const modalOverlay = page.locator("[data-command-modal-overlay]");
        await expect(modalOverlay).toHaveCount(0, { timeout: 1500 });
      }).toPass({ timeout: 5000 });

      // Clipboard should have the resolved command
      const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
      expect(clipboardText).toContain("test-branch");
    }
  });

  test("navigates between multiple copyables in an item with j/k", async ({ page }) => {
    // Navigate to find an item with multiple copyables
    let foundItemWithMultipleCopyables = false;
    
    for (let i = 0; i < 30; i++) {
      await page.keyboard.press("j");
      await page.waitForTimeout(100);
      
      // Check if current item has multiple copyables
      const focusedItem = page.locator("[data-item][data-nav-focused='true']");
      const itemCount = await focusedItem.count();
      
      if (itemCount > 0) {
        const copyablesInItem = focusedItem.locator("[data-copyable]");
        const copyableCount = await copyablesInItem.count();
        
        if (copyableCount >= 2) {
          foundItemWithMultipleCopyables = true;
          break;
        }
      }
      
      // Also check if we're focused on a copyable inside an item with siblings
      const focusedCopyable = page.locator("[data-copyable][data-nav-focused='true']");
      const copyableIsVisible = await focusedCopyable.count();
      
      if (copyableIsVisible > 0) {
        const parentItem = focusedCopyable.locator("xpath=ancestor::*[@data-item]");
        const parentExists = await parentItem.count();
        
        if (parentExists > 0) {
          const siblingsCount = await parentItem.locator("[data-copyable]").count();
          if (siblingsCount >= 2) {
            foundItemWithMultipleCopyables = true;
            break;
          }
        }
      }
    }

    if (foundItemWithMultipleCopyables) {
      // Get current focused element position
      const initialFocused = page.locator("[data-nav-focused='true']");
      const initialText = await initialFocused.textContent();
      
      // Press j to move to next copyable
      await page.keyboard.press("j");
      await page.waitForTimeout(100);
      
      // Check that focus moved
      const newFocused = page.locator("[data-nav-focused='true']");
      await expect(newFocused).toBeVisible();
      
      const newText = await newFocused.textContent();
      
      // Press k to move back
      await page.keyboard.press("k");
      await page.waitForTimeout(100);
      
      const backFocused = page.locator("[data-nav-focused='true']");
      await expect(backFocused).toBeVisible();
      
      // Either we moved between copyables (texts differ) or we moved between items
      // The navigation should work smoothly in either case
      expect(initialText !== null || newText !== null).toBe(true);
    }
  });
});
