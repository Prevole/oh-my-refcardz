"use client";

import { useCallback, useState } from "react";
import { Modal } from "@/components/ui/modal";
import { ArrowGlyph } from "@/components/ui/arrow-glyph";
import { KeybindingChart, type ChartEntry } from "@/components/help/keybinding-chart";
import { useScopedKeyboardHandler } from "@/hooks/use-keyboard-context";
import { ACTION_IDS, getCombosDisplay } from "@/lib/keybindings";
import { useActionCombos } from "@/components/settings/keybinding-display";
import helpStyles from "./help-modal.module.css";
import keybindingStyles from "@/components/settings/keybinding-display.module.css";

type Props = {
  open: boolean;
  onClose: () => void;
};

type Tab = "shortcuts" | "layout" | "developer" | "legend";

const TABS: { id: Tab; label: string }[] = [
  { id: "shortcuts", label: "App Shortcuts" },
  { id: "layout", label: "Layout" },
  { id: "developer", label: "Developer" },
  { id: "legend", label: "Symbol Legend" },
];

// ---- Shortcuts tab data -------------------------------------------------

const NAVIGATION_ENTRIES: ChartEntry[] = [
  { id: ACTION_IDS.MOVE_LEFT },
  { id: ACTION_IDS.MOVE_RIGHT },
  { id: ACTION_IDS.MOVE_DOWN },
  { id: ACTION_IDS.MOVE_UP },
  { id: ACTION_IDS.CLEAR_COMMAND_FOCUS },
  { id: ACTION_IDS.BACK_TO_HOME },
  { id: ACTION_IDS.GO_TOP },
  { id: ACTION_IDS.GO_BOTTOM },
];

const ACTION_ENTRIES: ChartEntry[] = [
  { id: ACTION_IDS.COPY_COMMAND },
  { id: ACTION_IDS.SHOW_EXAMPLE },
];

const MISC_ENTRIES: ChartEntry[] = [
  { id: ACTION_IDS.TOGGLE_HELP },
  { id: ACTION_IDS.TOGGLE_SETTINGS },
];

// ---- Layout tab data ----------------------------------------------------

const LAYOUT_ENTER_ENTRIES: ChartEntry[] = [{ id: ACTION_IDS.LAYOUT_ENTER_MODE }];

const LAYOUT_NAV_ENTRIES: ChartEntry[] = [
  { id: ACTION_IDS.LAYOUT_NAV_LEFT, label: "Focus card left" },
  { id: ACTION_IDS.LAYOUT_NAV_RIGHT, label: "Focus card right" },
  { id: ACTION_IDS.LAYOUT_NAV_UP, label: "Focus card above" },
  { id: ACTION_IDS.LAYOUT_NAV_DOWN, label: "Focus card below" },
  { id: ACTION_IDS.LAYOUT_GOTO_MOVE },
  { id: ACTION_IDS.LAYOUT_GOTO_RESIZE },
];

const LAYOUT_MOVE_ENTRIES: ChartEntry[] = [
  { id: ACTION_IDS.LAYOUT_MOVE_LEFT },
  { id: ACTION_IDS.LAYOUT_MOVE_RIGHT },
  { id: ACTION_IDS.LAYOUT_MOVE_UP },
  { id: ACTION_IDS.LAYOUT_MOVE_DOWN },
  { id: ACTION_IDS.LAYOUT_MOVE_STRICT_LEFT },
  { id: ACTION_IDS.LAYOUT_MOVE_STRICT_RIGHT },
  { id: ACTION_IDS.LAYOUT_MOVE_STRICT_UP },
  { id: ACTION_IDS.LAYOUT_MOVE_STRICT_DOWN },
  { id: ACTION_IDS.LAYOUT_GOTO_NAVIGATION },
  { id: ACTION_IDS.LAYOUT_GOTO_RESIZE },
];

const LAYOUT_RESIZE_ENTRIES: ChartEntry[] = [
  { id: ACTION_IDS.LAYOUT_RESIZE_GROW_LEFT },
  { id: ACTION_IDS.LAYOUT_RESIZE_GROW_RIGHT },
  { id: ACTION_IDS.LAYOUT_RESIZE_GROW_UP },
  { id: ACTION_IDS.LAYOUT_RESIZE_GROW_DOWN },
  { id: ACTION_IDS.LAYOUT_RESIZE_SHRINK_LEFT },
  { id: ACTION_IDS.LAYOUT_RESIZE_SHRINK_RIGHT },
  { id: ACTION_IDS.LAYOUT_RESIZE_SHRINK_UP },
  { id: ACTION_IDS.LAYOUT_RESIZE_SHRINK_DOWN },
  { id: ACTION_IDS.LAYOUT_GOTO_NAVIGATION },
  { id: ACTION_IDS.LAYOUT_GOTO_MOVE },
];

