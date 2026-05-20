import { test, expect, type Page } from "@playwright/test";

// South-fallback E2E: covers the "wrap" strategy of the layout engine.
// When a block is moved/resized in a way that creates an unresolvable
// horizontal collision, the engine wraps the impacted block(s) toward
// the south (the grid has no south edge). We exercise this user-side
// via a generous mouse drag on a dense cheatsheet (git) and verify
// that at least one other block ended up further south than where it
// started.

async function gotoSheetReady(page: Page, slug: string) {
  await page.goto(`/cheatsheets/${slug}`);
  await page.waitForSelector("[data-sheet-grid][data-layout-ready='true']");
}

type BlockSnapshot = {
  id: string;
  colStart: number;
  rowStart: number;
  colSpan: number;
  rowSpan: number;
};

async function readBlockSnapshots(page: Page): Promise<BlockSnapshot[]> {
  return page.evaluate(() => {
    function readVar(style: string, name: string): number {
      const re = new RegExp(`--${name}:\\s*(\\d+)`);
      const match = style.match(re);
      return match ? parseInt(match[1], 10) : NaN;
    }

    const articles = Array.from(
      document.querySelectorAll<HTMLElement>("article[data-layout-card='true']")
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

function findBlockById(snapshots: BlockSnapshot[], id: string): BlockSnapshot | undefined {
  return snapshots.find((snap) => snap.id === id);
}

test.describe("Layout engine south-fallback", () => {
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

  test("wraps a colliding block toward the south when dragged onto another", async ({ page }) => {
    await gotoSheetReady(page, "git");

    const initial = await readBlockSnapshots(page);
    expect(initial.length).toBeGreaterThan(2);

    // Pick the first non-heading card and drag it down + right far enough to
    // overlap with one of its neighbours.
    const draggable = page
      .locator("article[data-layout-card='true'] [class*='cardHeader']")
      .first()
      .locator("xpath=ancestor::article[1]");

    const draggableId = await draggable.getAttribute("data-layout-block-id");
    expect(draggableId).not.toBeNull();

    const headerBox = await draggable.locator("[class*='cardHeader']").first().boundingBox();
    expect(headerBox).not.toBeNull();
    if (!headerBox) return;

    const startX = headerBox.x + headerBox.width / 2;
    const startY = headerBox.y + headerBox.height / 2;

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    // Drag far enough horizontally and vertically to cross multiple cells,
    // forcing the engine into a non-trivial resolution path. The exact
    // distance is not critical: any collision-with-fallback will do.
    await page.mouse.move(startX + 480, startY + 320, { steps: 16 });
    await page.mouse.up();

    // Allow the engine to commit and the DOM to reflect the new layout.
    await page.waitForFunction(
      (originalId) => {
        const article = document.querySelector<HTMLElement>(
          `article[data-layout-card='true'][data-layout-block-id='${originalId}']`
        );
        if (!article) return false;
        const style = article.getAttribute("style") ?? "";
        const m = style.match(/--card-row-start:\s*(\d+)/);
        return m !== null;
      },
      draggableId
    );

    const after = await readBlockSnapshots(page);
    expect(after.length).toBe(initial.length);

    // The dragged block must have moved (any direction).
    const draggedBefore = findBlockById(initial, draggableId!)!;
    const draggedAfter = findBlockById(after, draggableId!)!;
    const draggedMoved =
      draggedBefore.colStart !== draggedAfter.colStart ||
      draggedBefore.rowStart !== draggedAfter.rowStart;
    expect(draggedMoved).toBe(true);

    // At least one other block must have ended up further south than before:
    // this is the south-fallback signature. (Some blocks may also have moved
    // north or kept their X — we only need one block to have wrapped south.)
    const wrappedBlocks = after.filter((snap) => {
      if (snap.id === draggableId) return false;
      const before = findBlockById(initial, snap.id);
      if (!before) return false;
      return snap.rowStart > before.rowStart;
    });

    expect(wrappedBlocks.length).toBeGreaterThan(0);
  });

  test("south-wrapped layout survives a page reload", async ({ page }) => {
    await gotoSheetReady(page, "git");

    const initial = await readBlockSnapshots(page);

    const draggable = page
      .locator("article[data-layout-card='true'] [class*='cardHeader']")
      .first()
      .locator("xpath=ancestor::article[1]");
    const draggableId = await draggable.getAttribute("data-layout-block-id");
    expect(draggableId).not.toBeNull();

    const headerBox = await draggable.locator("[class*='cardHeader']").first().boundingBox();
    expect(headerBox).not.toBeNull();
    if (!headerBox) return;

    await page.mouse.move(headerBox.x + headerBox.width / 2, headerBox.y + headerBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(
      headerBox.x + headerBox.width / 2 + 480,
      headerBox.y + headerBox.height / 2 + 320,
      { steps: 16 }
    );
    await page.mouse.up();

    await expect(async () => {
      const stored = await page.evaluate(() => localStorage.getItem("sheet-layout:git"));
      expect(stored).not.toBeNull();
    }).toPass({ timeout: 5000 });

    const afterDrag = await readBlockSnapshots(page);

    await page.reload();
    await page.waitForSelector("[data-sheet-grid][data-layout-ready='true']");

    const afterReload = await readBlockSnapshots(page);

    // Layout must be identical before/after reload: the persistence layer
    // should not re-trigger the south fallback (it is a pure consequence of
    // the drag, not a relaxation step).
    expect(afterReload.length).toBe(afterDrag.length);
    for (const snap of afterDrag) {
      const reloaded = findBlockById(afterReload, snap.id);
      expect(reloaded).toBeDefined();
      expect(reloaded!.colStart).toBe(snap.colStart);
      expect(reloaded!.rowStart).toBe(snap.rowStart);
      expect(reloaded!.colSpan).toBe(snap.colSpan);
      expect(reloaded!.rowSpan).toBe(snap.rowSpan);
    }

    // Sanity check: at least one block has actually moved compared to the
    // default layout we loaded with.
    const anyDrift = afterReload.some((snap) => {
      const before = findBlockById(initial, snap.id);
      return before
        ? before.colStart !== snap.colStart || before.rowStart !== snap.rowStart
        : false;
    });
    expect(anyDrift).toBe(true);
  });
});
