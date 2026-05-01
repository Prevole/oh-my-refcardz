"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { SheetHelpModal } from "@/components/sheet-help-modal";
import { HelpButton } from "@/components/help-button";
import { SettingsButton } from "@/components/settings-button";
import { SettingsPanel } from "@/components/settings-panel";
import { useUISettings } from "@/hooks/use-ui-settings";
import { useKeyboardScope, useScopedKeyboardHandler } from "@/hooks/use-keyboard-context";

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
    resetAll,
  } = useUISettings();

  // Global keyboard shortcuts for sheet page (only active when no panel is open)
  const handleGlobalKeyDown = useCallback(
    (event: KeyboardEvent) => {
      // Never hijack keys when focus is inside an editable element
      const tag = (event.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return;

      if (event.key === "?") {
        event.preventDefault();
        setHelpOpen(true);
        return;
      }

      if (event.key === ",") {
        event.preventDefault();
        setSettingsPanelOpen(true);
        return;
      }

      if (event.key === "Escape" || event.key === "Backspace") {
        event.preventDefault();
        // If a command modal is open, let it handle Escape itself
        if (document.querySelector(".command-modal-overlay")) return;
        router.push("/");
      }
    },
    [router]
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
        onResetAll={resetAll}
      />
    </>
  );
}
