import { test, expect, type Page } from "@playwright/test";

/**
 * Regression tests for layout-mode focus-on-entry behavior.
 *
 * Covers:
 *  - L-1: entering layout mode focuses the block closest to the mouse cursor.
 *  - L-3: the `data-layout-block-id` DOM attribute carries the raw block id
 *    (not a slugified anchor), so the pick-closest lookup actually finds
 *    the right elements. Pre-fix, `[data-layout-block-id="bottom-right"]`
 *    returned null for all four cards and pick-closest silently fell back
 *    to the top-left block every time.
 *
 * Fixture: layout-e2e.yaml — four cards in a 2x2 grid + 1 heading.
 */

const SHEET_SLUG = "layout-e2e";

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

function focusedBlockId(page: Page) {
  return page
    .locator("article[data-keyboard-focused='true']")
    .getAttribute("data-layout-block-id");
}

async function rectOf(page: Page, blockId: string) {
  const handle = await page
    .locator(`[data-layout-block-id="${blockId}"]`)
    .elementHandle();
  if (!handle) throw new Error(`Block ${blockId} not found in DOM`);
  const box = await handle.boundingBox();
  if (!box) throw new Error(`Block ${blockId} has no bounding box`);
  return box;
}

async function enterFromPointer(
  page: Page,
  position: { x: number; y: number },
) {
  await page.mouse.move(position.x, position.y);
  // Two moves guarantee the mousemove listener has captured a fresh
  // coordinate before Ctrl+M fires.
  await page.mouse.move(position.x + 1, position.y + 1);
  await page.keyboard.press("Control+m");
  await expect(page.getByTestId("layout-mode-pill")).toBeVisible();
  await expect(page.locator("article[data-keyboard-focused='true']")).toHaveCount(1);
}

async function exitLayoutMode(page: Page) {
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("layout-mode-pill")).toHaveCount(0);
}

test.describe("Layout mode — focus on entry (pick-closest)", () => {
  test.beforeEach(async ({ page }) => {
    await clearLayoutStorage(page);
    await gotoSheetReady(page);
  });

  test("Ctrl+M focuses the card under the mouse cursor (top-left)", async ({
    page,
  }) => {
    const box = await rectOf(page, "top-left");
    await enterFromPointer(page, {
      x: box.x + box.width / 2,
      y: box.y + box.height / 2,
    });
    expect(await focusedBlockId(page)).toBe("top-left");
  });

  test("Ctrl+M focuses the card under the mouse cursor (top-right)", async ({
    page,
  }) => {
    const box = await rectOf(page, "top-right");
    await enterFromPointer(page, {
      x: box.x + box.width / 2,
      y: box.y + box.height / 2,
    });
    expect(await focusedBlockId(page)).toBe("top-right");
  });

  test("Ctrl+M focuses the card under the mouse cursor (bottom-left)", async ({
    page,
  }) => {
    const box = await rectOf(page, "bottom-left");
    await enterFromPointer(page, {
      x: box.x + box.width / 2,
      y: box.y + box.height / 2,
    });
    expect(await focusedBlockId(page)).toBe("bottom-left");
  });

  test("Ctrl+M focuses the card under the mouse cursor (bottom-right)", async ({
    page,
  }) => {
    const box = await rectOf(page, "bottom-right");
    await enterFromPointer(page, {
      x: box.x + box.width / 2,
      y: box.y + box.height / 2,
    });
    expect(await focusedBlockId(page)).toBe("bottom-right");
  });

  test("re-entering layout mode picks the closest card again (no stale focus)", async ({
    page,
  }) => {
    // First entry near top-left.
    const tl = await rectOf(page, "top-left");
    await enterFromPointer(page, {
      x: tl.x + tl.width / 2,
      y: tl.y + tl.height / 2,
    });
    expect(await focusedBlockId(page)).toBe("top-left");
    await exitLayoutMode(page);

    // Second entry near bottom-right — must not preserve top-left focus.
    const br = await rectOf(page, "bottom-right");
    await enterFromPointer(page, {
      x: br.x + br.width / 2,
      y: br.y + br.height / 2,
    });
    expect(await focusedBlockId(page)).toBe("bottom-right");
  });
});
