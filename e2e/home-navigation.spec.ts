import { test, expect } from "@playwright/test";

test.describe("Home keyboard navigation", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector("[class*='hexBoard']");
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
    await page.keyboard.press("l");
    const afterRight = await selectedCard().locator("[class*='hexTitle']").textContent();
    expect(afterRight).not.toBe(initialTitle);

    await page.keyboard.press("h");
    const afterLeft = await selectedCard().locator("[class*='hexTitle']").textContent();
    expect(afterLeft).toBe(initialTitle);
  });

  test("navigates down/up between rows", async ({ page }) => {
    const selectedCard = () => page.locator("[class*='hexCard'][data-selected='true']");

    const initialTitle = await selectedCard().locator("[class*='hexTitle']").textContent();
    await page.keyboard.press("j");
    const afterDown = await selectedCard().locator("[class*='hexTitle']").textContent();
    expect(afterDown).not.toBe(initialTitle);

    await page.keyboard.press("k");
    const afterUp = await selectedCard().locator("[class*='hexTitle']").textContent();
    expect(afterUp).toBe(initialTitle);
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
    await page.keyboard.press("/");
    await page.keyboard.type("git");
    const visibleCards = page.locator("[class*='hexCard']");
    const count = await visibleCards.count();
    expect(count).toBeGreaterThan(0);

    const titles = await visibleCards.locator("[class*='hexTitle']").allTextContents();
    for (const title of titles) {
      expect(title.toLowerCase()).toContain("git");
    }
  });

  test("clears search with Escape", async ({ page }) => {
    await page.keyboard.press("/");
    await page.keyboard.type("git");
    await page.waitForTimeout(100);
    await page.keyboard.press("Escape");
    const searchInput = page.locator("#search");
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
    await expect(helpModal).not.toBeVisible();
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
});