const LAYOUT_RESET_ENTRIES: ChartEntry[] = [{ id: ACTION_IDS.RESET_LAYOUT }];

// ---- Developer tab data -------------------------------------------------

const DEVELOPER_TOP_ENTRIES: ChartEntry[] = [
  { id: ACTION_IDS.TOGGLE_DEVELOPER_MODE },
  { id: ACTION_IDS.DEV_SAVE_LAYOUT },
  { id: ACTION_IDS.DEV_RESET_LAYOUT },
  { id: ACTION_IDS.DEV_TOGGLE_RECORDING },
  { id: ACTION_IDS.DEV_TOGGLE_LOGS },
  { id: ACTION_IDS.DEV_ENTER_AXES_MODE },
];

const DEVELOPER_LOGS_ENTRIES: ChartEntry[] = [
  { id: ACTION_IDS.DEV_LOGS_CURSOR_DOWN },
  { id: ACTION_IDS.DEV_LOGS_CURSOR_UP },
  { id: ACTION_IDS.DEV_LOGS_COPY_FILENAME },
  { id: ACTION_IDS.DEV_LOGS_REFRESH },
  { id: ACTION_IDS.DEV_LOGS_DELETE },
  { id: ACTION_IDS.DEV_LOGS_DELETE_ALL },
  { id: ACTION_IDS.DEV_LOGS_CLOSE },
];

const DEVELOPER_AXES_ENTRIES: ChartEntry[] = [
  { id: ACTION_IDS.DEV_AXES_CURSOR_LEFT },
  { id: ACTION_IDS.DEV_AXES_CURSOR_RIGHT },
  { id: ACTION_IDS.DEV_AXES_CURSOR_UP },
  { id: ACTION_IDS.DEV_AXES_CURSOR_DOWN },
  { id: ACTION_IDS.DEV_AXES_TOGGLE_COL },
  { id: ACTION_IDS.DEV_AXES_TOGGLE_ROW },
  { id: ACTION_IDS.DEV_AXES_CLEAR_ALL },
  { id: ACTION_IDS.DEV_AXES_EXIT },
];

