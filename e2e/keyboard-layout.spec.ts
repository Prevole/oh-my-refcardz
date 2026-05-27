import { test, expect, type Page } from "@playwright/test";

/**
 * Phase E3 E2E for the Zellij-style modal keyboard layout mode.
 *
 * These tests run against the dedicated `layout-e2e` fixture in
 * `content_test/cheatsheets/00-layout/`, served by Playwright's webServer
 * which sets `OH_MY_REFCARDZ_CONTENT_ROOT=content_test/cheatsheets`.
 *
 * The fixture layout (engine 0-indexed; CSS grid lines are 1-indexed,
 * so observed `rowStart` values in the DOM are engine_row + 1):
 *
 *   engine row 0-1   (CSS 1-2)   : section heading        (col 0-35, h=2)
 *   engine row 2-7   (CSS 3-8)   : top-left  (col 0-17)  / top-right  (col 18-35)
 *   engine row 8-13  (CSS 9-14)  : bottom-left (col 0-17) / bottom-right (col 18-35)
 *
 * With ~60 free engine rows south of the bottom row, push-south moves
 * and grow-south resizes always succeed without engine flakiness from
 * tightly-packed neighbours.
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

/** Locator for the article currently flagged as keyboard-focused. */
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
  await expect(page.getByTestId("layout-mode-pill")).toHaveAttribute("data-mode", "navigation");
  await expect(focusedBlock(page)).toHaveCount(1);
  // Same scope-commit race as switchSubMode: yield one tick so the
  // `layout-navigation` scope is registered before the next keypress.
  await page.waitForTimeout(30);
}

/**
 * Navigate the keyboard focus to a specific block id, regardless of where
 * pick-closest landed when entering layout mode. Uses the navigation
 * sub-mode (`n`) with h/j/k/l, choosing the next direction based on the
 * sign of the rect-delta to the target. Tries the vertical axis first
 * when dy is non-zero, then falls back to horizontal (and vice versa).
 * This avoids oscillations when one axis is dominant in magnitude but
 * the other still needs to be travelled. Leaves the page in navigation
 * sub-mode.
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

/**
 * Switch sub-mode (n/m/r) and wait until the scope is genuinely active.
 *
 * The pill's `data-mode` attribute reflects React state, which updates
 * synchronously, but the underlying keyboard scope dispatcher only
 * picks up the new context on the next render frame. Pressing the
 * next key too quickly causes it to be handled by the previous scope.
 * A small synchronous yield after the pill flip lets React commit
 * and the scope context to switch before the next press.
 */
async function switchSubMode(page: Page, key: "n" | "m" | "b", expected: "navigation" | "move" | "resize") {
  await page.keyboard.press(key);
  await expect(page.getByTestId("layout-mode-pill")).toHaveAttribute("data-mode", expected);
  // Yield one event loop tick to let React commit the scope change.
  // Without this, the next keypress can race the scope context update.
  await page.waitForTimeout(30);
}

/**
 * Enter layout mode and focus the `bottom-left` card. This block lives
 * at row 8-13 with ~60 rows of free space south, so push-south and
 * grow-south operations are deterministic.
 */
async function focusBottomLeft(page: Page) {
  await enterLayoutMode(page);
  await navigateToBlock(page, "bottom-left");
  await expect(focusedBlock(page)).toHaveAttribute(
    "data-layout-block-id",
    "bottom-left",
  );
}

test.describe("Keyboard layout mode — entry, exit, sub-modes (Phase E3)", () => {
  test.beforeEach(async ({ page }) => {
    await clearLayoutStorage(page);
  });

  test("Ctrl+M enters layout mode in navigation sub-mode with a focused block", async ({ page }) => {
    await enterLayoutMode(page);
  });

  test("the mode pill cycles through n / m / b and back", async ({ page }) => {
    await enterLayoutMode(page);
    const pill = page.getByTestId("layout-mode-pill");

    await page.keyboard.press("m");
    await expect(pill).toHaveAttribute("data-mode", "move");

    await page.keyboard.press("b");
    await expect(pill).toHaveAttribute("data-mode", "resize");

    await page.keyboard.press("n");
    await expect(pill).toHaveAttribute("data-mode", "navigation");
  });

  test("pressing the active switcher key is a no-op", async ({ page }) => {
    await enterLayoutMode(page);
    const pill = page.getByTestId("layout-mode-pill");
    await page.keyboard.press("n");
    await expect(pill).toHaveAttribute("data-mode", "navigation");
    await page.keyboard.press("m");
    await expect(pill).toHaveAttribute("data-mode", "move");
    await page.keyboard.press("m");
    await expect(pill).toHaveAttribute("data-mode", "move");
  });

  test("Escape exits layout mode from the navigation sub-mode", async ({ page }) => {
    await enterLayoutMode(page);
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("layout-mode-pill")).toHaveCount(0);
    await expect(focusedBlock(page)).toHaveCount(0);
  });

  test("Escape exits layout mode from the move sub-mode", async ({ page }) => {
    await enterLayoutMode(page);
    await switchSubMode(page, "m", "move");
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("layout-mode-pill")).toHaveCount(0);
  });

  test("Escape exits layout mode from the resize sub-mode", async ({ page }) => {
    await enterLayoutMode(page);
    await switchSubMode(page, "b", "resize");
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("layout-mode-pill")).toHaveCount(0);
  });
});

