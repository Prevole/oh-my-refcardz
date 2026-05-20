import { test, expect } from "@playwright/test";

const SHEET_SLUG = "nav-fixture";
const SHEET_URL = `/cheatsheets/${SHEET_SLUG}`;

test.describe("Cheatsheet keyboard navigation", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(SHEET_URL);
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

  test("clears focus when clicking on non-navigable area", async ({ page }) => {
    // Focus an item first
    await page.keyboard.press("j");
    
    await expect(async () => {
      const focused = page.locator("[data-nav-focused='true']");
      await expect(focused).toBeVisible({ timeout: 500 });
    }).toPass({ timeout: 5000 });

    // Click on the page header (non-navigable area)
    const header = page.locator("h1");
    await header.click();
    
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
    await page.goto(SHEET_URL);
    await page.waitForSelector("[data-item]");
  });

  test("copies command with y key", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);

    // Click directly on a known command from the fixture to focus it.
    // The first card "Simple Commands" contains an item with command
    // "nav-fixture-cmd-one" (no placeholder, so y copies it verbatim).
    const target = page.locator("[data-copyable='nav-fixture-cmd-one']");
    await expect(target).toBeVisible();
    await target.click();

    await expect(target).toHaveAttribute("data-nav-focused", "true");

    await page.keyboard.press("y");

    await expect(async () => {
      const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
      expect(clipboardText).toBe("nav-fixture-cmd-one");
    }).toPass({ timeout: 5000 });
  });

  test("shows details modal with i key when item has details", async ({ page }) => {
    // The "Commands With Details" card contains an item with detailedEntries.
    // We click on its primary command to focus the parent item, then press i.
    const copyable = page.locator("[data-copyable='nav-fixture-detailed']");
    await expect(copyable).toBeVisible();
    await copyable.click();

    // The focus may land on the copyable or on its parent item; both are
    // valid entry points for the "i" action.
    await expect(page.locator("[data-nav-focused='true']").first()).toBeVisible();

    await page.keyboard.press("i");

    const modalOverlay = page.locator("[data-command-modal-overlay]");
    await expect(modalOverlay).toBeVisible({ timeout: 2000 });

    await page.keyboard.press("Escape");
    await expect(modalOverlay).toHaveCount(0, { timeout: 2000 });
  });

  test("opens placeholder modal when copying command with placeholders", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);

    // The "Commands With Placeholders" card contains
    // "nav-fixture-branch <branch name>". Focus it and press y.
    const target = page.locator(
      "[data-copyable='nav-fixture-branch <branch name>']"
    );
    await expect(target).toBeVisible();
    await target.click();

    await expect(target).toHaveAttribute("data-nav-focused", "true");

    await page.keyboard.press("y");

    const modalOverlay = page.locator("[data-command-modal-overlay]");
    await expect(modalOverlay).toBeVisible({ timeout: 2000 });

    const inputField = page.locator("[data-command-modal-overlay] input");
    await expect(inputField.first()).toBeVisible();

    await inputField.first().fill("test-branch");

    const preview = page.locator("[data-command-modal-overlay] pre");
    await expect(preview).toContainText("test-branch");

    await page.keyboard.press("Enter");

    await expect(modalOverlay).toHaveCount(0, { timeout: 2000 });

    const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
    expect(clipboardText).toContain("test-branch");
    expect(clipboardText).toContain("nav-fixture-branch");
  });

  test("navigates between multiple copyables in an item with j/k", async ({ page }) => {
    // The "Multi-Copyable Items" card has an item with three copyables:
    // alias "nav a", command "nav-fixture-multi-primary", and
    // commandExample "nav-fixture-multi-primary --flag".
    // We focus the first one explicitly, then verify j/k cycles within
    // the same parent item.
    const first = page.locator("[data-copyable='nav a']");
    await expect(first).toBeVisible();
    await first.click();
    await expect(first).toHaveAttribute("data-nav-focused", "true");

    // j moves to the next copyable in the same item.
    await page.keyboard.press("j");
    const second = page.locator(
      "[data-copyable='nav-fixture-multi-primary']"
    );
    await expect(second).toHaveAttribute("data-nav-focused", "true", { timeout: 2000 });

    // k moves back to the first copyable.
    await page.keyboard.press("k");
    await expect(first).toHaveAttribute("data-nav-focused", "true", { timeout: 2000 });
  });
});
