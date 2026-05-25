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

test.describe("Layout buffered mode — mouse click discard (Phase FA6)", () => {
  test.beforeEach(async ({ page }) => {
    await clearLayoutStorage(page);
  });

  test("Click on a card header with fewer than 5 changes discards silently", async ({ page }) => {
    await focusBottomLeft(page);
    const before = await findById(page, "sheet-card-bottom-left");

    await stageGrowSouth(page, 2);
    const buffered = await findById(page, "sheet-card-bottom-left");
    expect(buffered.rowSpan).toBe(before.rowSpan + 2);

    // Click on a card header (top-right is a safe target distant from
    // the focused bottom-left block).
    await page
      .locator("article[data-layout-block-id='sheet-card-top-right'] h2")
      .click();

    // No modal, layout mode exits, persistent layout untouched.
    await expect(page.getByTestId("layout-discard-confirm-overlay")).toHaveCount(0);
    await expect(page.getByTestId("layout-mode-pill")).toHaveCount(0);

    const after = await findById(page, "sheet-card-bottom-left");
    expect(after.rowSpan).toBe(before.rowSpan);
    await expect(page.getByTestId("layout-reset-button")).toHaveCount(0);
  });

  test("Click on a card header with 5+ changes opens the discard confirm modal", async ({ page }) => {
    await focusBottomLeft(page);
    await stageGrowSouth(page, 5);

    await page
      .locator("article[data-layout-block-id='sheet-card-top-right'] h2")
      .click();

    await expect(page.getByTestId("layout-discard-confirm-overlay")).toBeVisible();
    await expect(page.getByTestId("layout-mode-pill")).toBeVisible();
  });

  test("Click on the empty grid area triggers the same discard path", async ({ page }) => {
    await focusBottomLeft(page);
    const before = await findById(page, "sheet-card-bottom-left");

    await stageGrowSouth(page, 2);

    // The fixture has a 2-column layout (top-left/top-right,
    // bottom-left/bottom-right). The center vertical line of the grid
    // falls in the gap between the two columns — empty grid area, no
    // card underneath. Click there at mid-height.
    const grid = page.locator("[data-sheet-grid]");
    const box = await grid.boundingBox();
    if (!box) throw new Error("grid bounding box unavailable");
    await grid.click({ position: { x: box.width / 2, y: box.height / 2 } });

    await expect(page.getByTestId("layout-discard-confirm-overlay")).toHaveCount(0);
    await expect(page.getByTestId("layout-mode-pill")).toHaveCount(0);

    const after = await findById(page, "sheet-card-bottom-left");
    expect(after.rowSpan).toBe(before.rowSpan);
  });
});

test.describe("Layout buffered mode — pill counter (Phase FA7)", () => {
  test.beforeEach(async ({ page }) => {
    await clearLayoutStorage(page);
  });

  test("Pill counter is hidden when no changes are staged", async ({ page }) => {
    await enterLayoutMode(page);
    // Just entered: buffer is active but changesCount === 0.
    const pill = page.getByTestId("layout-mode-pill");
    await expect(pill).toBeVisible();
    await expect(pill).toHaveAttribute("data-changes-count", "0");
    await expect(page.getByTestId("layout-mode-pill-counter")).toHaveCount(0);
  });

  test("Pill counter shows '1 change' after a single buffered op", async ({ page }) => {
    await focusBottomLeft(page);
    await stageGrowSouth(page, 1);

    const pill = page.getByTestId("layout-mode-pill");
    await expect(pill).toHaveAttribute("data-changes-count", "1");
    const counter = page.getByTestId("layout-mode-pill-counter");
    await expect(counter).toBeVisible();
    await expect(counter).toContainText("1 change");
    await expect(counter).not.toContainText("changes");
  });

  test("Pill counter shows the plural form after several ops", async ({ page }) => {
    await focusBottomLeft(page);
    await stageGrowSouth(page, 3);

    const pill = page.getByTestId("layout-mode-pill");
    await expect(pill).toHaveAttribute("data-changes-count", "3");
    const counter = page.getByTestId("layout-mode-pill-counter");
    await expect(counter).toContainText("3 changes");
  });
});

