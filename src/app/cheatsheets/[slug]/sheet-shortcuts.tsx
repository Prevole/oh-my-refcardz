"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { SheetHelpModal } from "@/components/help/sheet-help-modal";
import { HelpButton } from "@/components/help/help-button";
import { SettingsButton } from "@/components/settings/settings-button";
import { SettingsPanel } from "@/components/settings/settings-panel";
import { useUISettings } from "@/hooks/use-ui-settings";
import { useKeybindings } from "@/hooks/use-keybindings";
import { useKeyboardScope, useScopedKeyboardHandler } from "@/hooks/use-keyboard-context";
import { ACTION_IDS } from "@/lib/keybindings";

export function SheetShortcuts() {
  const router = useRouter();
  const [helpOpen, setHelpOpen] = useState(false);
  const [settingsPanelOpen, setSettingsPanelOpen] = useState(false);

  // Keyboard context scopes - panels push their scope when open
  useKeyboardScope("settings", settingsPanelOpen);
  useKeyboardScope("help", helpOpen);

  // UI Settings
  const {
    settings: uiSettings,
    setColorMode,
    toggleRandom,
    setBorder,
    setDirection,
    toggleAccordion,
    resetModern,
  } = useUISettings();

  // Keybindings
  const { resolveAction } = useKeybindings();

  // Global keyboard shortcuts for sheet page (only active when no panel is open)
  const handleGlobalKeyDown = useCallback(
    (event: KeyboardEvent) => {
      // Never hijack keys when focus is inside an editable element
      const tag = (event.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return;

      const matchedAction = resolveAction(event, [
        ACTION_IDS.TOGGLE_HELP,
        ACTION_IDS.TOGGLE_SETTINGS,
        ACTION_IDS.BACK_TO_HOME,
        ACTION_IDS.GO_TOP,
        ACTION_IDS.GO_BOTTOM,
      ]);

      if (matchedAction === ACTION_IDS.TOGGLE_HELP) {
        event.preventDefault();
        setHelpOpen(true);
        return;
      }

      if (matchedAction === ACTION_IDS.TOGGLE_SETTINGS) {
        event.preventDefault();
        setSettingsPanelOpen(true);
        return;
      }

      if (matchedAction === ACTION_IDS.GO_TOP) {
        event.preventDefault();
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }

      if (matchedAction === ACTION_IDS.GO_BOTTOM) {
        event.preventDefault();
        window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "smooth" });
        return;
      }

      if (matchedAction === ACTION_IDS.BACK_TO_HOME) {
        event.preventDefault();
        // If a command modal is open, let it handle Escape itself
        if (document.querySelector("[data-command-modal-overlay]")) return;
        router.push("/");
      }
    },
    [resolveAction, router]
  );

  useScopedKeyboardHandler("global", handleGlobalKeyDown, [handleGlobalKeyDown]);

  return (
    <>
      {/* Help Modal */}
      <SheetHelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />

      {/* Help Button */}
      <HelpButton onClick={() => setHelpOpen(true)} />

      {/* Settings Button */}
      <SettingsButton onClick={() => setSettingsPanelOpen(true)} />

      {/* Settings Panel */}
      <SettingsPanel
        isOpen={settingsPanelOpen}
        onClose={() => setSettingsPanelOpen(false)}
        settings={uiSettings}
        onSetColorMode={setColorMode}
        onToggleRandom={toggleRandom}
        onSetBorder={setBorder}
        onSetDirection={setDirection}
        onToggleAccordion={toggleAccordion}
        onResetModern={resetModern}
      />
    </>
  );
}
