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

  test.skip("activates layout overlay when a block is focused", async () => {
    // Disabled: depends on the inert v2 keyboard hook. Will be rewritten in
    // Phase E (Zellij modal keyboard).
  });

  test.skip("clears layout overlay when focus is cleared with Escape", async () => {
    // Disabled: see test above.
  });

  test.skip("keyboard focus can land on a heading block", async () => {
    // Disabled: inert v2 keyboard. Phase E.
  });

  test.skip("keyboard navigation can move from a heading to another block", async () => {
    // Disabled: inert v2 keyboard. Phase E.
  });

  test.skip("persists layout changes to localStorage after resizing a resizable block", async () => {
    // Disabled: depends on Alt+Shift+l (inert). Phase E rewrites resize via
    // the resize sub-mode; a new equivalent test will live there.
  });

  test.skip("resets layout to default", async () => {
    // Disabled: relies on inert keyboard + removed "Default layout" text.
    // Phase E rewrites the keyboard flow; reset-from-dev-bar is already
    // tested via dev-mode E2Es (to be added in Phase G).
  });

  test.skip("layout persists across page reload", async () => {
    // Disabled: relies on inert keyboard. Phase E adds an equivalent test
    // using the new modal keyboard, and a complementary drag-based test
    // already covers persistence below ("drags a block to a new position").
  });

  test("drags a block to a new position", async ({ page }) => {
    await page.goto(SHEET_URL);
    await page.waitForSelector("[data-sheet-grid][data-layout-ready='true']");

    const firstBlock = page
      .locator("article[data-layout-card='true'] [class*='cardHeader'], article[data-layout-card='true'] [class*='headingBlockHeader']")
      .first()
      .locator("xpath=ancestor::article[1]");
    await expect(firstBlock).toBeVisible();

    const blockHeader = firstBlock.locator("[class*='cardHeader'], [class*='headingBlockHeader']").first();
    const box = await blockHeader.boundingBox();
    if (box) {
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width / 2 + 320, box.y + box.height / 2 + 220, { steps: 12 });
      await page.mouse.up();
    }

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

  test.skip("remembers layout when navigating back from home", async () => {
    // Disabled: depends on the inert v2 keyboard hook. Will be reintroduced
    // in Phase E with the new modal keyboard.
  });
});
