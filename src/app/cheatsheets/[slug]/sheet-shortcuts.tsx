"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { SheetHelpModal } from "@/components/help/sheet-help-modal";
import { HelpButton } from "@/components/help/help-button";
import { SettingsButton } from "@/components/settings/settings-button";
import { SettingsPanel } from "@/components/settings/settings-panel";
import { useUISettings } from "@/hooks/use-ui-settings";
import { useKeybindings } from "@/hooks/use-keybindings";
import { useKeyboardScope } from "@/hooks/use-keyboard-context";
import { useAction } from "@/hooks/use-action";
import { ACTION_IDS } from "@/lib/keybindings";

export function SheetShortcuts() {
  const router = useRouter();
  const [helpOpen, setHelpOpen] = useState(false);
  const [settingsPanelOpen, setSettingsPanelOpen] = useState(false);

  useKeyboardScope("sheet", true);
  useKeyboardScope("settings", settingsPanelOpen, { modal: true });
  useKeyboardScope("help", helpOpen, { modal: true });

  const {
    settings: uiSettings,
    setColorMode,
    toggleRandom,
    setBorder,
    setDirection,
    setActivePanelTab,
    resetModern,
  } = useUISettings();

  const { resolveAction } = useKeybindings();

  // Global UI shortcuts (open help/settings, scroll). Bound on the
  // `global` scope so they keep working even when a non-modal sub-mode
  // (e.g. layout) is on top of the stack; the dispatcher cascades down
  // through non-modal scopes until it finds a match.
  useAction(ACTION_IDS.TOGGLE_HELP, "global", () => {
    setSettingsPanelOpen(false);
    setHelpOpen((prev) => !prev);
  });
  useAction(ACTION_IDS.TOGGLE_SETTINGS, "global", () => {
    setHelpOpen(false);
    setSettingsPanelOpen((prev) => !prev);
  });
  useAction(ACTION_IDS.GO_TOP, "global", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
  useAction(ACTION_IDS.GO_BOTTOM, "global", () => {
    window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "smooth" });
  });

  // Back-to-home is sheet-scoped: it should only fire while the sheet
  // scope is reachable, and is preempted by clear-focus when a card is
  // currently selected via keyboard navigation.
  const handleBackToHome = useCallback(
    (event: KeyboardEvent) => {
      if (document.querySelector("[data-command-modal-overlay]")) return;
      const hasSelection = document.querySelector(
        "[data-item][data-nav-focused='true'], [data-copyable][data-nav-focused='true']",
      );
      const isClearFocusKey =
        resolveAction(event, [ACTION_IDS.CLEAR_COMMAND_FOCUS]) === ACTION_IDS.CLEAR_COMMAND_FOCUS;
      if (hasSelection && isClearFocusKey) return;
      router.push("/");
    },
    [resolveAction, router],
  );
  useAction(ACTION_IDS.BACK_TO_HOME, "sheet", handleBackToHome);

  return (
    <>
      <SheetHelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />
      <HelpButton onClick={() => setHelpOpen(true)} />
      <SettingsButton onClick={() => setSettingsPanelOpen(true)} />
      <SettingsPanel
        isOpen={settingsPanelOpen}
        onClose={() => setSettingsPanelOpen(false)}
        settings={uiSettings}
        onSetColorMode={setColorMode}
        onToggleRandom={toggleRandom}
        onSetBorder={setBorder}
        onSetDirection={setDirection}
        onSetActivePanelTab={setActivePanelTab}
        onResetModern={resetModern}
      />
    </>
  );
}
