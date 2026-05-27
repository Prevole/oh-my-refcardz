import { test, expect, type Page } from "@playwright/test";

const SHEET_SLUG = "layout-persistence-fixture";
const SHEET_URL = `/cheatsheets/${SHEET_SLUG}`;
const STORAGE_KEY = `sheet-layout:${SHEET_SLUG}`;

async function expectLocalStorageLayout(page: Page) {
  await expect(async () => {
    const hasLayout = await page.evaluate(
      (key) => localStorage.getItem(key) !== null,
      STORAGE_KEY
    );
    expect(hasLayout).toBe(true);
  }).toPass({ timeout: 5000 });
}

async function expectNoLocalStorageLayout(page: Page) {
  await expect(async () => {
    const hasLayout = await page.evaluate(
      (key) => localStorage.getItem(key) !== null,
      STORAGE_KEY
    );
    expect(hasLayout).toBe(false);
  }).toPass({ timeout: 5000 });
}

async function dragFirstBlockBy(page: Page, dx: number, dy: number) {
  const firstBlock = page
    .locator("article[data-layout-card='true'] [class*='cardHeader'], article[data-layout-card='true'] [class*='headingBlockHeader']")
    .first()
    .locator("xpath=ancestor::article[1]");
  await expect(firstBlock).toBeVisible();

  const blockHeader = firstBlock.locator("[class*='cardHeader'], [class*='headingBlockHeader']").first();
  const box = await blockHeader.boundingBox();
  if (!box) throw new Error("First block header has no bounding box");

  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + dx, box.y + box.height / 2 + dy, { steps: 12 });
  await page.mouse.up();
}

test.describe("Drag & drop and layout persistence", () => {
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

  test("displays default layout status initially", async ({ page }) => {
    await page.goto(SHEET_URL);
    await page.waitForSelector("[data-sheet-grid][data-layout-ready='true']");
    // No buffer in localStorage means the layout matches the default.
    await expectNoLocalStorageLayout(page);
  });

  test("drags a block to a new position", async ({ page }) => {
    await page.goto(SHEET_URL);
    await page.waitForSelector("[data-sheet-grid][data-layout-ready='true']");

    await dragFirstBlockBy(page, 320, 220);

    await expectLocalStorageLayout(page);
  });

  test("auto-scrolls page when dragging near viewport edge", async ({ page }) => {
    await page.goto(SHEET_URL);
    await page.waitForSelector("[data-sheet-grid][data-layout-ready='true']");

    // Disable smooth scroll for this test: `auto-scroll.ts` calls
    // `window.scrollBy(0, speed)` every animation frame and the page-level
    // `scroll-behavior: smooth` causes those tiny increments to be batched
    // into an animation that never visibly progresses within the 500ms
    // wait window.
    await page.addStyleTag({ content: "html { scroll-behavior: auto !important; }" });

    // Scroll down first to have room to scroll up.
    await page.evaluate(() => window.scrollTo(0, 300));
    await expect(async () => {
      const scrollY = await page.evaluate(() => window.scrollY);
      expect(scrollY).toBeGreaterThanOrEqual(300);
    }).toPass({ timeout: 2000 });

    const initialScrollY = await page.evaluate(() => window.scrollY);

    // Find a block whose header is actually inside the visible viewport
    // (boundingBox.y >= 0 and y + height <= innerHeight). Playwright's
    // `visible: true` filter only checks dimensions and `visibility`, not
    // whether the element is within the current scroll window.
    const headerLocators = await page
      .locator("article[data-layout-card='true'] [class*='cardHeader'], article[data-layout-card='true'] [class*='headingBlockHeader']")
      .all();

    const viewportHeight = await page.evaluate(() => window.innerHeight);
    let box: { x: number; y: number; width: number; height: number } | null = null;
    for (const loc of headerLocators) {
      const candidate = await loc.boundingBox();
      if (candidate && candidate.y >= 0 && candidate.y + candidate.height <= viewportHeight) {
        box = candidate;
        break;
      }
    }
    if (!box) {
      throw new Error("No block header is visible in the current viewport");
    }

    // Start dragging
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();

    // Move to near the top edge of the viewport (within 80px threshold)
    await page.mouse.move(box.x + box.width / 2, 40, { steps: 5 });

    // Wait for auto-scroll to take effect
    await page.waitForTimeout(500);

    // Verify page scrolled up
    const finalScrollY = await page.evaluate(() => window.scrollY);
    expect(finalScrollY).toBeLessThan(initialScrollY);

    // Release the drag
    await page.mouse.up();
  });
});

test.describe("Layout persistence across navigation", () => {
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

  test("layout persists across an SPA round-trip (sheet → home → sheet)", async ({ page }) => {
    // 1. Open the sheet and drag a block to mutate the layout.
    await page.goto(SHEET_URL);
    await page.waitForSelector("[data-sheet-grid][data-layout-ready='true']");
    await dragFirstBlockBy(page, 320, 220);
    await expectLocalStorageLayout(page);

    // Capture the persisted layout snapshot. Positions are exposed as CSS
    // variables on each card, so we read them from inline styles.
    const positionsAfterDrag = await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll("article[data-layout-card='true']"));
      return cards.map((card) => {
        const el = card as HTMLElement;
        return {
          id: el.getAttribute("data-layout-block-id"),
          colStart: el.style.getPropertyValue("--card-col-start"),
          rowStart: el.style.getPropertyValue("--card-row-start"),
          colSpan: el.style.getPropertyValue("--card-col-span"),
          rowSpan: el.style.getPropertyValue("--card-row-span"),
        };
      });
    });

    // 2. Navigate back to the home page using Backspace (the BACK_TO_HOME
    // shortcut). This is a Next.js client-side navigation, not a reload —
    // the React tree is torn down but the JS context survives.
    await page.keyboard.press("Backspace");
    await expect(page).toHaveURL("/");
    await page.waitForSelector("[data-testid='hex-board']");

    // 3. Re-open the same sheet. The persistence layer must rehydrate from
    //    localStorage on mount.
    await page.goto(SHEET_URL);
    await page.waitForSelector("[data-sheet-grid][data-layout-ready='true']");

    // 4. The positions must match what we captured after the drag.
    const positionsAfterReturn = await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll("article[data-layout-card='true']"));
      return cards.map((card) => {
        const el = card as HTMLElement;
        return {
          id: el.getAttribute("data-layout-block-id"),
          colStart: el.style.getPropertyValue("--card-col-start"),
          rowStart: el.style.getPropertyValue("--card-row-start"),
          colSpan: el.style.getPropertyValue("--card-col-span"),
          rowSpan: el.style.getPropertyValue("--card-row-span"),
        };
      });
    });

    expect(positionsAfterReturn).toEqual(positionsAfterDrag);
  });
});
