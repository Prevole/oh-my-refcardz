import { test, expect } from "@playwright/test";

test.describe("Home keyboard navigation", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    // Wait for hex board to be rendered
    await page.waitForSelector("[class*='hexBoard']");
  });

  test("displays cheatsheet cards on home page", async ({ page }) => {
    // Should have at least one hex card
    const cards = page.locator("[class*='hexCard']");
    await expect(cards.first()).toBeVisible();
  });

  test("first card is selected by default", async ({ page }) => {
    const firstCard = page.locator("[class*='hexCard']").first();
    await expect(firstCard).toHaveAttribute("data-selected", "true");
  });

  test("navigates right with arrow key", async ({ page }) => {
    const cards = page.locator("[class*='hexCard']");
    const firstCard = cards.first();

    // First card should be selected initially
    await expect(firstCard).toHaveAttribute("data-selected", "true");

    // Press right arrow
    await page.keyboard.press("ArrowRight");

    // First card should no longer be selected
    await expect(firstCard).toHaveAttribute("data-selected", "false");

    // Some other card should be selected
    const selectedCard = page.locator("[class*='hexCard'][data-selected='true']");
    await expect(selectedCard).toBeVisible();
  });

  test("navigates with vim keys (hjkl)", async ({ page }) => {
    const selectedCard = () => page.locator("[class*='hexCard'][data-selected='true']");

    // Get initial selection
    const initialTitle = await selectedCard().locator("[class*='hexTitle']").textContent();

    // Navigate right with 'l'
    await page.keyboard.press("l");
    const afterRight = await selectedCard().locator("[class*='hexTitle']").textContent();
    expect(afterRight).not.toBe(initialTitle);

    // Navigate left with 'h'
    await page.keyboard.press("h");
    const afterLeft = await selectedCard().locator("[class*='hexTitle']").textContent();
    expect(afterLeft).toBe(initialTitle);
  });

  test("navigates down/up between rows", async ({ page }) => {
    const selectedCard = () => page.locator("[class*='hexCard'][data-selected='true']");

    // Get initial selection
    const initialTitle = await selectedCard().locator("[class*='hexTitle']").textContent();

    // Navigate down with 'j'
    await page.keyboard.press("j");
    const afterDown = await selectedCard().locator("[class*='hexTitle']").textContent();
    expect(afterDown).not.toBe(initialTitle);

    // Navigate up with 'k'
    await page.keyboard.press("k");
    const afterUp = await selectedCard().locator("[class*='hexTitle']").textContent();
    expect(afterUp).toBe(initialTitle);
  });

  test("opens selected sheet with Enter", async ({ page }) => {
    // Press Enter to open the selected sheet
    await page.keyboard.press("Enter");

    // Should navigate to a cheatsheet page
    await expect(page).toHaveURL(/\/cheatsheets\/.+/);
  });

  test("opens selected sheet with Space", async ({ page }) => {
    // Press Space to open the selected sheet
    await page.keyboard.press(" ");

    // Should navigate to a cheatsheet page
    await expect(page).toHaveURL(/\/cheatsheets\/.+/);
  });

  test("focuses search with /", async ({ page }) => {
    // Press / to focus search
    await page.keyboard.press("/");

    // Search input should be focused
    const searchInput = page.locator("#search");
    await expect(searchInput).toBeFocused();
  });

  test("filters cards with search query", async ({ page }) => {
    // Focus search and type a query
    await page.keyboard.press("/");
    await page.keyboard.type("git");

    // Should filter cards - only git-related cards should be visible
    const visibleCards = page.locator("[class*='hexCard']");
    const count = await visibleCards.count();
    expect(count).toBeGreaterThan(0);

    // All visible cards should contain "git" in their title
    const titles = await visibleCards.locator("[class*='hexTitle']").allTextContents();
    for (const title of titles) {
      expect(title.toLowerCase()).toContain("git");
    }
  });

  test("clears search with Escape", async ({ page }) => {
    // Focus search and type a query
    await page.keyboard.press("/");
    await page.keyboard.type("git");

    // Wait for filtering
    await page.waitForTimeout(100);

    // Press Escape to clear
    await page.keyboard.press("Escape");

    // Search should be cleared
    const searchInput = page.locator("#search");
    await expect(searchInput).toHaveValue("");

    // Search should no longer be focused
    await expect(searchInput).not.toBeFocused();
  });

  test("opens help modal with ?", async ({ page }) => {
    // Press ? to open help
    await page.keyboard.press("?");

    // Help modal should be visible
    const helpModal = page.locator("[role='dialog']");
    await expect(helpModal).toBeVisible();
  });

  test("closes help modal with Escape", async ({ page }) => {
    // Open help
    await page.keyboard.press("?");
    const helpModal = page.locator("[role='dialog']");
    await expect(helpModal).toBeVisible();

    // Close with Escape
    await page.keyboard.press("Escape");
    await expect(helpModal).not.toBeVisible();
  });

  test("opens settings panel with ,", async ({ page }) => {
    // Press , to open settings
    await page.keyboard.press(",");

    // Settings panel should be visible (look for the heading specifically)
    const settingsHeading = page.getByRole("heading", { name: "Settings" });
    await expect(settingsHeading).toBeVisible();
  });

  test("opens info modal with i", async ({ page }) => {
    // Press i to open info modal for selected card
    await page.keyboard.press("i");

    // Info modal should be visible with sheet details
    const infoModal = page.locator("[role='dialog']");
    await expect(infoModal).toBeVisible();
  });
});
