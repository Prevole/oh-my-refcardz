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

  test("'Reset bindings' button is disabled when no visible binding is modified", async ({ page }) => {
    const resetVisible = page.getByTestId("keybinding-reset-visible");
    await expect(resetVisible).toBeVisible();
    await expect(resetVisible).toBeDisabled();
  });

  test("'Reset bindings' restores ALL modified visible bindings in a single click", async ({ page }) => {
    // Regression test: previously, resetting multiple actions in a single
    // synchronous loop only restored the last one because each call read
    // `config` from a stale closure and the final `saveKeybindings` wiped
    // the intermediate updates. The fix introduces `resetActions(targets)`
    // which applies all resets to a single working snapshot.
    const toggleHelpRow = page.locator("[data-testid='keybinding-row'][data-action-id='global.toggle-help']");
    const goBottomRow = page.locator("[data-testid='keybinding-row'][data-action-id='global.go-bottom']");

    // Modify toggle-help (default: `?`) -> `q` (free key).
    await toggleHelpRow.getByTestId("keybinding-combo-button").first().click();
    await expect(page.getByTestId("keybinding-recording-overlay")).toBeVisible();
    await page.keyboard.press("q");
    await expect(toggleHelpRow.getByTestId("keybinding-reset")).toHaveAttribute("data-modified", "true");

    // Modify go-bottom (default: Shift+G) -> `w` (free key).
    await goBottomRow.getByTestId("keybinding-combo-button").first().click();
    await expect(page.getByTestId("keybinding-recording-overlay")).toBeVisible();
    await page.keyboard.press("w");
    await expect(goBottomRow.getByTestId("keybinding-reset")).toHaveAttribute("data-modified", "true");

    // Reset button is now active.
    const resetVisible = page.getByTestId("keybinding-reset-visible");
    await expect(resetVisible).toBeEnabled();

    // One click -> BOTH actions return to their defaults.
    await resetVisible.click();

    await expect(toggleHelpRow.getByTestId("keybinding-reset")).toHaveAttribute("data-modified", "false");
    await expect(goBottomRow.getByTestId("keybinding-reset")).toHaveAttribute("data-modified", "false");
    await expect(resetVisible).toBeDisabled();
  });

  test("'Reset bindings' restores intentionally overlapping defaults (Esc on both clear-focus and back-to-home)", async ({ page }) => {
    // Regression: BACK_TO_HOME defaults to [Backspace, Escape] and
    // CLEAR_COMMAND_FOCUS defaults to [Escape]. The previous implementation
    // ran findConflict during a bulk reset and stripped the conflicting
    // combo from one of the actions, making it impossible to recover both
    // Esc bindings via a single reset. The fix makes bulk reset apply the
    // defaults verbatim without conflict detection.
    await page.getByTestId("keybindings-sub-tab-cheatsheet").click();

    const clearFocusRow = page.locator("[data-testid='keybinding-row'][data-action-id='sheet.clear-focus']");
    const backToHomeRow = page.locator("[data-testid='keybinding-row'][data-action-id='sheet.back-to-home']");

    // Modify clear-focus to free up Esc on this action, leaving only the one on back-to-home.
    await clearFocusRow.getByTestId("keybinding-combo-button").first().click();
    await expect(page.getByTestId("keybinding-recording-overlay")).toBeVisible();
    await page.keyboard.press("x");
    await expect(clearFocusRow.getByTestId("keybinding-reset")).toHaveAttribute("data-modified", "true");

    // Reset all visible bindings in this sub-tab.
    const resetVisible = page.getByTestId("keybinding-reset-visible");
    await expect(resetVisible).toBeEnabled();
    await resetVisible.click();

    // Both actions must have their original defaults: clear-focus = [Escape], back-to-home = [Backspace, Escape].
    await expect(clearFocusRow.getByTestId("keybinding-reset")).toHaveAttribute("data-modified", "false");
    await expect(backToHomeRow.getByTestId("keybinding-reset")).toHaveAttribute("data-modified", "false");

    // Verify back-to-home still has BOTH Backspace and Escape combos rendered.
    const backCombos = backToHomeRow.getByTestId("keybinding-combo-button");
    await expect(backCombos).toHaveCount(2);
  });

  test("'Reset bindings' does not touch bindings outside the visible sections", async ({ page }) => {
    // Modify a binding in the default (General) sub-tab.
    const toggleHelpRow = page.locator("[data-testid='keybinding-row'][data-action-id='global.toggle-help']");
    await toggleHelpRow.getByTestId("keybinding-combo-button").first().click();
    await expect(page.getByTestId("keybinding-recording-overlay")).toBeVisible();
    await page.keyboard.press("q");
    await expect(toggleHelpRow.getByTestId("keybinding-reset")).toHaveAttribute("data-modified", "true");

    // Switch to a different sub-tab so global.toggle-help is no longer visible.
    await page.getByTestId("keybindings-sub-tab-home").click();
    await expect(toggleHelpRow).not.toBeVisible();

    // Reset on a sub-tab where everything is default should be disabled.
    const resetVisible = page.getByTestId("keybinding-reset-visible");
    await expect(resetVisible).toBeDisabled();

    // Switch back: the modification on toggle-help must still be there.
    await page.getByTestId("keybindings-sub-tab-general").click();
    await expect(toggleHelpRow.getByTestId("keybinding-reset")).toHaveAttribute("data-modified", "true");
  });
});
