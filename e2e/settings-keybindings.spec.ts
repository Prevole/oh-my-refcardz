import { test, expect } from "@playwright/test";

test.describe("Settings panel", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector("[data-testid='hex-board']");
    await page.evaluate(() => localStorage.clear());
  });

  test("opens settings panel with comma key", async ({ page }) => {
    await page.keyboard.press(",");
    await expect(page.getByTestId("settings-panel")).toBeVisible();
  });

  test("closes settings panel with Escape", async ({ page }) => {
    await page.keyboard.press(",");
    const panel = page.getByTestId("settings-panel");
    await expect(panel).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(panel).not.toBeVisible();
  });

  test("closes settings panel when clicking outside", async ({ page }) => {
    await page.keyboard.press(",");
    const panel = page.getByTestId("settings-panel");
    await expect(panel).toBeVisible();

    await page.getByTestId("settings-overlay").click({ position: { x: 10, y: 10 } });
    await expect(panel).not.toBeVisible();
  });
});

test.describe("Keybinding editor", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector("[data-testid='hex-board']");
    await page.evaluate(() => localStorage.clear());
    await page.keyboard.press(",");
    await page.getByRole("button", { name: /keybindings/i }).click();
    await expect(page.getByTestId("keybinding-editor")).toBeVisible();
  });

  test("opens recording overlay when clicking a keybinding", async ({ page }) => {
    await page.getByTestId("keybinding-combo-button").first().click();
    const overlay = page.getByTestId("keybinding-recording-overlay");
    await expect(overlay).toBeVisible();
    await expect(page.getByText("Press a key combination")).toBeVisible();
  });

  test("closes recording overlay when clicking outside", async ({ page }) => {
    await page.getByTestId("keybinding-combo-button").first().click();
    const overlay = page.getByTestId("keybinding-recording-overlay");
    await expect(overlay).toBeVisible();

    await overlay.click({ position: { x: 10, y: 10 } });
    await expect(overlay).not.toBeVisible();
  });

  test("records a new keybinding", async ({ page }) => {
    const firstCombo = page.getByTestId("keybinding-combo-button").first();
    const originalText = await firstCombo.textContent();

    await firstCombo.click();
    await page.keyboard.press("x");

    await expect(firstCombo).toContainText("x");
    expect(await firstCombo.textContent()).not.toBe(originalText);
  });

  test("shows conflict warning when keybinding conflicts", async ({ page }) => {
    // Both actions live in the `global` context, so rebinding one onto the
    // other's combo triggers a scope-local conflict.
    const toggleHelpRow = page.locator("[data-testid='keybinding-row'][data-action-id='global.toggle-help']");
    await expect(toggleHelpRow).toBeVisible();

    await toggleHelpRow.getByTestId("keybinding-combo-button").first().click();
    await expect(page.getByTestId("keybinding-recording-overlay")).toBeVisible();

    await page.keyboard.press(",");

    const conflict = page.getByTestId("keybinding-conflict");
    await expect(conflict).toBeVisible({ timeout: 3000 });
    await expect(conflict).toContainText("Replaced binding");
    await expect(conflict).toContainText("Toggle settings");
  });

  test("dismisses conflict warning without closing settings panel", async ({ page }) => {
    const toggleHelpRow = page.locator("[data-testid='keybinding-row'][data-action-id='global.toggle-help']");

    await toggleHelpRow.getByTestId("keybinding-combo-button").first().click();
    await expect(page.getByTestId("keybinding-recording-overlay")).toBeVisible();

    await page.keyboard.press(",");

    const conflict = page.getByTestId("keybinding-conflict");
    await expect(conflict).toBeVisible({ timeout: 3000 });

    await page.getByTestId("keybinding-conflict-dismiss").click();
    await expect(conflict).not.toBeVisible();
    await expect(page.getByTestId("settings-panel")).toBeVisible();
  });

  test("reset action detects conflicts with current keybindings", async ({ page }) => {
    // Two actions in the same context (`global`): toggle-help and
    // toggle-settings. We force them into conflicting states, then verify
    // that resetting one to its default re-triggers the conflict.
    const toggleHelpRow = page.locator("[data-testid='keybinding-row'][data-action-id='global.toggle-help']");
    const toggleSettingsRow = page.locator("[data-testid='keybinding-row'][data-action-id='global.toggle-settings']");

    // Step 1: rebind toggle-help to `,` -> conflicts with toggle-settings.
    await toggleHelpRow.getByTestId("keybinding-combo-button").first().click();
    await expect(page.getByTestId("keybinding-recording-overlay")).toBeVisible();
    await page.keyboard.press(",");

    const conflict = page.getByTestId("keybinding-conflict");
    await expect(conflict).toBeVisible({ timeout: 3000 });
    await page.getByTestId("keybinding-conflict-dismiss").click();
    await expect(conflict).not.toBeVisible();

    // Step 2: assign a free key (`z`) to toggle-settings (which lost its
    // only combo to the replacement above). We use the "add" button because
    // the row has no combo buttons left after the replacement.
    await toggleSettingsRow.getByTestId("keybinding-combo-add").click();
    await expect(page.getByTestId("keybinding-recording-overlay")).toBeVisible();
    await page.keyboard.press("z");

    if (await conflict.isVisible({ timeout: 1000 }).catch(() => false)) {
      await page.getByTestId("keybinding-conflict-dismiss").click();
    }

    // Step 3: reset toggle-settings to its default (`,`) -> conflicts with
    // the rebound toggle-help.
    const resetButton = toggleSettingsRow.getByTestId("keybinding-reset");
    await expect(resetButton).toBeVisible({ timeout: 2000 });
    await resetButton.click();

    await expect(conflict).toBeVisible({ timeout: 3000 });
    await expect(conflict).toContainText("Toggle help");
  });
});
