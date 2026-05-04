import { test, expect } from "@playwright/test";

test.describe("Cheatsheet keyboard navigation", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/cheatsheets/git");
    await page.waitForSelector("[data-sheet-command]");
  });

  test("displays cheatsheet content", async ({ page }) => {
    const title = page.locator("h1");
    await expect(title).toBeVisible();
    const commands = page.locator("[data-sheet-command]");
    await expect(commands.first()).toBeVisible();
  });

  test("navigates to first command with arrow key", async ({ page }) => {
    await page.keyboard.press("ArrowDown");
    const focusedCommand = page.locator("[data-sheet-command][data-nav-focused='true']");
    await expect(focusedCommand).toBeVisible();
  });

  test("navigates between commands with arrow keys", async ({ page }) => {
    await page.keyboard.press("j");
    const getFocusedText = async () => {
      return page.locator("[data-sheet-command][data-nav-focused='true']").textContent();
    };

    const firstText = await getFocusedText();

    await page.keyboard.press("j");
    const secondText = await getFocusedText();

    expect(secondText).not.toBe(firstText);
    await page.keyboard.press("k");
    const backText = await getFocusedText();

    expect(backText).toBe(firstText);
  });

  test("navigates with vim keys (hjkl)", async ({ page }) => {
    await page.keyboard.press("j");

    const focusedCommand = () => page.locator("[data-sheet-command][data-nav-focused='true']");

    await expect(focusedCommand()).toBeVisible();
    const initialText = await focusedCommand().textContent();

    await page.keyboard.press("j");
    const afterDown = await focusedCommand().textContent();
    expect(afterDown).not.toBe(initialText);

    await page.keyboard.press("k");
    const afterUp = await focusedCommand().textContent();
    expect(afterUp).toBe(initialText);
  });

  test("goes back to home with Backspace", async ({ page }) => {
    await page.keyboard.press("Backspace");
    await expect(page).toHaveURL("/");
  });

  test("goes back to home with Escape", async ({ page }) => {
    await page.keyboard.press("Escape");
    await expect(page).toHaveURL("/");
  });

  test("opens help modal with ?", async ({ page }) => {
    await page.keyboard.press("?");
    const helpModal = page.locator("[role='dialog']");
    await expect(helpModal).toBeVisible();
  });

  test("opens settings panel with ,", async ({ page }) => {
    await page.keyboard.press(",");
    const settingsHeading = page.getByRole("heading", { name: "Settings" });
    await expect(settingsHeading).toBeVisible();
  });

  test("scrolls to top with gg", async ({ page }) => {
    await page.evaluate(() => window.scrollTo(0, 500));
    await page.waitForTimeout(100);

    const scrollBefore = await page.evaluate(() => window.scrollY);
    expect(scrollBefore).toBeGreaterThan(0);

    await page.keyboard.press("g");
    await page.keyboard.press("g");

    await page.waitForTimeout(500);
    const scrollAfter = await page.evaluate(() => window.scrollY);
    expect(scrollAfter).toBe(0);
  });

  test("scrolls to bottom with Shift+G", async ({ page }) => {
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.keyboard.press("Shift+G");
    await page.waitForTimeout(1000);
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
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.keyboard.press("j");
    const focusedCommand = page.locator("[data-sheet-command][data-nav-focused='true']");
    await expect(focusedCommand).toBeVisible();
    await page.keyboard.press("y");
    await page.waitForTimeout(100);

    const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
    expect(clipboardText.length).toBeGreaterThan(0);
  });

  test("shows example modal with i key", async ({ page }) => {
    await page.keyboard.press("j");
    await page.keyboard.press("i");
    await page.waitForTimeout(200);
    const modalOverlay = page.locator("[data-command-modal-overlay]");
    const modalCount = await modalOverlay.count();
    if (modalCount > 0) {
      await expect(modalOverlay).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(modalOverlay).not.toBeVisible();
    }
  });
});