export function SheetHelpModal({ open, onClose }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>("shortcuts");
  const toggleHelpCombos = useActionCombos(ACTION_IDS.TOGGLE_HELP);
  const toggleHelpDisplay = getCombosDisplay(toggleHelpCombos);

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
    <Modal open={open} onClose={onClose} className="flex h-[min(80vh,44rem)] max-w-4xl flex-col">
      <p className="font-mono text-xs tracking-[0.15em] text-white/70">HELP</p>

      <div className={helpStyles.tabs}>
        {TABS.map((tab) => (
          <button
            key={tab.id}
            className={helpStyles.tab}
            data-active={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
            data-testid={`help-tab-${tab.id}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className={helpStyles.panel}>
        <div className={helpStyles.tabContent} data-active={activeTab === "shortcuts"} data-testid="help-content-shortcuts">
          <div className={helpStyles.layoutSection}>
            <h3 className="text-xl font-semibold">Navigation</h3>
            <p className={helpStyles.layoutSectionIntro}>
              Move around the cheatsheet, jump through the page, or return to the grid without reaching for the mouse.
            </p>
            <KeybindingChart entries={NAVIGATION_ENTRIES} />
          </div>

          <div className={helpStyles.layoutSection}>
            <h3 className="text-xl font-semibold">Actions</h3>
            <p className={helpStyles.layoutSectionIntro}>
              Copy commands and inspect details while staying in flow.
            </p>
            <KeybindingChart entries={ACTION_ENTRIES} />
          </div>

          <div className={helpStyles.layoutSection}>
            <h3 className="text-xl font-semibold">Misc</h3>
            <p className={helpStyles.layoutSectionIntro}>
              Open supporting panels and reference surfaces from anywhere in the page.
            </p>
            <KeybindingChart entries={MISC_ENTRIES} />
          </div>
        </div>

        <div className={helpStyles.tabContent} data-active={activeTab === "layout"} data-testid="help-content-layout">
          <div className={helpStyles.layoutSection}>
            <h3 className="text-xl font-semibold">Enter Layout Mode</h3>
            <p className={helpStyles.layoutSectionIntro}>
              Press the shortcut below to enter the modal layout editor. The mode opens in <em>navigation</em> by default; press <kbd>m</kbd> for move or <kbd>r</kbd> for resize, and <kbd>Esc</kbd> to leave.
            </p>
            <KeybindingChart entries={LAYOUT_ENTER_ENTRIES} cols={1} />
          </div>

          <div className={helpStyles.layoutSection}>
            <h3 className="text-xl font-semibold">Navigation Sub-Mode</h3>
            <p className={helpStyles.layoutSectionIntro}>
              Move the focus between blocks. Press <kbd>m</kbd> to switch to move, <kbd>r</kbd> to switch to resize.
            </p>
            <KeybindingChart entries={LAYOUT_NAV_ENTRIES} />
          </div>

          <div className={helpStyles.layoutSection}>
            <h3 className="text-xl font-semibold">Move Sub-Mode</h3>
            <p className={helpStyles.layoutSectionIntro}>
              Move the focused block by one grid cell at a time. Add <kbd>Alt</kbd> to refuse any wrap or push (strict move).
            </p>
            <KeybindingChart entries={LAYOUT_MOVE_ENTRIES} />
          </div>

          <div className={helpStyles.layoutSection}>
            <h3 className="text-xl font-semibold">Resize Sub-Mode</h3>
            <p className={helpStyles.layoutSectionIntro}>
              Grow or shrink the focused block. Plain <kbd>h/j/k/l</kbd> grows the matching edge; with <kbd>Shift</kbd> they shrink it. <kbd>Alt</kbd> enforces strict resizes (no wrap/push); <kbd>Ctrl+Shift</kbd> pulls neighbors in (compact shrink).
            </p>
            <KeybindingChart entries={LAYOUT_RESIZE_ENTRIES} />
          </div>

          <div className={helpStyles.layoutSection}>
            <h3 className="text-xl font-semibold">Reset</h3>
            <p className={helpStyles.layoutSectionIntro}>
              Discard your customizations and return to the original layout shipped with the cheatsheet.
            </p>
            <KeybindingChart entries={LAYOUT_RESET_ENTRIES} cols={1} />
          </div>
        </div>

        <div className={helpStyles.tabContent} data-active={activeTab === "developer"} data-testid="help-content-developer">
          <div className={helpStyles.layoutSection}>
            <h3 className="text-xl font-semibold">Developer Mode</h3>
            <p className={helpStyles.layoutSectionIntro}>
              Toggle Developer Mode to access the recording overlay, logs dropdown, and axes inspector. These shortcuts are active once Developer Mode is open.
            </p>
            <KeybindingChart entries={DEVELOPER_TOP_ENTRIES} />
          </div>

          <div className={helpStyles.layoutSection}>
            <h3 className="text-xl font-semibold">Logs Sub-Mode</h3>
            <p className={helpStyles.layoutSectionIntro}>
              Active while the logs dropdown is open. Navigate, copy filenames, refresh, or delete recordings.
            </p>
            <KeybindingChart entries={DEVELOPER_LOGS_ENTRIES} />
          </div>

          <div className={helpStyles.layoutSection}>
            <h3 className="text-xl font-semibold">Axes Sub-Mode</h3>
            <p className={helpStyles.layoutSectionIntro}>
              Active while inspecting the grid axes. Move the cursor and toggle columns or rows on and off.
            </p>
            <KeybindingChart entries={DEVELOPER_AXES_ENTRIES} />
          </div>
        </div>

        <div className={helpStyles.tabContent} data-active={activeTab === "legend"} data-testid="help-content-legend">
          <div className={helpStyles.layoutSection}>
            <h3 className="text-xl font-semibold">Symbols</h3>
            <p className={helpStyles.layoutSectionIntro}>
              Reference symbols used across keybindings and shortcut displays in the app.
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
        </div>
      </div>

      <p className={`${helpStyles.footer} text-xs text-white/75`}>
        <span className={`${helpStyles.inlineBinding} font-mono`}>
          {toggleHelpDisplay.join(" or ")}
        </span>{" "}
        or <span className={`${helpStyles.inlineBinding} font-mono`}>Esc</span> to close.
      </p>
    </Modal>
  );
}
