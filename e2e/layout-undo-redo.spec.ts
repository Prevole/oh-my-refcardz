import { test, expect, type Page } from "@playwright/test";

/**
 * Phase H6 — Undo / Redo E2E.
 *
 * Exercises the full Phase H undo/redo wiring through real keyboard,
 * mouse and DOM:
 *  - Mouse mode (sheet scope): `u` / `z` bindings on a drag commit.
 *  - Keyboard buffered mode (layout scope): per-keystroke granularity,
 *    Shift+R undo-ability, `u` / `z` while the buffer is live.
 *  - Session boundaries (H4.4): a silent Esc discard truncates the
 *    in-session history; Enter commits and the in-session entries are
 *    relabeled as persisted (cross-mode undo writes back via
 *    commitLayout, i.e. persists immediately).
 *  - Action group UI (H5): the three buttons reflect availability via
 *    the disabled state and trigger the same actions as the shortcuts.
 *
 * The fixture is `layout-e2e`, the same one keyboard-layout and
 * layout-buffered-mode rely on (a 4-block grid with ~60 free engine
 * rows south of `bottom-left` so chained grow-south ops are
 * deterministic). All helpers are inlined to follow the project's
 * existing E2E convention (no shared helpers directory).
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

async function navigateToBlock(page: Page, targetId: string) {
  await page.keyboard.press("n");
  await expect(page.getByTestId("layout-mode-pill")).toHaveAttribute(
    "data-mode",
    "navigation",
  );

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
      throw new Error(
        `navigateToBlock: stuck at ${id} (no axis delta) cannot reach ${targetId}`,
      );
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
      throw new Error(
        `navigateToBlock: stuck at ${id}, cannot reach ${targetId}`,
      );
    }
  }
  throw new Error(
    `navigateToBlock: did not reach ${targetId} within step budget`,
  );
}

async function switchSubMode(
  page: Page,
  key: "n" | "m" | "b",
  expected: "navigation" | "move" | "resize",
) {
  await page.keyboard.press(key);
  await expect(page.getByTestId("layout-mode-pill")).toHaveAttribute(
    "data-mode",
    expected,
  );
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

async function stageGrowSouth(page: Page, count: number) {
  await switchSubMode(page, "b", "resize");
  for (let i = 0; i < count; i++) {
    await page.keyboard.press("j");
  }
}

/**
 * Drag the `bottom-left` block by an arbitrary pixel offset. The drop
 * target is chosen so it definitely lands on free engine cells of the
 * `layout-e2e` fixture; the exact resulting grid coordinates do not
 * matter for undo/redo tests (we compare before/after snapshots).
 *
 * Returns the snapshot AFTER the drag so callers can assert that undo
 * reverts to the pre-drag state.
 */
async function dragBottomLeftSouth(page: Page): Promise<BlockSnapshot> {
  const before = await findById(page, "bottom-left");

  const header = page
    .locator("article[data-layout-block-id='bottom-left'] h2")
    .first();
  const box = await header.boundingBox();
  if (!box) throw new Error("bottom-left header has no bounding box");

  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  // Move down by ~3 rows worth of pixels. The exact target is irrelevant;
  // we only need the drop to land somewhere different from the origin.
  await page.mouse.move(
    box.x + box.width / 2,
    box.y + box.height / 2 + 240,
    { steps: 12 },
  );
  await page.mouse.up();

  // Settle.
  await page.waitForTimeout(50);
  const after = await findById(page, "bottom-left");
  expect(after.rowStart).not.toBe(before.rowStart);
  return after;
}

async function focusSheet(page: Page) {
  // Click on the sheet grid background so undo/redo bindings on the
  // `sheet` scope receive the keystroke (the floating action group
  // would otherwise steal focus through its buttons).
  await page
    .locator("[data-sheet-grid]")
    .click({ position: { x: 5, y: 5 } });
}

// -----------------------------------------------------------------------------
// 1. Mouse mode — sheet scope
// -----------------------------------------------------------------------------

