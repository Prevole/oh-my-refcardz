"use client";

import { useCallback, useState } from "react";
import { Modal } from "@/components/ui/modal";
import { ArrowGlyph } from "@/components/ui/arrow-glyph";
import { KeybindingChart, type ChartEntry } from "@/components/help/keybinding-chart";
import { Collapsible } from "@/components/help/collapsible";
import { Tabs } from "@/components/settings/tabs";
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
type LayoutSubTab = "lifecycle" | "navigation" | "move" | "resize";
type DeveloperSubTab = "dev" | "logs" | "axes";

const TABS: { id: Tab; label: string }[] = [
  { id: "shortcuts", label: "App Shortcuts" },
  { id: "layout", label: "Layout" },
  { id: "developer", label: "Developer" },
  { id: "legend", label: "Symbol Legend" },
];

const LAYOUT_SUB_TABS: { id: LayoutSubTab; label: string }[] = [
  { id: "lifecycle", label: "Lifecycle" },
  { id: "navigation", label: "Navigation" },
  { id: "move", label: "Move" },
  { id: "resize", label: "Resize" },
];

const DEVELOPER_SUB_TABS: { id: DeveloperSubTab; label: string }[] = [
  { id: "dev", label: "Dev" },
  { id: "logs", label: "Logs" },
  { id: "axes", label: "Axes" },
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

const LAYOUT_LIFECYCLE_ENTRIES: (ChartEntry | null)[] = [
  { id: ACTION_IDS.LAYOUT_ENTER_MODE },
  { id: ACTION_IDS.LAYOUT_GOTO_NAVIGATION },
  { id: ACTION_IDS.RESET_LAYOUT },
  { id: ACTION_IDS.LAYOUT_GOTO_MOVE },
  null,
  { id: ACTION_IDS.LAYOUT_GOTO_RESIZE },
];

const LAYOUT_NAV_ENTRIES: ChartEntry[] = [
  { id: ACTION_IDS.LAYOUT_NAV_LEFT, label: "Focus card left" },
  { id: ACTION_IDS.LAYOUT_NAV_RIGHT, label: "Focus card right" },
  { id: ACTION_IDS.LAYOUT_NAV_UP, label: "Focus card above" },
  { id: ACTION_IDS.LAYOUT_NAV_DOWN, label: "Focus card below" },
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
];

const LAYOUT_RESIZE_ADVANCED_ENTRIES: ChartEntry[] = [
  { id: ACTION_IDS.LAYOUT_RESIZE_GROW_STRICT_LEFT },
  { id: ACTION_IDS.LAYOUT_RESIZE_GROW_STRICT_RIGHT },
  { id: ACTION_IDS.LAYOUT_RESIZE_GROW_STRICT_UP },
  { id: ACTION_IDS.LAYOUT_RESIZE_GROW_STRICT_DOWN },
  { id: ACTION_IDS.LAYOUT_RESIZE_SHRINK_STRICT_LEFT },
  { id: ACTION_IDS.LAYOUT_RESIZE_SHRINK_STRICT_RIGHT },
  { id: ACTION_IDS.LAYOUT_RESIZE_SHRINK_STRICT_UP },
  { id: ACTION_IDS.LAYOUT_RESIZE_SHRINK_STRICT_DOWN },
  { id: ACTION_IDS.LAYOUT_RESIZE_SHRINK_COMPACT_LEFT },
  { id: ACTION_IDS.LAYOUT_RESIZE_SHRINK_COMPACT_RIGHT },
  { id: ACTION_IDS.LAYOUT_RESIZE_SHRINK_COMPACT_UP },
  { id: ACTION_IDS.LAYOUT_RESIZE_SHRINK_COMPACT_DOWN },
];

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
  const [layoutSubTab, setLayoutSubTab] = useState<LayoutSubTab>("lifecycle");
  const [developerSubTab, setDeveloperSubTab] = useState<DeveloperSubTab>("dev");
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
          <Tabs
            tabs={LAYOUT_SUB_TABS}
            activeTab={layoutSubTab}
            onChange={(id) => setLayoutSubTab(id as LayoutSubTab)}
            testIdPrefix="help-layout-sub-tab"
            variant="secondary"
          />

          {layoutSubTab === "lifecycle" && (
            <div data-testid="help-layout-content-lifecycle">
              <div className={helpStyles.layoutSection}>
                <h3 className="text-xl font-semibold">Lifecycle</h3>
                <p className={helpStyles.layoutSectionIntro}>
                  Enter the modal layout editor and switch between its sub-modes (navigation, move, resize). Reset discards your customizations and restores the layout shipped with the cheatsheet.
                </p>
                <KeybindingChart entries={LAYOUT_LIFECYCLE_ENTRIES} cols={2} />
              </div>
            </div>
          )}

          {layoutSubTab === "navigation" && (
            <div data-testid="help-layout-content-navigation">
              <div className={helpStyles.layoutSection}>
                <h3 className="text-xl font-semibold">Navigation Sub-Mode</h3>
                <p className={helpStyles.layoutSectionIntro}>
                  Move the focus between blocks. See <em>Lifecycle</em> to switch to move or resize.
                </p>
                <KeybindingChart entries={LAYOUT_NAV_ENTRIES} />
              </div>
            </div>
          )}

          {layoutSubTab === "move" && (
            <div data-testid="help-layout-content-move">
              <div className={helpStyles.layoutSection}>
                <h3 className="text-xl font-semibold">Move Sub-Mode</h3>
                <p className={helpStyles.layoutSectionIntro}>
                  Move the focused block by one grid cell at a time. Strict variants refuse any wrap or push. See <em>Lifecycle</em> to switch to another sub-mode.
                </p>
                <KeybindingChart entries={LAYOUT_MOVE_ENTRIES} />
              </div>
            </div>
          )}

          {layoutSubTab === "resize" && (
            <div data-testid="help-layout-content-resize">
              <div className={helpStyles.layoutSection}>
                <h3 className="text-xl font-semibold">Resize Sub-Mode</h3>
                <p className={helpStyles.layoutSectionIntro}>
                  Grow or shrink the focused block. Each direction and each variant has its own binding. See <em>Lifecycle</em> to switch to another sub-mode.
                </p>
                <KeybindingChart entries={LAYOUT_RESIZE_ENTRIES} />
                <Collapsible summary="Show advanced variants">
                  <p className={helpStyles.layoutSectionIntro}>
                    Strict variants refuse any wrap or push. Compact variants pull neighbours inward when shrinking.
                  </p>
                  <KeybindingChart entries={LAYOUT_RESIZE_ADVANCED_ENTRIES} />
                </Collapsible>
              </div>
            </div>
          )}
        </div>

        <div className={helpStyles.tabContent} data-active={activeTab === "developer"} data-testid="help-content-developer">
          <Tabs
            tabs={DEVELOPER_SUB_TABS}
            activeTab={developerSubTab}
            onChange={(id) => setDeveloperSubTab(id as DeveloperSubTab)}
            testIdPrefix="help-developer-sub-tab"
            variant="secondary"
          />

          {developerSubTab === "dev" && (
            <div data-testid="help-developer-content-dev">
              <div className={helpStyles.layoutSection}>
                <h3 className="text-xl font-semibold">Developer Mode</h3>
                <p className={helpStyles.layoutSectionIntro}>
                  Toggle Developer Mode to access the recording overlay, logs dropdown, and axes inspector. These shortcuts are active once Developer Mode is open.
                </p>
                <KeybindingChart entries={DEVELOPER_TOP_ENTRIES} />
              </div>
            </div>
          )}

          {developerSubTab === "logs" && (
            <div data-testid="help-developer-content-logs">
              <div className={helpStyles.layoutSection}>
                <h3 className="text-xl font-semibold">Logs Sub-Mode</h3>
                <p className={helpStyles.layoutSectionIntro}>
                  Active while the logs dropdown is open. Navigate, copy filenames, refresh, or delete recordings.
                </p>
                <KeybindingChart entries={DEVELOPER_LOGS_ENTRIES} />
              </div>
            </div>
          )}

          {developerSubTab === "axes" && (
            <div data-testid="help-developer-content-axes">
              <div className={helpStyles.layoutSection}>
                <h3 className="text-xl font-semibold">Axes Sub-Mode</h3>
                <p className={helpStyles.layoutSectionIntro}>
                  Active while inspecting the grid axes. Move the cursor and toggle columns or rows on and off.
                </p>
                <KeybindingChart entries={DEVELOPER_AXES_ENTRIES} />
              </div>
            </div>
          )}
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