test.describe("Keyboard layout mode — navigation sub-mode (Phase E3)", () => {
  test.beforeEach(async ({ page }) => {
    await clearLayoutStorage(page);
  });

  test("h/j/k/l move focus to the corresponding neighbour", async ({ page }) => {
    await enterLayoutMode(page);
    // Anchor the starting focus deterministically. Without this, pick-
    // closest could land on any block depending on cursor position.
    await navigateToBlock(page, "section");
    expect(await focusedBlock(page).getAttribute("data-layout-block-id"))
      .toBe("section");

    await page.keyboard.press("j");
    expect(await focusedBlock(page).getAttribute("data-layout-block-id"))
      .toBe("top-left");

    await page.keyboard.press("l");
    expect(await focusedBlock(page).getAttribute("data-layout-block-id"))
      .toBe("top-right");

    await page.keyboard.press("j");
    expect(await focusedBlock(page).getAttribute("data-layout-block-id"))
      .toBe("bottom-right");

    await page.keyboard.press("h");
    expect(await focusedBlock(page).getAttribute("data-layout-block-id"))
      .toBe("bottom-left");

    await page.keyboard.press("k");
    expect(await focusedBlock(page).getAttribute("data-layout-block-id"))
      .toBe("top-left");
  });

  test("arrow keys are equivalent to h/j/k/l", async ({ page }) => {
    await enterLayoutMode(page);
    await navigateToBlock(page, "section");
    await page.keyboard.press("ArrowDown");
    expect(await focusedBlock(page).getAttribute("data-layout-block-id"))
      .toBe("top-left");
    await page.keyboard.press("ArrowRight");
    expect(await focusedBlock(page).getAttribute("data-layout-block-id"))
      .toBe("top-right");
  });

  test("navigation against a wall is a no-op", async ({ page }) => {
    await enterLayoutMode(page);
    await navigateToBlock(page, "section");
    // Heading is already at the top (row 0).
    await page.keyboard.press("k");
    expect(await focusedBlock(page).getAttribute("data-layout-block-id"))
      .toBe("section");
    // West wall from heading (col 0).
    await page.keyboard.press("h");
    expect(await focusedBlock(page).getAttribute("data-layout-block-id"))
      .toBe("section");
  });

  test("switching to move/resize keeps the focused block", async ({ page }) => {
    await focusBottomLeft(page);

    await switchSubMode(page, "m", "move");
    expect(await focusedBlock(page).getAttribute("data-layout-block-id"))
      .toBe("bottom-left");

    await switchSubMode(page, "b", "resize");
    expect(await focusedBlock(page).getAttribute("data-layout-block-id"))
      .toBe("bottom-left");

    await switchSubMode(page, "n", "navigation");
    expect(await focusedBlock(page).getAttribute("data-layout-block-id"))
      .toBe("bottom-left");
  });
});

test.describe("Keyboard layout mode — move sub-mode (Phase E3)", () => {
  test.beforeEach(async ({ page }) => {
    await clearLayoutStorage(page);
  });

  test("j translates the focused block south by 1 cell", async ({ page }) => {
    await focusBottomLeft(page);
    await switchSubMode(page, "m", "move");

    const before = await findById(page, "bottom-left");
    expect(before.rowStart).toBe(9);

    await page.keyboard.press("j");
    const after = await findById(page, "bottom-left");
    expect(after.rowStart).toBe(10);
    expect(after.rowSpan).toBe(before.rowSpan);
    expect(after.colStart).toBe(before.colStart);
  });

  test("ArrowDown is equivalent to j", async ({ page }) => {
    await focusBottomLeft(page);
    await switchSubMode(page, "m", "move");

    const before = await findById(page, "bottom-left");
    await page.keyboard.press("ArrowDown");
    const after = await findById(page, "bottom-left");
    expect(after.rowStart).toBe(before.rowStart + 1);
  });

  test("Alt+k is strict: refuses to move into a fixed heading", async ({ page }) => {
    // Focus top-left (row 2-7), directly below the fixed heading at row
    // 0-1. Strict-north must refuse because the heading has
    // minRowSpan=maxRowSpan=2 (cannot shrink) and wrap is forbidden.
    await enterLayoutMode(page);
    await navigateToBlock(page, "top-left");
    await expect(focusedBlock(page)).toHaveAttribute(
      "data-layout-block-id",
      "top-left",
    );

    const before = await findById(page, "top-left");
    expect(before.rowStart).toBe(3);

    await switchSubMode(page, "m", "move");
    await page.keyboard.press("Alt+k");
    const after = await findById(page, "top-left");
    expect(after.rowStart).toBe(before.rowStart);
    expect(after.rowSpan).toBe(before.rowSpan);
  });
});

