import { test, expect, type Page } from "@playwright/test";

/**
 * Phase FA buffered-mode E2E.
 *
 * Covers the buffer/commit/discard contract introduced by FA2–FA5:
 *   - Esc with fewer than 5 staged changes → silent discard.
 *   - Esc with 5+ staged changes → modal opens.
 *   - Modal Confirm (Enter)  → buffer discarded, layout reverts.
 *   - Modal Cancel  (Escape) → modal closes, buffer intact, mode active.
 *
 * Uses the same `layout-e2e` fixture as `keyboard-layout.spec.ts`: a
 * `bottom-left` card with ~60 free engine rows south, so chained grow-
 * south resize operations are deterministic.
 *
 * FA8 will consolidate every buffered-mode E2E (commit path included)
 * into this file. For now we only test the discard paths because
 * commit and basic move/resize are already covered by
 * `keyboard-layout.spec.ts`.
 */

const SHEET_SLUG = "layout-e2e";

type BlockSnapshot = {
  id: string;
  colStart: number;
  rowStart: number;
  colSpan: number;
  rowSpan: number;
};

async function gotoSheetReady(page: Page) {
  await page.goto(`/cheatsheets/${SHEET_SLUG}`);
  await page.waitForSelector("[data-sheet-grid][data-layout-ready='true']");
}

async function clearLayoutStorage(page: Page) {
  await page.goto("/");
  await page.evaluate(() => {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith("sheet-layout:")) {
        localStorage.removeItem(key);
      }
    }
  });
}

async function readBlockSnapshots(page: Page): Promise<BlockSnapshot[]> {
  return page.evaluate(() => {
    function readVar(style: string, name: string): number {
      const re = new RegExp(`--${name}:\\s*(\\d+)`);
      const match = style.match(re);
      return match ? parseInt(match[1], 10) : NaN;
    }
    const articles = Array.from(
      document.querySelectorAll<HTMLElement>("article[data-layout-card='true']"),
    );
    return articles
      .map((article) => {
        const id = article.getAttribute("data-layout-block-id") ?? "";
        const style = article.getAttribute("style") ?? "";
        return {
          id,
          colStart: readVar(style, "card-col-start"),
          rowStart: readVar(style, "card-row-start"),
          colSpan: readVar(style, "card-col-span"),
          rowSpan: readVar(style, "card-row-span"),
        };
      })
      .filter((snap) => snap.id !== "");
  });
}

async function findById(page: Page, id: string): Promise<BlockSnapshot> {
  const snapshots = await readBlockSnapshots(page);
  const found = snapshots.find((s) => s.id === id);
  if (!found) throw new Error(`Block ${id} not found in snapshots`);
  return found;
}

function focusedBlock(page: Page) {
  return page.locator(
    "article[data-layout-card='true'][class*='KeyboardFocused']",
  );
}

async function enterLayoutMode(page: Page) {
  await gotoSheetReady(page);
  await page.locator("[data-sheet-grid]").click({ position: { x: 5, y: 5 } });
  await page.keyboard.press("Control+m");
  await expect(page.getByTestId("layout-mode-pill")).toBeVisible();
  await expect(focusedBlock(page)).toHaveCount(1);
  await page.waitForTimeout(30);
}

async function switchSubMode(page: Page, key: "n" | "m" | "b", expected: "navigation" | "move" | "resize") {
  await page.keyboard.press(key);
  await expect(page.getByTestId("layout-mode-pill")).toHaveAttribute("data-mode", expected);
  await page.waitForTimeout(30);
}

async function focusBottomLeft(page: Page) {
  await enterLayoutMode(page);
  await page.keyboard.press("j");
  await expect(focusedBlock(page)).toHaveAttribute(
    "data-layout-block-id",
    "sheet-card-top-left",
  );
  await page.keyboard.press("j");
  await expect(focusedBlock(page)).toHaveAttribute(
    "data-layout-block-id",
    "sheet-card-bottom-left",
  );
}

/**
 * Stage `count` grow-south resize operations on the focused block.
 * Each press adds one row to `rowSpan` and one to `changesCount`.
 */
async function stageGrowSouth(page: Page, count: number) {
  await switchSubMode(page, "b", "resize");
  for (let i = 0; i < count; i++) {
    await page.keyboard.press("j");
  }
}

test.describe("Layout buffered mode — discard paths (Phase FA5b)", () => {
  test.beforeEach(async ({ page }) => {
    await clearLayoutStorage(page);
  });

  test("Esc with fewer than 5 changes discards silently", async ({ page }) => {
    await focusBottomLeft(page);
    const before = await findById(page, "sheet-card-bottom-left");

    // 4 grow-south ops: just under the threshold.
    await stageGrowSouth(page, 4);
    const buffered = await findById(page, "sheet-card-bottom-left");
    expect(buffered.rowSpan).toBe(before.rowSpan + 4);

    await page.keyboard.press("Escape");
    // No modal, layout mode exits immediately, persistent layout untouched.
    await expect(page.getByTestId("layout-discard-confirm-overlay")).toHaveCount(0);
    await expect(page.getByTestId("layout-mode-pill")).toHaveCount(0);

    const after = await findById(page, "sheet-card-bottom-left");
    expect(after.rowSpan).toBe(before.rowSpan);
    await expect(page.getByTestId("layout-reset-button")).toHaveCount(0);
  });

  test("Esc with 5+ changes opens the discard confirm modal", async ({ page }) => {
    await focusBottomLeft(page);

    await stageGrowSouth(page, 5);
    await page.keyboard.press("Escape");

    const overlay = page.getByTestId("layout-discard-confirm-overlay");
    await expect(overlay).toBeVisible();
    // Layout mode still active behind the modal.
    await expect(page.getByTestId("layout-mode-pill")).toBeVisible();
  });

  test("Modal Confirm (Enter) discards the buffer and exits layout mode", async ({ page }) => {
    await focusBottomLeft(page);
    const before = await findById(page, "sheet-card-bottom-left");

    await stageGrowSouth(page, 5);
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("layout-discard-confirm-overlay")).toBeVisible();

    await page.keyboard.press("Enter");
    await expect(page.getByTestId("layout-discard-confirm-overlay")).toHaveCount(0);
    await expect(page.getByTestId("layout-mode-pill")).toHaveCount(0);

    const after = await findById(page, "sheet-card-bottom-left");
    expect(after.rowSpan).toBe(before.rowSpan);
    await expect(page.getByTestId("layout-reset-button")).toHaveCount(0);
  });

  test("Modal Cancel (Esc) closes the modal and keeps the buffer intact", async ({ page }) => {
    await focusBottomLeft(page);
    const before = await findById(page, "sheet-card-bottom-left");

    await stageGrowSouth(page, 5);
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("layout-discard-confirm-overlay")).toBeVisible();

    // Esc inside the modal cancels the discard.
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("layout-discard-confirm-overlay")).toHaveCount(0);

    // We are back in layout mode with the buffered DOM still showing
    // the 5 grow-south ops.
    await expect(page.getByTestId("layout-mode-pill")).toBeVisible();
    const stillBuffered = await findById(page, "sheet-card-bottom-left");
    expect(stillBuffered.rowSpan).toBe(before.rowSpan + 5);
  });
});
