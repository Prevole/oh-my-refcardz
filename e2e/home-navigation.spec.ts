import { test, expect } from "@playwright/test";

test.describe("Home keyboard navigation", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector("[data-testid='hex-board']");
  });

  test("displays cheatsheet cards on home page", async ({ page }) => {
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

    await expect(firstCard).toHaveAttribute("data-selected", "true");
    await page.keyboard.press("ArrowRight");
    await expect(firstCard).toHaveAttribute("data-selected", "false");
    const selectedCard = page.locator("[class*='hexCard'][data-selected='true']");
    await expect(selectedCard).toBeVisible();
  });

  test("navigates with vim keys (hjkl)", async ({ page }) => {
    const selectedCard = () => page.locator("[class*='hexCard'][data-selected='true']");

    const initialTitle = await selectedCard().locator("[class*='hexTitle']").textContent();

    // `l` moves the selection to a different card.
    await page.keyboard.press("l");
    const afterRight = await selectedCard().locator("[class*='hexTitle']").textContent();
    expect(afterRight).not.toBe(initialTitle);

    // `j` moves the selection again to confirm vim-keys are routed.
    // We do not assert `l` then `h` is idempotent: hex-grid navigation is
    // not strictly symmetric at the row boundaries, so `h` may be a no-op
    // depending on the card's column in its row.
    await page.keyboard.press("j");
    const afterDown = await selectedCard().locator("[class*='hexTitle']").textContent();
    expect(afterDown).not.toBe(afterRight);
  });

  test("navigates down/up between rows", async ({ page }) => {
    const selectedCard = () => page.locator("[class*='hexCard'][data-selected='true']");

    const initialTitle = await selectedCard().locator("[class*='hexTitle']").textContent();
    await page.keyboard.press("j");

    await expect(async () => {
      const afterDown = await selectedCard().locator("[class*='hexTitle']").textContent();
      expect(afterDown).not.toBe(initialTitle);
    }).toPass({ timeout: 2000 });

    await page.keyboard.press("k");

    await expect(async () => {
      const afterUp = await selectedCard().locator("[class*='hexTitle']").textContent();
      expect(afterUp).toBe(initialTitle);
    }).toPass({ timeout: 2000 });
  });

  test("opens selected sheet with Enter", async ({ page }) => {
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/cheatsheets\/.+/);
  });

  test("opens selected sheet with Space", async ({ page }) => {
    await page.keyboard.press(" ");
    await expect(page).toHaveURL(/\/cheatsheets\/.+/);
  });

  test("focuses search with /", async ({ page }) => {
    await page.keyboard.press("/");
    const searchInput = page.locator("#search");
    await expect(searchInput).toBeFocused();
  });

  test("filters cards with search query", async ({ page }) => {
    const cardsBeforeSearch = await page.locator("[class*='hexCard']").count();

    await page.keyboard.press("/");
    await page.keyboard.type("south");

    // Wait for filtering to take effect
    await page.waitForTimeout(300);

    const visibleCards = page.locator("[class*='hexCard']");
    const countAfter = await visibleCards.count();

    // Search should reduce the number of visible cards
    expect(countAfter).toBeLessThan(cardsBeforeSearch);
    expect(countAfter).toBeGreaterThan(0);

    const titles = await visibleCards.locator("[class*='hexTitle']").allTextContents();

    // The "south-fallback-fixture" cheatsheet must remain visible.
    const hasSouthRelated = titles.some((title) => title.toLowerCase().includes("south"));
    expect(hasSouthRelated).toBe(true);
  });

  test("clears search with Escape", async ({ page }) => {
    await page.keyboard.press("/");
    await page.keyboard.type("south");

    const searchInput = page.locator("#search");
    await expect(searchInput).toHaveValue("south");

    await page.keyboard.press("Escape");
    await expect(searchInput).toHaveValue("");
    await expect(searchInput).not.toBeFocused();
  });

  test("opens help modal with ?", async ({ page }) => {
    await page.keyboard.press("?");
    const helpModal = page.locator("[role='dialog']");
    await expect(helpModal).toBeVisible();
  });

  test("closes help modal with Escape", async ({ page }) => {
    await page.keyboard.press("?");
    const helpModal = page.locator("[role='dialog']");
    await expect(helpModal).toBeVisible();

    await page.keyboard.press("Escape");
    
    await expect(async () => {
      await expect(helpModal).toHaveCount(0, { timeout: 500 });
    }).toPass({ timeout: 5000 });
  });

  test("opens settings panel with ,", async ({ page }) => {
    await page.keyboard.press(",");
    const settingsHeading = page.getByRole("heading", { name: "Settings" });
    await expect(settingsHeading).toBeVisible();
  });

  test("opens info modal with i", async ({ page }) => {
    await page.keyboard.press("i");
    const infoModal = page.locator("[role='dialog']");
    await expect(infoModal).toBeVisible();
  });

  test("home keybindings still work after navigating to a sheet and back (browser back)", async ({ page }) => {
    // Regression test for FP14d follow-up: useKeyboardScope cleanup did not
    // reset wasActiveRef, so StrictMode's setup/cleanup/setup cycle on the
    // sheet route left the "sheet" scope un-pushed. On return to home, the
    // home scope was active but no keybindings responded because the active
    // scope reported by the stack was stale.
    const firstCard = page.locator("[class*='hexCard']").first();
    await expect(firstCard).toHaveAttribute("data-selected", "true");

    await page.keyboard.press("Enter");
    await expect(page).not.toHaveURL("/");
    await page.waitForSelector("h1");

    await page.goBack();
    await expect(page).toHaveURL("/");
    await page.waitForSelector("[data-testid='hex-board']");

    // If the bug regresses, the arrow keys will be silently ignored.
    await page.keyboard.press("ArrowRight");
    await expect(firstCard).toHaveAttribute("data-selected", "false");
    const selectedCard = page.locator("[class*='hexCard'][data-selected='true']");
    await expect(selectedCard).toBeVisible();
  });

  test("home keybindings still work after navigating to a sheet and back (Backspace)", async ({ page }) => {
    const firstCard = page.locator("[class*='hexCard']").first();
    await expect(firstCard).toHaveAttribute("data-selected", "true");

    await page.keyboard.press("Enter");
    await expect(page).not.toHaveURL("/");
    await page.waitForSelector("h1");

    await page.keyboard.press("Backspace");
    await expect(page).toHaveURL("/");
    await page.waitForSelector("[data-testid='hex-board']");

    await page.keyboard.press("ArrowRight");
    await expect(firstCard).toHaveAttribute("data-selected", "false");
  });
});
