import { test, expect, type Page } from "@playwright/test";

/**
 * Phase F8 E2E for `<ContextualInlineHelp />`.
 *
 * Verifies that the inline help line at the top of a cheatsheet page
 * adapts to the active keyboard scope:
 *
 *  - On load:                 surface=sheet, scope=global
 *  - After Ctrl+M:            surface=sheet, scope=layout-navigation
 *  - After m (in layout):     surface=sheet, scope=layout-move
 *  - After r (in layout):     surface=sheet, scope=layout-resize
 *  - After Escape:            surface=sheet, scope=global
 *
 * Also covers the home page baseline (surface=home, scope=global).
 *
 * Uses the dedicated `layout-e2e` fixture under
 * `content_test/cheatsheets/00-layout/`.
 */

const SHEET_SLUG = "layout-e2e";

async function gotoSheetReady(page: Page) {
  await page.goto(`/cheatsheets/${SHEET_SLUG}`);
  await page.waitForSelector("[data-sheet-grid][data-layout-ready='true']");
}

/**
 * Enter layout mode the way `keyboard-layout.spec.ts` does, including the
 * 30ms scope-commit yield after `Control+m`. Without the yield, the next
 * keypress can race the scope context update and be handled by the
 * previous scope.
 */
async function enterLayoutMode(page: Page) {
  await page.locator("[data-sheet-grid]").click({ position: { x: 5, y: 5 } });
  await page.keyboard.press("Control+m");
  await expect(page.getByTestId("layout-mode-pill")).toBeVisible();
  await expect(page.getByTestId("layout-mode-pill")).toHaveAttribute("data-mode", "navigation");
  await page.waitForTimeout(30);
}

async function switchSubMode(page: Page, key: "m" | "b", expected: "move" | "resize") {
  await page.keyboard.press(key);
  await expect(page.getByTestId("layout-mode-pill")).toHaveAttribute("data-mode", expected);
  await page.waitForTimeout(30);
}

async function expectHelpAttributes(
  page: Page,
  surface: "home" | "sheet",
  scope: string,
) {
  const help = page.getByTestId("contextual-inline-help");
  await expect(help).toBeVisible();
  await expect(help).toHaveAttribute("data-surface", surface);
  await expect(help).toHaveAttribute("data-scope", scope);
}

test.describe("ContextualInlineHelp - home surface", () => {
  test("renders with surface=home and scope=global on load", async ({ page }) => {
    await page.goto("/");
    await expectHelpAttributes(page, "home", "global");
  });
});

test.describe("ContextualInlineHelp - sheet surface", () => {
  test.beforeEach(async ({ page }) => {
    await gotoSheetReady(page);
  });

  test("renders with surface=sheet and scope=global on load", async ({ page }) => {
    await expectHelpAttributes(page, "sheet", "global");
  });

  test("switches to layout-navigation when entering layout mode", async ({ page }) => {
    await enterLayoutMode(page);
    await expectHelpAttributes(page, "sheet", "layout-navigation");
  });

  test("switches to layout-move when pressing m in layout mode", async ({ page }) => {
    await enterLayoutMode(page);
    await switchSubMode(page, "m", "move");
    await expectHelpAttributes(page, "sheet", "layout-move");
  });

  test("switches to layout-resize when pressing b in layout mode", async ({ page }) => {
    await enterLayoutMode(page);
    await switchSubMode(page, "b", "resize");
    await expectHelpAttributes(page, "sheet", "layout-resize");
  });

  test("returns to global scope after exiting layout mode with Escape", async ({ page }) => {
    await enterLayoutMode(page);
    await expectHelpAttributes(page, "sheet", "layout-navigation");
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("layout-mode-pill")).toHaveCount(0);
    await expectHelpAttributes(page, "sheet", "global");
  });
});
