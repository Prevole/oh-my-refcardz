"use client";

import { useCallback, useState } from "react";
import { Modal } from "@/components/ui/modal";
import { ArrowGlyph } from "@/components/ui/arrow-glyph";
import { HelpRow } from "@/components/settings/keybinding-display";
import { useScopedKeyboardHandler } from "@/hooks/use-keyboard-context";
import { ACTION_IDS } from "@/lib/keybindings";
import helpStyles from "./help-modal.module.css";
import keybindingStyles from "@/components/settings/keybinding-display.module.css";

type Props = {
  open: boolean;
  onClose: () => void;
};

type Tab = "shortcuts" | "legend";

export function SheetHelpModal({ open, onClose }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>("shortcuts");

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

      {/* Tabs */}
      <div className={helpStyles.tabs}>
        <button
          className={helpStyles.tab}
          data-active={activeTab === "shortcuts"}
          onClick={() => setActiveTab("shortcuts")}
        >
          App Shortcuts
        </button>
        <button
          className={helpStyles.tab}
          data-active={activeTab === "legend"}
          onClick={() => setActiveTab("legend")}
        >
          Symbol Legend
        </button>
      </div>

      {/* Tab: App Shortcuts */}
      <div className={helpStyles.tabContent} data-active={activeTab === "shortcuts"}>
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
              <HelpRow actionId={ACTION_IDS.BACK_TO_HOME} />
              <HelpRow actionId={ACTION_IDS.GO_TOP} />
            </tr>
            <tr>
              <HelpRow actionId={ACTION_IDS.GO_BOTTOM} />
              <td />
              <td />
            </tr>
          </tbody>
        </table>

        {/* Commands */}
        <h3 className="mt-6 text-xl font-semibold">Commands</h3>
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
              <HelpRow actionId={ACTION_IDS.COPY_COMMAND} />
              <HelpRow actionId={ACTION_IDS.SHOW_EXAMPLE} />
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
              <HelpRow actionId={ACTION_IDS.TOGGLE_HELP} />
              <HelpRow actionId={ACTION_IDS.TOGGLE_SETTINGS} />
            </tr>
          </tbody>
        </table>
      </div>

      {/* Tab: Symbol Legend */}
      <div className={helpStyles.tabContent} data-active={activeTab === "legend"}>
        <p className="mt-4 text-sm text-white/70">
          Symbols used in cheatsheet keybindings:
        </p>
        <table className={`${keybindingStyles.legendTable} mt-3`}>
          <colgroup>
            <col />
            <col />
            <col />
            <col />
          </colgroup>
          <tbody>
            <tr>
              <td><span className={keybindingStyles.legendKeycapSheet}>⌘</span></td>
              <td>Command</td>
              <td><span className={keybindingStyles.legendKeycapSheet}>⌥</span></td>
              <td>Option</td>
            </tr>
            <tr>
              <td><span className={keybindingStyles.legendKeycapSheet}>^</span></td>
              <td>Control</td>
              <td><span className={keybindingStyles.legendKeycapSheet}>⇧</span></td>
              <td>Shift</td>
            </tr>
            <tr>
              <td><span className={keybindingStyles.legendKeycapSheet}>↩</span></td>
              <td>Enter</td>
              <td><span className={keybindingStyles.legendKeycapSheet}><span className="small-caps">esc</span></span></td>
              <td>Escape</td>
            </tr>
            <tr>
              <td><span className={keybindingStyles.legendKeycapSheet}><ArrowGlyph direction="left" className={keybindingStyles.legendArrow} /></span></td>
              <td>Arrow left</td>
              <td><span className={keybindingStyles.legendKeycapSheet}><ArrowGlyph direction="up" className={keybindingStyles.legendArrow} /></span></td>
              <td>Arrow up</td>
            </tr>
            <tr>
              <td><span className={keybindingStyles.legendKeycapSheet}><ArrowGlyph direction="down" className={keybindingStyles.legendArrow} /></span></td>
              <td>Arrow down</td>
              <td><span className={keybindingStyles.legendKeycapSheet}><ArrowGlyph direction="right" className={keybindingStyles.legendArrow} /></span></td>
              <td>Arrow right</td>
            </tr>
          </tbody>
        </table>
      </div>

      <p className="mt-6 text-xs text-white/75">
        Press <span className="font-mono">?</span> to toggle,{" "}
        <span className="font-mono">Esc</span> to close.
      </p>
    </Modal>
  );
}
