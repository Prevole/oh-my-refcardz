import { test, expect, type Page } from "@playwright/test";

// Phase C E2E: the heading navigation reflects the live layout order,
// not the YAML declaration order. Bug 2.1 from layout-v2-bugfixes.md.

const SHEET_SLUG = "diff-so-fancy";
const STORAGE_KEY = `sheet-layout:${SHEET_SLUG}`;
const HEADING_LABELS = ["Basics", "Daily Review Flow"] as const;

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

      // Build a synthetic layout with explicit, non-overlapping rows.
      // We place blocks in this declaration order:
      //   1. "Daily Review Flow" heading at the top   (row 1)
      //   2. "Common Commands" card                  (row 3)
      //   3. "Basics" heading                        (row 17)
      //   4. "What It Is" card                       (row 19, left half)
      //   5. "Pager" card                            (row 19, right half)
      //
      // Any heading/card not listed above falls into the YAML default
      // ordering. This is sufficient to assert that the navigation
      // reorders to put "Daily Review Flow" first.
      type Block = {
        id: string;
        kind: "heading" | "card";
        colStart: number;
        rowStart: number;
        colSpan: number;
        rowSpan: number;
      };

      const layout: Record<string, Omit<Block, "id" | "kind">> = {
        "daily-review-flow": { colStart: 1, rowStart: 1, colSpan: 36, rowSpan: 2 },
        "common-commands": { colStart: 1, rowStart: 3, colSpan: 36, rowSpan: 14 },
        basics: { colStart: 1, rowStart: 17, colSpan: 36, rowSpan: 2 },
        "what-it-is": { colStart: 1, rowStart: 19, colSpan: 18, rowSpan: 14 },
        pager: { colStart: 19, rowStart: 19, colSpan: 18, rowSpan: 14 },
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

    // The navigation must now list "Daily Review Flow" before "Basics".
    const labels = await getNavLabelsInOrder(page);
    expect(labels.indexOf("Daily Review Flow")).toBeLessThan(labels.indexOf("Basics"));
  });
});
