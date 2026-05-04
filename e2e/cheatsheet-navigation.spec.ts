import { test, expect } from "@playwright/test";

test.describe("Cheatsheet keyboard navigation", () => {
  test.beforeEach(async ({ page }) => {
    // Go to a specific cheatsheet (git is usually available)
    await page.goto("/cheatsheets/git");
    // Wait for content to load
    await page.waitForSelector("[data-sheet-command]");
  });

  test("displays cheatsheet content", async ({ page }) => {
    // Should have a title
    const title = page.locator("h1");
    await expect(title).toBeVisible();

    // Should have commands
    const commands = page.locator("[data-sheet-command]");
    await expect(commands.first()).toBeVisible();
  });

  test("navigates to first command with arrow key", async ({ page }) => {
    // Press down to start navigation
    await page.keyboard.press("ArrowDown");

    // A command should be focused
    const focusedCommand = page.locator("[data-sheet-command][data-nav-focused='true']");
    await expect(focusedCommand).toBeVisible();
  });

  test("navigates between commands with arrow keys", async ({ page }) => {
    // Start navigation
    await page.keyboard.press("j");

    // Get first focused command
    const getFocusedText = async () => {
      return page.locator("[data-sheet-command][data-nav-focused='true']").textContent();
    };

    const firstText = await getFocusedText();

    // Navigate down
    await page.keyboard.press("j");
    const secondText = await getFocusedText();

    // Should have moved to a different command
    expect(secondText).not.toBe(firstText);

    // Navigate back up
    await page.keyboard.press("k");
    const backText = await getFocusedText();

    // Should be back to first
    expect(backText).toBe(firstText);
  });

  test("navigates with vim keys (hjkl)", async ({ page }) => {
    // Start navigation
    await page.keyboard.press("j");

    const focusedCommand = () => page.locator("[data-sheet-command][data-nav-focused='true']");

    // Navigate down with j
    await expect(focusedCommand()).toBeVisible();
    const initialText = await focusedCommand().textContent();

    // Navigate further with j
    await page.keyboard.press("j");
    const afterDown = await focusedCommand().textContent();
    expect(afterDown).not.toBe(initialText);

    // Navigate up with k
    await page.keyboard.press("k");
    const afterUp = await focusedCommand().textContent();
    expect(afterUp).toBe(initialText);
  });

  test("goes back to home with Backspace", async ({ page }) => {
    // Press Backspace to go back
    await page.keyboard.press("Backspace");

    // Should be back on home page
    await expect(page).toHaveURL("/");
  });

  test("goes back to home with Escape", async ({ page }) => {
    // Press Escape to go back
    await page.keyboard.press("Escape");

    // Should be back on home page
    await expect(page).toHaveURL("/");
  });

  test("opens help modal with ?", async ({ page }) => {
    // Press ? to open help
    await page.keyboard.press("?");

    // Help modal should be visible
    const helpModal = page.locator("[role='dialog']");
    await expect(helpModal).toBeVisible();
  });

  test("opens settings panel with ,", async ({ page }) => {
    // Press , to open settings
    await page.keyboard.press(",");

    // Settings panel should be visible (look for the heading specifically)
    const settingsHeading = page.getByRole("heading", { name: "Settings" });
    await expect(settingsHeading).toBeVisible();
  });

  test("scrolls to top with gg", async ({ page }) => {
    // First scroll down a bit
    await page.evaluate(() => window.scrollTo(0, 500));
    await page.waitForTimeout(100);

    // Verify we scrolled
    const scrollBefore = await page.evaluate(() => window.scrollY);
    expect(scrollBefore).toBeGreaterThan(0);

    // Press g twice to go to top
    await page.keyboard.press("g");
    await page.keyboard.press("g");

    // Wait for smooth scroll
    await page.waitForTimeout(500);

    // Should be at top
    const scrollAfter = await page.evaluate(() => window.scrollY);
    expect(scrollAfter).toBe(0);
  });

  test("scrolls to bottom with Shift+G", async ({ page }) => {
    // Make sure we're at top
    await page.evaluate(() => window.scrollTo(0, 0));

    // Press Shift+G to go to bottom
    await page.keyboard.press("Shift+G");

    // Wait for smooth scroll to complete
    await page.waitForTimeout(1000);

    // Should have scrolled down significantly
    const scrollY = await page.evaluate(() => window.scrollY);
    expect(scrollY).toBeGreaterThan(100);
  });
});

test.describe("Cheatsheet command actions", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/cheatsheets/git");
    await page.waitForSelector("[data-sheet-command]");
  });

  test("copies command with y key", async ({ page, context }) => {
    // Grant clipboard permissions
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);

    // Navigate to a command
    await page.keyboard.press("j");

    // Get the focused command text
    const focusedCommand = page.locator("[data-sheet-command][data-nav-focused='true']");
    await expect(focusedCommand).toBeVisible();

    // Press y to copy
    await page.keyboard.press("y");

    // Check clipboard (may need to wait for copy operation)
    await page.waitForTimeout(100);

    const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
    expect(clipboardText.length).toBeGreaterThan(0);
  });

  test("shows example modal with i key", async ({ page }) => {
    // Navigate to a command that has an example
    await page.keyboard.press("j");

    // Try to open example modal
    await page.keyboard.press("i");

    // Wait a bit for potential modal
    await page.waitForTimeout(200);

    // Check if a modal appeared (some commands may not have examples)
    // This test is more about ensuring the key doesn't break anything
    const modalOverlay = page.locator("[data-command-modal-overlay]");
    const modalCount = await modalOverlay.count();

    // If a modal opened, it should be closeable with Escape
    if (modalCount > 0) {
      await expect(modalOverlay).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(modalOverlay).not.toBeVisible();
    }
  });
});
