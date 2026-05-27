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

/**
 * Navigate the keyboard focus to a specific block id, regardless of where
 * pick-closest landed when entering layout mode. Uses the navigation
 * sub-mode (`n`) with h/j/k/l, comparing on-screen rects of the current
 * and target block to choose the next direction. Fails fast if the focus
 * cannot reach the target within a bounded number of steps.
 *
 * Caller is responsible for restoring any sub-mode after this returns —
 * the function leaves the page in navigation sub-mode.
 */
async function navigateToBlock(page: Page, targetId: string) {
  await page.keyboard.press("n");
  await expect(page.getByTestId("layout-mode-pill")).toHaveAttribute("data-mode", "navigation");

  const rectOf = async (id: string) =>
    page
      .locator(`article[data-layout-card='true'][data-layout-block-id='${id}']`)
      .evaluate((el) => {
        const r = (el as HTMLElement).getBoundingClientRect();
        return { x: r.x, y: r.y, w: r.width, h: r.height };
      });

  const currentId = async () =>
    focusedBlock(page).getAttribute("data-layout-block-id");

  for (let step = 0; step < 16; step++) {
    const id = await currentId();
    if (id === targetId) return;

    const here = await rectOf(id ?? "");
    const there = await rectOf(targetId);
    const dx = there.x + there.w / 2 - (here.x + here.w / 2);
    const dy = there.y + there.h / 2 - (here.y + here.h / 2);

    const tryKeys: string[] = [];
    if (Math.abs(dy) > 4) tryKeys.push(dy > 0 ? "j" : "k");
    if (Math.abs(dx) > 4) tryKeys.push(dx > 0 ? "l" : "h");
    if (tryKeys.length === 0) {
      throw new Error(`navigateToBlock: stuck at ${id} (no axis delta) cannot reach ${targetId}`);
    }

    let moved = false;
    for (const key of tryKeys) {
      await page.keyboard.press(key);
      await page.waitForTimeout(30);
      const after = await currentId();
      if (after !== id) {
        moved = true;
        break;
      }
    }
    if (!moved) {
      throw new Error(`navigateToBlock: stuck at ${id}, cannot reach ${targetId}`);
    }
  }
  throw new Error(`navigateToBlock: did not reach ${targetId} within step budget`);
}

async function switchSubMode(page: Page, key: "n" | "m" | "b", expected: "navigation" | "move" | "resize") {
  await page.keyboard.press(key);
  await expect(page.getByTestId("layout-mode-pill")).toHaveAttribute("data-mode", expected);
  await page.waitForTimeout(30);
}

async function focusBottomLeft(page: Page) {
  await enterLayoutMode(page);
  await navigateToBlock(page, "bottom-left");
  await expect(focusedBlock(page)).toHaveAttribute(
    "data-layout-block-id",
    "bottom-left",
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
    const before = await findById(page, "bottom-left");

    // 4 grow-south ops: just under the threshold.
    await stageGrowSouth(page, 4);
    const buffered = await findById(page, "bottom-left");
    expect(buffered.rowSpan).toBe(before.rowSpan + 4);

    await page.keyboard.press("Escape");
    // No modal, layout mode exits immediately, persistent layout untouched.
    await expect(page.getByTestId("layout-discard-confirm-overlay")).toHaveCount(0);
    await expect(page.getByTestId("layout-mode-pill")).toHaveCount(0);

    const after = await findById(page, "bottom-left");
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
    const before = await findById(page, "bottom-left");

    await stageGrowSouth(page, 5);
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("layout-discard-confirm-overlay")).toBeVisible();

    await page.keyboard.press("Enter");
    await expect(page.getByTestId("layout-discard-confirm-overlay")).toHaveCount(0);
    await expect(page.getByTestId("layout-mode-pill")).toHaveCount(0);

    const after = await findById(page, "bottom-left");
    expect(after.rowSpan).toBe(before.rowSpan);
    await expect(page.getByTestId("layout-reset-button")).toHaveCount(0);
  });

  test("Modal Cancel (Esc) closes the modal and keeps the buffer intact", async ({ page }) => {
    await focusBottomLeft(page);
    const before = await findById(page, "bottom-left");

    await stageGrowSouth(page, 5);
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("layout-discard-confirm-overlay")).toBeVisible();

    // Esc inside the modal cancels the discard.
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("layout-discard-confirm-overlay")).toHaveCount(0);

    // We are back in layout mode with the buffered DOM still showing
    // the 5 grow-south ops.
    await expect(page.getByTestId("layout-mode-pill")).toBeVisible();
    const stillBuffered = await findById(page, "bottom-left");
    expect(stillBuffered.rowSpan).toBe(before.rowSpan + 5);
  });
});