test.describe("Undo/Redo — mouse mode (sheet scope)", () => {
  test.beforeEach(async ({ page }) => {
    await clearLayoutStorage(page);
  });

  test("`u` after a drag reverts to the pre-drag layout", async ({ page }) => {
    await gotoSheetReady(page);
    const before = await findById(page, "bottom-left");
    const after = await dragBottomLeftSouth(page);
    expect(after.rowStart).not.toBe(before.rowStart);

    await focusSheet(page);
    await page.keyboard.press("u");

    const undone = await findById(page, "bottom-left");
    expect(undone.rowStart).toBe(before.rowStart);
    expect(undone.colStart).toBe(before.colStart);
  });

  test("`u` then `z` reapplies the drag", async ({ page }) => {
    await gotoSheetReady(page);
    const before = await findById(page, "bottom-left");
    const after = await dragBottomLeftSouth(page);

    await focusSheet(page);
    await page.keyboard.press("u");
    const undone = await findById(page, "bottom-left");
    expect(undone.rowStart).toBe(before.rowStart);

    await page.keyboard.press("z");
    const redone = await findById(page, "bottom-left");
    expect(redone.rowStart).toBe(after.rowStart);
    expect(redone.colStart).toBe(after.colStart);
  });

  test("a new drag after undo drops the redo branch", async ({ page }) => {
    await gotoSheetReady(page);
    const before = await findById(page, "bottom-left");
    await dragBottomLeftSouth(page);

    await focusSheet(page);
    await page.keyboard.press("u");
    // Redo is available now.
    await expect(page.getByTestId("layout-redo-button")).toBeEnabled();

    // A fresh drag must drop that redo branch.
    await dragBottomLeftSouth(page);
    await expect(page.getByTestId("layout-redo-button")).toBeDisabled();

    // And undo still walks back through the new branch.
    await focusSheet(page);
    await page.keyboard.press("u");
    const undone = await findById(page, "bottom-left");
    expect(undone.rowStart).toBe(before.rowStart);
  });

  test("clicking the action group buttons triggers the same undo/redo", async ({ page }) => {
    await gotoSheetReady(page);
    const before = await findById(page, "bottom-left");
    const after = await dragBottomLeftSouth(page);

    await page.getByTestId("layout-undo-button").click();
    const undone = await findById(page, "bottom-left");
    expect(undone.rowStart).toBe(before.rowStart);

    await page.getByTestId("layout-redo-button").click();
    const redone = await findById(page, "bottom-left");
    expect(redone.rowStart).toBe(after.rowStart);
  });
});

// -----------------------------------------------------------------------------
// 2. Keyboard buffered mode — layout scope
// -----------------------------------------------------------------------------

test.describe("Undo/Redo — keyboard buffered mode (layout scope)", () => {
  test.beforeEach(async ({ page }) => {
    await clearLayoutStorage(page);
  });

  test("`u` inside a buffered session undoes a single keystroke", async ({ page }) => {
    await focusBottomLeft(page);
    const before = await findById(page, "bottom-left");
    await stageGrowSouth(page, 3);
    const staged = await findById(page, "bottom-left");
    expect(staged.rowSpan).toBe(before.rowSpan + 3);

    // Undo one keystroke at a time.
    await page.keyboard.press("u");
    const afterOne = await findById(page, "bottom-left");
    expect(afterOne.rowSpan).toBe(before.rowSpan + 2);

    await page.keyboard.press("u");
    const afterTwo = await findById(page, "bottom-left");
    expect(afterTwo.rowSpan).toBe(before.rowSpan + 1);

    // changesCount stays in sync with the visible buffer.
    await expect(page.getByTestId("layout-mode-pill")).toHaveAttribute(
      "data-changes-count",
      "1",
    );
  });

  test("`z` inside a buffered session redoes the last undo", async ({ page }) => {
    await focusBottomLeft(page);
    const before = await findById(page, "bottom-left");
    await stageGrowSouth(page, 2);

    await page.keyboard.press("u");
    const undone = await findById(page, "bottom-left");
    expect(undone.rowSpan).toBe(before.rowSpan + 1);

    await page.keyboard.press("z");
    const redone = await findById(page, "bottom-left");
    expect(redone.rowSpan).toBe(before.rowSpan + 2);
  });

  test("`u` reverts a Shift+R buffer reset back to the pre-reset state", async ({ page }) => {
    await focusBottomLeft(page);
    const before = await findById(page, "bottom-left");
    await stageGrowSouth(page, 2);
    const staged = await findById(page, "bottom-left");
    expect(staged.rowSpan).toBe(before.rowSpan + 2);

    await page.keyboard.press("Shift+R");
    await expect(page.getByTestId("layout-mode-pill")).toHaveAttribute(
      "data-changes-count",
      "0",
    );
    const reset = await findById(page, "bottom-left");
    expect(reset.rowSpan).toBe(before.rowSpan);

    // The reset itself is undoable.
    await page.keyboard.press("u");
    const restored = await findById(page, "bottom-left");
    expect(restored.rowSpan).toBe(staged.rowSpan);
  });
});

// -----------------------------------------------------------------------------
// 3. Session boundaries (H4.4)
// -----------------------------------------------------------------------------