test.describe("Layout mode — global shortcuts cascade through non-modal layout scope", () => {
  test.beforeEach(async ({ page }) => {
    await clearLayoutStorage(page);
  });

  test("`?` opens the help modal from layout mode without exiting it", async ({ page }) => {
    await enterLayoutMode(page);
    await page.keyboard.press("Shift+?");
    // Help modal mounts as a dialog; layout mode pill is still rendered.
    await expect(page.locator("[role='dialog']")).toBeVisible();
    await expect(page.getByTestId("layout-mode-pill")).toBeVisible();
  });

  test("Esc closes the help modal opened over layout mode and keeps the mode active", async ({ page }) => {
    await enterLayoutMode(page);
    await page.keyboard.press("Shift+?");
    await expect(page.locator("[role='dialog']")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator("[role='dialog']")).toBeHidden();
    await expect(page.getByTestId("layout-mode-pill")).toBeVisible();
  });

  test("Esc in the settings panel (opened by mouse during layout mode) closes settings, not layout", async ({ page }) => {
    await enterLayoutMode(page);
    await page.getByRole("button", { name: /settings/i }).click();
    await expect(page.getByTestId("settings-overlay")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("settings-overlay")).toBeHidden();
    await expect(page.getByTestId("layout-mode-pill")).toBeVisible();
  });
});

test.describe("Layout mode — keyboard reset (LAYOUT_RESET)", () => {
  test.beforeEach(async ({ page }) => {
    await clearLayoutStorage(page);
  });

  test("Shift+R rewinds the buffer to the initial snapshot and keeps layout mode active", async ({ page }) => {
    await focusBottomLeft(page);
    const initial = await findById(page, "sheet-card-bottom-left");
    await stageGrowSouth(page, 3);

    const grown = await findById(page, "sheet-card-bottom-left");
    expect(grown.rowSpan).toBeGreaterThan(initial.rowSpan);
    await expect(page.getByTestId("layout-mode-pill")).toHaveAttribute(
      "data-changes-count",
      "3",
    );

    await page.keyboard.press("Shift+R");

    const after = await findById(page, "sheet-card-bottom-left");
    expect(after.rowSpan).toBe(initial.rowSpan);
    await expect(page.getByTestId("layout-mode-pill")).toBeVisible();
    await expect(page.getByTestId("layout-mode-pill")).toHaveAttribute(
      "data-changes-count",
      "0",
    );
  });

  test("Shift+R on a clean buffer is a no-op (no error, no exit)", async ({ page }) => {
    await enterLayoutMode(page);
    await page.keyboard.press("Shift+R");
    await expect(page.getByTestId("layout-mode-pill")).toBeVisible();
    await expect(page.getByTestId("layout-mode-pill")).toHaveAttribute(
      "data-changes-count",
      "0",
    );
  });
});

test.describe("Layout mode — buffer reset floating button", () => {
  test.beforeEach(async ({ page }) => {
    await clearLayoutStorage(page);
  });

  test("Button is hidden on entry and appears after the first buffered edit", async ({ page }) => {
    await enterLayoutMode(page);
    await expect(page.getByTestId("layout-buffer-reset-button")).toHaveCount(0);

    await page.keyboard.press("j");
    await page.keyboard.press("j");
    await switchSubMode(page, "b", "resize");
    await page.keyboard.press("j");

    await expect(page.getByTestId("layout-buffer-reset-button")).toBeVisible();
  });

  test("Shift+R hides the button along with resetting the buffer", async ({ page }) => {
    await focusBottomLeft(page);
    await stageGrowSouth(page, 2);
    await expect(page.getByTestId("layout-buffer-reset-button")).toBeVisible();

    await page.keyboard.press("Shift+R");

    await expect(page.getByTestId("layout-buffer-reset-button")).toHaveCount(0);
    await expect(page.getByTestId("layout-mode-pill")).toHaveAttribute(
      "data-changes-count",
      "0",
    );
  });

  test("Clicking the button resets the buffer and keeps layout mode active", async ({ page }) => {
    await focusBottomLeft(page);
    const initial = await findById(page, "sheet-card-bottom-left");
    await stageGrowSouth(page, 2);

    await page.getByTestId("layout-buffer-reset-button").click();

    const after = await findById(page, "sheet-card-bottom-left");
    expect(after.rowSpan).toBe(initial.rowSpan);
    await expect(page.getByTestId("layout-mode-pill")).toBeVisible();
    await expect(page.getByTestId("layout-buffer-reset-button")).toHaveCount(0);
  });
});
