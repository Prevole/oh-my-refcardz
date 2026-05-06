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

  useKeyboardScope("settings", settingsPanelOpen);
  useKeyboardScope("help", helpOpen);

  const {
    settings: uiSettings,
    setColorMode,
    toggleRandom,
    setBorder,
    setDirection,
    toggleAccordion,
    resetModern,
  } = useUISettings();

  const { resolveAction } = useKeybindings();

  const handleGlobalKeyDown = useCallback(
    (event: KeyboardEvent) => {
      const tag = (event.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return;

      const matchedAction = resolveAction(event, [
        ACTION_IDS.TOGGLE_HELP,
        ACTION_IDS.TOGGLE_SETTINGS,
        ACTION_IDS.BACK_TO_HOME,
        ACTION_IDS.GO_TOP,
        ACTION_IDS.GO_BOTTOM,
        ACTION_IDS.CLEAR_COMMAND_FOCUS,
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
        if (document.querySelector("[data-command-modal-overlay]")) return;
        const hasSelection = document.querySelector("[data-copyable][data-nav-focused='true']");
        const isClearFocusKey = resolveAction(event, [ACTION_IDS.CLEAR_COMMAND_FOCUS]) === ACTION_IDS.CLEAR_COMMAND_FOCUS;
        if (hasSelection && isClearFocusKey) return;
        router.push("/");
      }
    },
    [resolveAction, router]
  );

  useScopedKeyboardHandler("global", handleGlobalKeyDown, [handleGlobalKeyDown]);

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
        onToggleAccordion={toggleAccordion}
        onResetModern={resetModern}
      />
    </>
  );
}
