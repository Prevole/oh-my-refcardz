import { test, expect, type Page } from "@playwright/test";

// Phase D E2E: reset layout to original.
// Three flows are covered:
//   1. Initially, no reset button is visible (layout matches original).
//   2. After a user mutation that diverges from the original, the
//      floating reset button appears and persists across reload.
//   3. Clicking the button (or pressing Shift+R) restores the original
//      layout, clears the localStorage key, and hides the button.

const SHEET_SLUG = "layout-reset-fixture";
const STORAGE_KEY = `sheet-layout:${SHEET_SLUG}`;

async function gotoSheetReady(page: Page) {
  await page.goto(`/cheatsheets/${SHEET_SLUG}`);
  await page.waitForSelector("[data-sheet-grid][data-layout-ready='true']");
}

async function seedModifiedLayout(page: Page) {
  // Build a synthetic layout that swaps two blocks. The exact positions
  // don't matter — only that the resulting layout differs from the
  // YAML-inferred original, which is what `isModifiedFromOriginal`
  // observes.
  await page.evaluate((storageKey: string) => {
    const articles = Array.from(
      document.querySelectorAll<HTMLElement>("article[data-layout-card='true']")
    );

    const HEADING_PREFIX = "sheet-heading-";
    const CARD_PREFIX = "sheet-card-";
    function stripPrefix(fullId: string): { id: string; kind: "heading" | "card" } {
      if (fullId.startsWith(HEADING_PREFIX)) {
        return { id: fullId.slice(HEADING_PREFIX.length), kind: "heading" };
      }
      if (fullId.startsWith(CARD_PREFIX)) {
        return { id: fullId.slice(CARD_PREFIX.length), kind: "card" };
      }
      return { id: fullId, kind: "card" };
    }

    const orderedRawIds = articles.map((a) =>
      stripPrefix(a.getAttribute("data-layout-block-id") ?? "")
    );

    // Force a non-default layout: put Section B at the very top and
    // Section A further down.
    const layout: Record<string, { colStart: number; rowStart: number; colSpan: number; rowSpan: number }> = {
      "section-b": { colStart: 1, rowStart: 1, colSpan: 36, rowSpan: 2 },
      "card-b1": { colStart: 1, rowStart: 3, colSpan: 18, rowSpan: 6 },
      "card-b2": { colStart: 19, rowStart: 3, colSpan: 18, rowSpan: 6 },
      "section-a": { colStart: 1, rowStart: 9, colSpan: 36, rowSpan: 2 },
      "card-a1": { colStart: 1, rowStart: 11, colSpan: 36, rowSpan: 6 },
    };

    const blocks = orderedRawIds.map(({ id, kind }) => ({
      id,
      kind,
      ...(layout[id] ?? { colStart: 1, rowStart: 1, colSpan: 36, rowSpan: 2 }),
    }));

    localStorage.setItem(storageKey, JSON.stringify({ version: 3, blocks }));
  }, STORAGE_KEY);
}

test.describe("Layout reset (Phase D)", () => {
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

  test("no reset button is shown on a pristine layout", async ({ page }) => {
    await gotoSheetReady(page);
    await expect(page.getByTestId("layout-reset-button")).toHaveCount(0);
  });

  test("reset button appears after the layout diverges from the original", async ({ page }) => {
    await gotoSheetReady(page);
    await seedModifiedLayout(page);

    await page.goto(`/cheatsheets/${SHEET_SLUG}`);
    await page.waitForSelector("[data-sheet-grid][data-layout-ready='true']");

    await expect(page.getByTestId("layout-reset-button")).toBeVisible();
  });

  test("clicking the reset button restores the original layout and clears storage", async ({ page }) => {
    await gotoSheetReady(page);
    await seedModifiedLayout(page);

    await page.goto(`/cheatsheets/${SHEET_SLUG}`);
    await page.waitForSelector("[data-sheet-grid][data-layout-ready='true']");

    const resetButton = page.getByTestId("layout-reset-button");
    await expect(resetButton).toBeVisible();

    await resetButton.click();

    await expect(resetButton).toHaveCount(0);

    const stored = await page.evaluate((key: string) => localStorage.getItem(key), STORAGE_KEY);
    expect(stored).toBeNull();
  });

  test("Shift+R keybinding triggers reset when the layout has been modified", async ({ page }) => {
    await gotoSheetReady(page);
    await seedModifiedLayout(page);

    await page.goto(`/cheatsheets/${SHEET_SLUG}`);
    await page.waitForSelector("[data-sheet-grid][data-layout-ready='true']");

    await expect(page.getByTestId("layout-reset-button")).toBeVisible();

    // Click the page first to make sure focus is on the document, not on
    // a stale form element.
    await page.locator("[data-sheet-grid]").click({ position: { x: 5, y: 5 } });
    await page.keyboard.press("Shift+R");

    await expect(page.getByTestId("layout-reset-button")).toHaveCount(0);

    const stored = await page.evaluate((key: string) => localStorage.getItem(key), STORAGE_KEY);
    expect(stored).toBeNull();
  });
});