test.describe("Keyboard layout mode — resize sub-mode (Phase E3)", () => {
  test.beforeEach(async ({ page }) => {
    await clearLayoutStorage(page);
  });

  test("j grows the south edge by 1 row", async ({ page }) => {
    await focusBottomLeft(page);
    await switchSubMode(page, "b", "resize");

    const before = await findById(page, "bottom-left");
    expect(before.rowSpan).toBe(6);

    await page.keyboard.press("j");
    const after = await findById(page, "bottom-left");
    expect(after.rowSpan).toBe(before.rowSpan + 1);
    expect(after.rowStart).toBe(before.rowStart);
  });

  test("Shift+J shrinks downward (pulls the north edge down) by 1 row", async ({ page }) => {
    await focusBottomLeft(page);
    await switchSubMode(page, "b", "resize");

    // Grow south first so we have room to shrink.
    await page.keyboard.press("j");
    await page.keyboard.press("j");
    const grown = await findById(page, "bottom-left");
    expect(grown.rowSpan).toBe(8);

    await page.keyboard.press("Shift+J");
    const shrunk = await findById(page, "bottom-left");
    expect(shrunk.rowSpan).toBe(grown.rowSpan - 1);
  });

  test("Alt+k strict-grow-north is refused against a fixed heading", async ({ page }) => {
    await enterLayoutMode(page);
    await navigateToBlock(page, "top-left");
    await expect(focusedBlock(page)).toHaveAttribute(
      "data-layout-block-id",
      "top-left",
    );

    const before = await findById(page, "top-left");
    await switchSubMode(page, "b", "resize");
    await page.keyboard.press("Alt+k");
    const after = await findById(page, "top-left");
    expect(after.rowSpan).toBe(before.rowSpan);
    expect(after.rowStart).toBe(before.rowStart);
  });

  test("Ctrl+Shift+J is compact shrink downward (pulls the north edge in)", async ({ page }) => {
    await focusBottomLeft(page);
    await switchSubMode(page, "b", "resize");

    // Grow south by 3 to create room.
    await page.keyboard.press("j");
    await page.keyboard.press("j");
    await page.keyboard.press("j");
    const grown = await findById(page, "bottom-left");
    expect(grown.rowSpan).toBe(9);

    await page.keyboard.press("Control+Shift+J");
    const shrunk = await findById(page, "bottom-left");
    expect(shrunk.rowSpan).toBeLessThan(grown.rowSpan);
  });
});

test.describe("Keyboard layout mode — visual integration (Phase E3)", () => {
  test.beforeEach(async ({ page }) => {
    await clearLayoutStorage(page);
  });

  test("the focused block has the keyboard-focus CSS class", async ({ page }) => {
    await enterLayoutMode(page);
    const focused = focusedBlock(page);
    await expect(focused).toHaveCount(1);
    const className = (await focused.getAttribute("class"))!;
    expect(className).toMatch(/KeyboardFocused/);
  });

  test("the layout reset button only appears once the layout is mutated", async ({ page }) => {
    await focusBottomLeft(page);
    await expect(page.getByTestId("layout-reset-button")).toHaveCount(0);

    // Grow south by 1: deterministic on this fixture (60+ free rows).
    await switchSubMode(page, "b", "resize");
    const before = await findById(page, "bottom-left");
    await page.keyboard.press("j");
    const after = await findById(page, "bottom-left");
    expect(after.rowSpan).toBe(before.rowSpan + 1);

    // Phase H (action group): keyboard edits land in the buffer AND get
    // pushed into the undo history, so the action group surfaces
    // immediately. The reset button targets the buffer reset in this
    // mode and is enabled because the buffer has staged changes.
    const resetInBuffer = page.getByTestId("layout-reset-button");
    await expect(resetInBuffer).toBeVisible();
    await expect(resetInBuffer).toBeEnabled();

    await page.keyboard.press("Enter");
    await expect(page.getByTestId("layout-mode-pill")).toHaveCount(0);
    // After commit the persisted layout diverges from the YAML default
    // so the reset button stays visible (now targeting the user reset).
    await expect(page.getByTestId("layout-reset-button")).toBeVisible();
  });

  test("Escape discards keyboard edits and leaves the persisted layout untouched", async ({ page }) => {
    await focusBottomLeft(page);
    await switchSubMode(page, "b", "resize");

    const before = await findById(page, "bottom-left");
    await page.keyboard.press("j");
    const buffered = await findById(page, "bottom-left");
    // While the buffer is live, the DOM reflects the staged edit.
    expect(buffered.rowSpan).toBe(before.rowSpan + 1);

    // Esc discards the buffer.
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("layout-mode-pill")).toHaveCount(0);

    const after = await findById(page, "bottom-left");
    expect(after.rowSpan).toBe(before.rowSpan);
    // No mutation persisted → reset button stays hidden.
    await expect(page.getByTestId("layout-reset-button")).toHaveCount(0);
  });
});