test.describe("Undo/Redo — session boundaries", () => {
  test.beforeEach(async ({ page }) => {
    await clearLayoutStorage(page);
  });

  test("silent Esc discard drops in-session entries from the global history", async ({ page }) => {
    await focusBottomLeft(page);
    const before = await findById(page, "bottom-left");
    await stageGrowSouth(page, 2);

    // Esc silently discards (changes < 5).
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("layout-mode-pill")).toHaveCount(0);
    const exited = await findById(page, "bottom-left");
    expect(exited.rowSpan).toBe(before.rowSpan);

    // The action group is fully hidden: nothing was committed and the
    // in-session history was truncated, so undo / redo / reset are all
    // unavailable.
    await expect(page.getByTestId("layout-reset-button")).toHaveCount(0);
    await expect(page.getByTestId("layout-undo-button")).toHaveCount(0);
  });

  test("Enter commit relabels in-session entries; post-commit `u` persists immediately", async ({ page }) => {
    await focusBottomLeft(page);
    const before = await findById(page, "bottom-left");
    await stageGrowSouth(page, 2);
    const staged = await findById(page, "bottom-left");
    expect(staged.rowSpan).toBe(before.rowSpan + 2);

    await page.keyboard.press("Enter");
    await expect(page.getByTestId("layout-mode-pill")).toHaveCount(0);

    // Committed: the action group surfaces with reset enabled (diverged
    // from baseline) and undo also available (relabeled entries).
    await expect(page.getByTestId("layout-reset-button")).toBeEnabled();
    await expect(page.getByTestId("layout-undo-button")).toBeEnabled();

    // Two undos walk back through the relabeled keyboard entries; each
    // write-back persists via commitLayout (mouse source semantics).
    await focusSheet(page);
    await page.keyboard.press("u");
    const afterOne = await findById(page, "bottom-left");
    expect(afterOne.rowSpan).toBe(before.rowSpan + 1);

    await page.keyboard.press("u");
    const afterTwo = await findById(page, "bottom-left");
    expect(afterTwo.rowSpan).toBe(before.rowSpan);

    // Layout fully reverted, so reset is now disabled again.
    await expect(page.getByTestId("layout-reset-button")).toBeDisabled();

    // And the localStorage has been updated (persistence is immediate
    // on cross-mode undo of mouse-sourced — including relabeled —
    // entries). Storage value should reflect the reverted layout, which
    // matches the original, so the key may be removed entirely.
    const stored = await page.evaluate(() =>
      window.localStorage.getItem(`sheet-layout:${"layout-e2e"}`),
    );
    // Either null (cleared because back to original) or a JSON string
    // whose blocks match the original. Both are acceptable outcomes.
    if (stored !== null) {
      expect(stored).toContain("bottom-left");
    }
  });

  test("modal-confirmed discard (5+ changes) drops in-session entries from history", async ({ page }) => {
    await focusBottomLeft(page);
    const before = await findById(page, "bottom-left");
    await stageGrowSouth(page, 5);
    await page.keyboard.press("Escape");

    await expect(
      page.getByTestId("layout-discard-confirm-overlay"),
    ).toBeVisible();
    // Modal confirm via Enter.
    await page.keyboard.press("Enter");

    await expect(page.getByTestId("layout-mode-pill")).toHaveCount(0);
    const exited = await findById(page, "bottom-left");
    expect(exited.rowSpan).toBe(before.rowSpan);

    // History is empty post-discard, action group hidden.
    await expect(page.getByTestId("layout-undo-button")).toHaveCount(0);
  });
});

// -----------------------------------------------------------------------------
// 4. Cross-mode interactions
// -----------------------------------------------------------------------------

test.describe("Undo/Redo — cross-mode", () => {
  test.beforeEach(async ({ page }) => {
    await clearLayoutStorage(page);
  });

  test("mouse drag + buffered keyboard edits: undo walks through both", async ({ page }) => {
    await gotoSheetReady(page);
    const original = await findById(page, "bottom-left");

    // 1. Mouse drag (committed immediately).
    const draggedTo = await dragBottomLeftSouth(page);
    expect(draggedTo.rowStart).not.toBe(original.rowStart);

    // 2. Enter layout mode, focus bottom-left, grow by 2 (buffered).
    await page.locator("[data-sheet-grid]").click({ position: { x: 5, y: 5 } });
    await page.keyboard.press("Control+m");
    await expect(page.getByTestId("layout-mode-pill")).toBeVisible();
    await navigateToBlock(page, "bottom-left");
    await stageGrowSouth(page, 2);
    const buffered = await findById(page, "bottom-left");
    expect(buffered.rowSpan).toBe(draggedTo.rowSpan + 2);

    // 3. Commit the session.
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("layout-mode-pill")).toHaveCount(0);

    // 4. Now `u` × 3 walks back: keyboard step, keyboard step, mouse drag.
    await focusSheet(page);
    await page.keyboard.press("u");
    let snap = await findById(page, "bottom-left");
    expect(snap.rowSpan).toBe(draggedTo.rowSpan + 1);

    await page.keyboard.press("u");
    snap = await findById(page, "bottom-left");
    expect(snap.rowSpan).toBe(draggedTo.rowSpan);
    // Still at the post-drag row start (drag entry not yet undone).
    expect(snap.rowStart).toBe(draggedTo.rowStart);

    await page.keyboard.press("u");
    snap = await findById(page, "bottom-left");
    // Drag undone: position back to original.
    expect(snap.rowStart).toBe(original.rowStart);
    expect(snap.colStart).toBe(original.colStart);
    expect(snap.rowSpan).toBe(original.rowSpan);
  });
});