test.describe("Layout buffered mode — mouse click discard (Phase FA6)", () => {
  test.beforeEach(async ({ page }) => {
    await clearLayoutStorage(page);
  });

  test("Click on a card header with fewer than 5 changes discards silently", async ({ page }) => {
    await focusBottomLeft(page);
    const before = await findById(page, "bottom-left");

    await stageGrowSouth(page, 2);
    const buffered = await findById(page, "bottom-left");
    expect(buffered.rowSpan).toBe(before.rowSpan + 2);

    // Click on a card header (top-right is a safe target distant from
    // the focused bottom-left block).
    await page
      .locator("article[data-layout-block-id='top-right'] h2")
      .click();

    // No modal, layout mode exits, persistent layout untouched.
    await expect(page.getByTestId("layout-discard-confirm-overlay")).toHaveCount(0);
    await expect(page.getByTestId("layout-mode-pill")).toHaveCount(0);

    const after = await findById(page, "bottom-left");
    expect(after.rowSpan).toBe(before.rowSpan);
    await expect(page.getByTestId("layout-reset-button")).toHaveCount(0);
  });

  test("Click on a card header with 5+ changes opens the discard confirm modal", async ({ page }) => {
    await focusBottomLeft(page);
    await stageGrowSouth(page, 5);

    await page
      .locator("article[data-layout-block-id='top-right'] h2")
      .click();

    await expect(page.getByTestId("layout-discard-confirm-overlay")).toBeVisible();
    await expect(page.getByTestId("layout-mode-pill")).toBeVisible();
  });

  test("Click on the empty grid area triggers the same discard path", async ({ page }) => {
    await focusBottomLeft(page);
    const before = await findById(page, "bottom-left");

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

    const after = await findById(page, "bottom-left");
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
    const initial = await findById(page, "bottom-left");
    await stageGrowSouth(page, 3);

    const grown = await findById(page, "bottom-left");
    expect(grown.rowSpan).toBeGreaterThan(initial.rowSpan);
    await expect(page.getByTestId("layout-mode-pill")).toHaveAttribute(
      "data-changes-count",
      "3",
    );

    await page.keyboard.press("Shift+R");

    const after = await findById(page, "bottom-left");
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

  test("Button is disabled on entry and becomes enabled after the first buffered edit", async ({ page }) => {
    await enterLayoutMode(page);
    // On entry the buffer is empty, so the reset button is disabled. The
    // wider action group itself may still be hidden because the
    // freshly-initialised history has no undo / redo entries either.
    const resetOnEntry = page.getByTestId("layout-reset-button");
    if ((await resetOnEntry.count()) > 0) {
      await expect(resetOnEntry).toBeDisabled();
    }

    await page.keyboard.press("j");
    await page.keyboard.press("j");
    await switchSubMode(page, "b", "resize");
    await page.keyboard.press("j");

    const resetAfterEdit = page.getByTestId("layout-reset-button");
    await expect(resetAfterEdit).toBeVisible();
    await expect(resetAfterEdit).toBeEnabled();
  });

  test("Shift+R disables the reset button (buffer cleared) but leaves undo available", async ({ page }) => {
    await focusBottomLeft(page);
    await stageGrowSouth(page, 2);
    const resetButton = page.getByTestId("layout-reset-button");
    await expect(resetButton).toBeEnabled();

    await page.keyboard.press("Shift+R");

    // The buffer is empty again so the reset action is no longer
    // applicable, but the reset of the buffer is itself recorded in
    // history (LAYOUT_RESET pushes the initial snapshot as a keyboard
    // entry), so the action group stays visible and undo is available.
    await expect(resetButton).toBeDisabled();
    await expect(page.getByTestId("layout-undo-button")).toBeEnabled();
    await expect(page.getByTestId("layout-mode-pill")).toHaveAttribute(
      "data-changes-count",
      "0",
    );
  });

  test("Clicking the button resets the buffer and keeps layout mode active", async ({ page }) => {
    await focusBottomLeft(page);
    const initial = await findById(page, "bottom-left");
    await stageGrowSouth(page, 2);

    await page.getByTestId("layout-reset-button").click();

    const after = await findById(page, "bottom-left");
    expect(after.rowSpan).toBe(initial.rowSpan);
    await expect(page.getByTestId("layout-mode-pill")).toBeVisible();
    // The reset itself is recorded in history (so it can be undone). The
    // reset button is therefore still mounted but disabled now that the
    // buffer is empty again.
    await expect(page.getByTestId("layout-reset-button")).toBeDisabled();
    await expect(page.getByTestId("layout-undo-button")).toBeEnabled();
  });
});

test.describe("Layout mode — commit path (LAYOUT_COMMIT)", () => {
  test.beforeEach(async ({ page }) => {
    await clearLayoutStorage(page);
  });

  test("Enter persists the buffered changes and exits layout mode", async ({ page }) => {
    await focusBottomLeft(page);
    const initial = await findById(page, "bottom-left");
    await stageGrowSouth(page, 2);
    const staged = await findById(page, "bottom-left");
    expect(staged.rowSpan).toBe(initial.rowSpan + 2);

    await page.keyboard.press("Enter");

    await expect(page.getByTestId("layout-mode-pill")).toHaveCount(0);
    // Persistence is confirmed by the regular reset button surfacing.
    await expect(page.getByTestId("layout-reset-button")).toBeVisible();
    const persisted = await findById(page, "bottom-left");
    expect(persisted.rowSpan).toBe(staged.rowSpan);
  });

  test("Enter on a clean buffer exits layout mode without persisting anything", async ({ page }) => {
    await enterLayoutMode(page);
    await page.keyboard.press("Enter");

    await expect(page.getByTestId("layout-mode-pill")).toHaveCount(0);
    // No edits → no undo / redo, no divergence from baseline → action
    // group is fully hidden.
    await expect(page.getByTestId("layout-reset-button")).toHaveCount(0);
  });
});
