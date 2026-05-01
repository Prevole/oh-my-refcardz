"use client";

import { useCallback } from "react";
import { Modal } from "@/components/ui/modal";
import { HelpRow } from "@/components/settings/keybinding-display";
import { useScopedKeyboardHandler } from "@/hooks/use-keyboard-context";
import { ACTION_IDS } from "@/lib/keybindings";
import keybindingStyles from "@/components/settings/keybinding-display.module.css";

type Props = {
  open: boolean;
  onClose: () => void;
};

export function HomeHelpModal({ open, onClose }: Props) {
  // Handle Escape key to close modal (only when help scope is active)
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === "Escape" || event.key === "?") {
        event.preventDefault();
        onClose();
      }
    },
    [onClose]
  );

  useScopedKeyboardHandler("help", handleKeyDown, [handleKeyDown]);

  return (
    <Modal open={open} onClose={onClose} className="max-w-2xl">
      <p className="font-mono text-xs tracking-[0.15em] text-white/70">
        KEYBOARD SHORTCUTS
      </p>

      {/* Navigation */}
      <h3 className="mt-4 text-xl font-semibold">Navigation</h3>
      <table className={`${keybindingStyles.legendTable} mt-3`}>
        <colgroup>
          <col />
          <col />
          <col />
          <col />
        </colgroup>
        <tbody>
          <tr>
            <HelpRow actionId={ACTION_IDS.MOVE_LEFT} />
            <HelpRow actionId={ACTION_IDS.MOVE_RIGHT} />
          </tr>
          <tr>
            <HelpRow actionId={ACTION_IDS.MOVE_DOWN} />
            <HelpRow actionId={ACTION_IDS.MOVE_UP} />
          </tr>
          <tr>
            <HelpRow actionId={ACTION_IDS.OPEN_SHEET} />
            <td />
            <td />
          </tr>
        </tbody>
      </table>

      {/* Search */}
      <h3 className="mt-6 text-xl font-semibold">Search</h3>
      <table className={`${keybindingStyles.legendTable} mt-3`}>
        <colgroup>
          <col />
          <col />
          <col />
          <col />
        </colgroup>
        <tbody>
          <tr>
            <HelpRow actionId={ACTION_IDS.FOCUS_SEARCH} />
            <HelpRow actionId={ACTION_IDS.CLEAR_SEARCH} />
          </tr>
        </tbody>
      </table>

      {/* Misc */}
      <h3 className="mt-6 text-xl font-semibold">Misc</h3>
      <table className={`${keybindingStyles.legendTable} mt-3`}>
        <colgroup>
          <col />
          <col />
          <col />
          <col />
        </colgroup>
        <tbody>
          <tr>
            <HelpRow actionId={ACTION_IDS.TOGGLE_INFO} />
            <HelpRow actionId={ACTION_IDS.TOGGLE_HELP} />
          </tr>
          <tr>
            <HelpRow actionId={ACTION_IDS.TOGGLE_SETTINGS} />
            <td />
            <td />
          </tr>
        </tbody>
      </table>

      <p className="mt-6 text-xs text-white/75">
        Press <span className="font-mono">?</span> to toggle,{" "}
        <span className="font-mono">Esc</span> to close.
      </p>
    </Modal>
  );
}
