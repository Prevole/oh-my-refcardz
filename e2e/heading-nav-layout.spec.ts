import { test, expect, type Page } from "@playwright/test";

// Phase C E2E: the heading navigation reflects the live layout order,
// not the YAML declaration order. Bug 2.1 from layout-v2-bugfixes.md.

const SHEET_SLUG = "heading-nav-fixture";
const STORAGE_KEY = `sheet-layout:${SHEET_SLUG}`;
const HEADING_LABELS = ["Section A", "Section B"] as const;

async function gotoSheetReady(page: Page) {
  await page.goto(`/cheatsheets/${SHEET_SLUG}`);
  await page.waitForSelector("[data-sheet-grid][data-layout-ready='true']");
}

async function getNavLabelsInOrder(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const nav = document.querySelector<HTMLElement>("nav[aria-label='Heading navigation']");
    if (!nav) return [];
    return Array.from(nav.querySelectorAll<HTMLElement>("li span")).map(
      (el) => el.textContent?.trim() ?? ""
    );
  });
}

test.describe("Heading navigation reflects layout order", () => {
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

  test("default order matches YAML declaration", async ({ page }) => {
    await gotoSheetReady(page);
    const labels = await getNavLabelsInOrder(page);
    expect(labels).toEqual([...HEADING_LABELS]);
  });

  test("reordering headings in the layout reorders the navigation", async ({ page }) => {
    await gotoSheetReady(page);

    // Build a synthetic layout that swaps the Y positions of the two
    // headings, then push it through localStorage and reload. We do not
    // rely on reading exact positions from the live DOM — those are CSS
    // Grid coordinates which can diverge from the engine's logical y for
    // headings that span the full width. Building from scratch is the
    // most reliable signal.
    await page.evaluate((storageKey: string) => {
      const articles = Array.from(
        document.querySelectorAll<HTMLElement>("article[data-layout-card='true']")
      );

      const HEADING_PREFIX = "sheet-heading-";
      const CARD_PREFIX = "sheet-card-";
      function stripPrefix(fullId: string): { id: string; kind: "heading" | "card" } {
        if (fullId.startsWith(HEADING_PREFIX)) {
          return { id: fullId.slice(HEADING_PREFIX.length), kind: "heading" };
        }
        if (fullId.startsWith(CARD_PREFIX)) {
          return { id: fullId.slice(CARD_PREFIX.length), kind: "card" };
        }
        return { id: fullId, kind: "card" };
      }

      const orderedRawIds = articles.map((a) =>
        stripPrefix(a.getAttribute("data-layout-block-id") ?? "")
      );

      // Force Section B to appear first by placing it at row 1, then
      // Section A further down. The exact positions of intermediate cards
      // don't matter for the assertion; we just need to make sure
      // section-b ends up north of section-a in the engine grid.
      type Block = {
        id: string;
        kind: "heading" | "card";
        colStart: number;
        rowStart: number;
        colSpan: number;
        rowSpan: number;
      };

      const layout: Record<string, Omit<Block, "id" | "kind">> = {
        "section-b": { colStart: 1, rowStart: 1, colSpan: 36, rowSpan: 2 },
        "card-b1": { colStart: 1, rowStart: 3, colSpan: 18, rowSpan: 6 },
        "card-b2": { colStart: 19, rowStart: 3, colSpan: 18, rowSpan: 6 },
        "section-a": { colStart: 1, rowStart: 9, colSpan: 36, rowSpan: 2 },
        "card-a1": { colStart: 1, rowStart: 11, colSpan: 36, rowSpan: 6 },
      };

      const blocks: Block[] = orderedRawIds.map(({ id, kind }) => ({
        id,
        kind,
        ...(layout[id] ?? { colStart: 1, rowStart: 1, colSpan: 36, rowSpan: 2 }),
      }));

      const payload = { version: 3, blocks };
      localStorage.setItem(storageKey, JSON.stringify(payload));
    }, STORAGE_KEY);

    // Reload so the persistence layer applies the swapped layout.
    await page.goto(`/cheatsheets/${SHEET_SLUG}`);
    await page.waitForSelector("[data-sheet-grid][data-layout-ready='true']");

    // The navigation must now list "Section B" before "Section A".
    const labels = await getNavLabelsInOrder(page);
    expect(labels.indexOf("Section B")).toBeLessThan(labels.indexOf("Section A"));
  });
});
