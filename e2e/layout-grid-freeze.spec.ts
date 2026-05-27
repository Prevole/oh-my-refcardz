import { test, expect, type Page } from "@playwright/test";

const SHEET_SLUG = "layout-persistence-fixture";
const SHEET_URL = `/cheatsheets/${SHEET_SLUG}`;

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

async function getGridHeight(page: Page): Promise<number> {
  return page.evaluate(() => {
    const grid = document.querySelector("[data-sheet-grid]") as HTMLElement | null;
    if (!grid) throw new Error("[data-sheet-grid] not found");
    return grid.getBoundingClientRect().height;
  });
}

test.describe("Grid height freeze during mouse interaction", () => {
  test.beforeEach(async ({ page }) => {
    await clearLayoutStorage(page);
  });

  test("grid height does not shrink while dragging the bottommost card upward", async ({ page }) => {
    await page.goto(SHEET_URL);
    await page.waitForSelector("[data-sheet-grid][data-layout-ready='true']");

    const initialHeight = await getGridHeight(page);
    expect(initialHeight).toBeGreaterThan(0);

    // Grab the LAST card (Card Six in the fixture, bottommost).
    const lastCard = page
      .locator("article[data-layout-card='true'][data-layout-block-id='card-six']");
    await expect(lastCard).toBeVisible();
    await lastCard.scrollIntoViewIfNeeded();

    const header = lastCard.locator("[class*='cardHeader']").first();
    const box = await header.boundingBox();
    if (!box) throw new Error("Card Six header has no bounding box");

    // Start dragging.
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();

    // Move the card upward in several increments and after each one verify
    // that the grid height has NOT shrunk below the initial measurement.
    // Without the freeze fix, the bottom card moving up shortens the grid
    // and the height drops on intermediate frames.
    const steps = [
      { dx: -50, dy: -120 },
      { dx: -80, dy: -240 },
      { dx: -100, dy: -360 },
      { dx: -120, dy: -480 },
    ];

    for (const step of steps) {
      await page.mouse.move(box.x + box.width / 2 + step.dx, box.y + box.height / 2 + step.dy, { steps: 8 });
      const currentHeight = await getGridHeight(page);
      // Allow a 1px tolerance for sub-pixel rounding.
      expect(currentHeight).toBeGreaterThanOrEqual(initialHeight - 1);
    }

    // Release.
    await page.mouse.up();

    // After release, the freeze is lifted and the grid is free to settle to
    // its natural intrinsic height (which may be smaller than the initial
    // snapshot height if the user genuinely moved a bottom card upward).
    // We do not assert a specific value here; the contract is only about
    // the freeze DURING the interaction.
  });

  test("grid height freeze releases after pointer up", async ({ page }) => {
    await page.goto(SHEET_URL);
    await page.waitForSelector("[data-sheet-grid][data-layout-ready='true']");

    const initialHeight = await getGridHeight(page);

    const lastCard = page.locator("article[data-layout-card='true'][data-layout-block-id='card-six']");
    await lastCard.scrollIntoViewIfNeeded();
    const header = lastCard.locator("[class*='cardHeader']").first();
    const box = await header.boundingBox();
    if (!box) throw new Error("Card Six header has no bounding box");

    // Drag upward and release. The destination is the empty space below the
    // upper cards (the fixture has six cards roughly stacked vertically).
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 - 100, box.y + box.height / 2 - 400, { steps: 16 });
    await page.mouse.up();

    // Wait one rAF for the post-release layout to settle.
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => r(null))));

    const finalHeight = await getGridHeight(page);
    // The grid is now free to shrink. Either it has shrunk (card moved up
    // and the bottom row is gone) or it stayed the same (engine refused the
    // move). It must NOT be larger than the initial height: the only thing
    // that can keep it taller is the freeze itself, which has been released.
    expect(finalHeight).toBeLessThanOrEqual(initialHeight + 1);
  });
});
