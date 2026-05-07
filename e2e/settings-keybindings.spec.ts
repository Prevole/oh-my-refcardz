import { test, expect } from "@playwright/test";

test.describe("Settings panel", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector("[class*='hexBoard']");
    await page.evaluate(() => localStorage.clear());
  });

  test("opens settings panel with comma key", async ({ page }) => {
    await page.keyboard.press(",");
    const settingsHeading = page.getByRole("heading", { name: "Settings" });
    await expect(settingsHeading).toBeVisible();
  });

  test("closes settings panel with Escape", async ({ page }) => {
    await page.keyboard.press(",");
    const settingsHeading = page.getByRole("heading", { name: "Settings" });
    await expect(settingsHeading).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(settingsHeading).not.toBeVisible();
  });

  test("closes settings panel when clicking outside", async ({ page }) => {
    await page.keyboard.press(",");
    const settingsHeading = page.getByRole("heading", { name: "Settings" });
    await expect(settingsHeading).toBeVisible();

    const overlay = page.locator("[class*='settings-panel-module'][class*='overlay']");
    await overlay.click({ position: { x: 10, y: 10 } });
    await expect(settingsHeading).not.toBeVisible();
  });
});

test.describe("Keybinding editor", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector("[class*='hexBoard']");
    await page.evaluate(() => localStorage.clear());
    await page.keyboard.press(",");
    await page.getByRole("button", { name: /keybindings/i }).click();
  });

  test("opens recording overlay when clicking a keybinding", async ({ page }) => {
    const firstComboButton = page.locator("[class*='comboButton']").first();
    await firstComboButton.click();

    const recordingOverlay = page.locator("[data-recording-overlay-root]");
    await expect(recordingOverlay).toBeVisible();
    await expect(page.getByText("Press a key combination")).toBeVisible();
  });

  test("closes recording overlay when clicking outside", async ({ page }) => {
    const firstComboButton = page.locator("[class*='comboButton']").first();
    await firstComboButton.click();

    const recordingOverlay = page.locator("[data-recording-overlay-root]");
    await expect(recordingOverlay).toBeVisible();

    await recordingOverlay.click({ position: { x: 10, y: 10 } });
    await expect(recordingOverlay).not.toBeVisible();
  });

  test("records a new keybinding", async ({ page }) => {
    const firstComboButton = page.locator("[class*='comboButton']").first();
    const originalText = await firstComboButton.textContent();

    await firstComboButton.click();
    await page.keyboard.press("x");

    await expect(firstComboButton).toContainText("x");
    expect(await firstComboButton.textContent()).not.toBe(originalText);
  });

  test("shows conflict warning when keybinding conflicts", async ({ page }) => {
    const moveLeftRow = page.locator("[class*='row']").filter({ hasText: "Move left" });
    const toggleSettingsRow = page.locator("[class*='row']").filter({ hasText: "Toggle settings" });

    await expect(moveLeftRow).toBeVisible();
    await expect(toggleSettingsRow).toBeVisible();

    const settingsCombo = toggleSettingsRow.locator("[class*='comboButton']").first();
    await settingsCombo.click();

    const recordingOverlay = page.locator("[data-recording-overlay-root]");
    await expect(recordingOverlay).toBeVisible();

    await page.keyboard.press("h");

    const conflictWarning = page.locator("div[class*='conflict']").first();
    await expect(conflictWarning).toBeVisible({ timeout: 3000 });
    await expect(conflictWarning).toContainText("Replaced binding");
    await expect(conflictWarning).toContainText("Move left");
  });

  test("dismisses conflict warning without closing settings panel", async ({ page }) => {
    const toggleSettingsRow = page.locator("[class*='row']").filter({ hasText: "Toggle settings" });

    const settingsCombo = toggleSettingsRow.locator("[class*='comboButton']").first();
    await settingsCombo.click();

    const recordingOverlay = page.locator("[data-recording-overlay-root]");
    await expect(recordingOverlay).toBeVisible();

    await page.keyboard.press("h");

    const conflictWarning = page.locator("div[class*='conflict']").first();
    await expect(conflictWarning).toBeVisible({ timeout: 3000 });

    const dismissButton = conflictWarning.locator("button");
    await dismissButton.click();

    await expect(conflictWarning).not.toBeVisible();

    const settingsHeading = page.getByRole("heading", { name: "Settings" });
    await expect(settingsHeading).toBeVisible();
  });

  test("reset action detects conflicts with current keybindings", async ({ page }) => {
    const moveLeftRow = page.locator("[class*='row']").filter({ hasText: "Move left" });
    const toggleSettingsRow = page.locator("[class*='row']").filter({ hasText: "Toggle settings" });

    const settingsCombo = toggleSettingsRow.locator("[class*='comboButton']").first();
    await settingsCombo.click();

    const recordingOverlay = page.locator("[data-recording-overlay-root]");
    await expect(recordingOverlay).toBeVisible();

    await page.keyboard.press("h");

    const conflictWarning = page.locator("div[class*='conflict']").first();
    await expect(conflictWarning).toBeVisible({ timeout: 3000 });
    await conflictWarning.locator("button").click();
    await expect(conflictWarning).not.toBeVisible();

    const moveLeftCombo = moveLeftRow.locator("[class*='comboButton']").first();
    await moveLeftCombo.click();
    await expect(recordingOverlay).toBeVisible();
    await page.keyboard.press("z");

    if (await conflictWarning.isVisible({ timeout: 1000 }).catch(() => false)) {
      await conflictWarning.locator("button").click();
    }

    const resetButton = moveLeftRow.locator("[class*='resetButton']");
    await expect(resetButton).toBeVisible({ timeout: 2000 });
    await resetButton.click();

    await expect(conflictWarning).toBeVisible({ timeout: 3000 });
    await expect(conflictWarning).toContainText("Toggle settings");
  });
});
