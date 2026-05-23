"use client";

import { useCallback, useMemo, useState } from "react";
import { Modal } from "@/components/ui/modal";
import { ArrowGlyph } from "@/components/ui/arrow-glyph";
import { KeybindingChart, type ChartEntry } from "@/components/help/keybinding-chart";
import { Tabs } from "@/components/settings/tabs";
import { useScopedKeyboardHandler } from "@/hooks/use-keyboard-context";
import { useKeybindings } from "@/hooks/use-keybindings";
import { ACTION_IDS, getCombosDisplay } from "@/lib/keybindings";
import { useActionCombos } from "@/components/settings/keybinding-display";
import helpStyles from "./help-modal.module.css";
import keybindingStyles from "@/components/settings/keybinding-display.module.css";

type Props = {
  open: boolean;
  onClose: () => void;
};

type Tab = "general" | "layout" | "developer" | "legend" | "help";
type GeneralSubTab = "navigation" | "misc";
type LayoutSubTab = "lifecycle" | "navigation" | "move" | "resize";
type DeveloperSubTab = "dev" | "logs" | "axes";

const TABS: { id: Tab; label: string }[] = [
  { id: "general", label: "General" },
  { id: "layout", label: "Layout" },
  { id: "developer", label: "Developer" },
  { id: "help", label: "Help" },
  { id: "legend", label: "Legend" },
];

const GENERAL_SUB_TABS: { id: GeneralSubTab; label: string }[] = [
  { id: "navigation", label: "Navigation" },
  { id: "misc", label: "Misc" },
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

// ---- General tab data ---------------------------------------------------

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

// ---- Help tab data ------------------------------------------------------

const HELP_NAVIGATION_ENTRIES: ChartEntry[] = [
  { id: ACTION_IDS.HELP_TAB_LEFT, label: "Focus previous tab" },
  { id: ACTION_IDS.HELP_TAB_RIGHT, label: "Focus next tab" },
  { id: ACTION_IDS.HELP_TAB_UP, label: "Focus parent tab row" },
  { id: ACTION_IDS.HELP_TAB_DOWN, label: "Focus sub-tab row" },
  { id: ACTION_IDS.HELP_TAB_ACTIVATE, label: "Activate focused tab" },
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
  const [activeTab, setActiveTab] = useState<Tab>("general");
  const [generalSubTab, setGeneralSubTab] = useState<GeneralSubTab>("navigation");
  const [layoutSubTab, setLayoutSubTab] = useState<LayoutSubTab>("lifecycle");
  const [developerSubTab, setDeveloperSubTab] = useState<DeveloperSubTab>("dev");
  const [focus, setFocus] = useState<{ row: "L1" | "L2"; index: number }>({ row: "L1", index: 0 });
  const toggleHelpCombos = useActionCombos(ACTION_IDS.TOGGLE_HELP);
  const toggleHelpDisplay = getCombosDisplay(toggleHelpCombos);
  const { matchesAction } = useKeybindings();

  // Resolve which L2 row (if any) is currently visible.
  const visibleL2 = useMemo(
    () =>
      activeTab === "general"
        ? { tabs: GENERAL_SUB_TABS as readonly { id: string; label: string }[], activeId: generalSubTab as string }
        : activeTab === "layout"
          ? { tabs: LAYOUT_SUB_TABS as readonly { id: string; label: string }[], activeId: layoutSubTab as string }
          : activeTab === "developer"
            ? { tabs: DEVELOPER_SUB_TABS as readonly { id: string; label: string }[], activeId: developerSubTab as string }
            : null,
    [activeTab, generalSubTab, layoutSubTab, developerSubTab]
  );

  // Reset focus to the active L1 tab whenever the modal opens. We use the
  // "state mirror" pattern (https://react.dev/reference/react/useState#storing-information-from-previous-renders):
  // tracking the previous `open` value as state and reacting to its change
  // synchronously during render.
  const [prevOpen, setPrevOpen] = useState(open);
  if (prevOpen !== open) {
    setPrevOpen(open);
    if (open) {
      const activeIndex = TABS.findIndex((t) => t.id === activeTab);
      setFocus({ row: "L1", index: activeIndex >= 0 ? activeIndex : 0 });
    }
  }

  // If the L2 row disappears while focus was inside it, bubble focus back to L1.
  if (focus.row === "L2" && !visibleL2) {
    const parentIndex = TABS.findIndex((t) => t.id === activeTab);
    setFocus({ row: "L1", index: parentIndex >= 0 ? parentIndex : 0 });
  }

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === "Escape" || event.key === "?") {
        event.preventDefault();
        onClose();
        return;
      }

      if (matchesAction(event, ACTION_IDS.HELP_TAB_LEFT)) {
        event.preventDefault();
        setFocus((prev) => {
          const len = prev.row === "L1" ? TABS.length : visibleL2?.tabs.length ?? 0;
          if (len === 0) return prev;
          return { ...prev, index: (prev.index - 1 + len) % len };
        });
        return;
      }

      if (matchesAction(event, ACTION_IDS.HELP_TAB_RIGHT)) {
        event.preventDefault();
        setFocus((prev) => {
          const len = prev.row === "L1" ? TABS.length : visibleL2?.tabs.length ?? 0;
          if (len === 0) return prev;
          return { ...prev, index: (prev.index + 1) % len };
        });
        return;
      }

      if (matchesAction(event, ACTION_IDS.HELP_TAB_UP)) {
        event.preventDefault();
        setFocus((prev) => {
          if (prev.row === "L1") return prev;
          // From L2, return to the L1 parent (the currently active L1 tab,
          // since the visible L2 row always belongs to it).
          const parentIndex = TABS.findIndex((t) => t.id === activeTab);
          return { row: "L1", index: parentIndex >= 0 ? parentIndex : 0 };
        });
        return;
      }

      if (matchesAction(event, ACTION_IDS.HELP_TAB_DOWN)) {
        event.preventDefault();
        setFocus((prev) => {
          if (prev.row === "L2") return prev;
          // Descend whenever an L2 row is visible (i.e. the active L1 is
          // Layout or Developer), regardless of which L1 tab is focused.
          // Focus lands on the L2 tab currently active in the visible row.
          if (!visibleL2) return prev;
          const activeL2Index = visibleL2.tabs.findIndex((t) => t.id === visibleL2.activeId);
          return { row: "L2", index: activeL2Index >= 0 ? activeL2Index : 0 };
        });
        return;
      }

      if (matchesAction(event, ACTION_IDS.HELP_TAB_ACTIVATE)) {
        event.preventDefault();
        if (focus.row === "L1") {
          const tab = TABS[focus.index];
          if (tab) setActiveTab(tab.id);
        } else if (visibleL2) {
          const sub = visibleL2.tabs[focus.index];
          if (sub) {
            if (activeTab === "general") setGeneralSubTab(sub.id as GeneralSubTab);
            else if (activeTab === "layout") setLayoutSubTab(sub.id as LayoutSubTab);
            else if (activeTab === "developer") setDeveloperSubTab(sub.id as DeveloperSubTab);
          }
        }
        return;
      }
    },
    [onClose, matchesAction, visibleL2, activeTab, focus]
  );

  useScopedKeyboardHandler("help", handleKeyDown, [handleKeyDown]);

  return (
    <Modal open={open} onClose={onClose} className="flex h-[min(80vh,44rem)] max-w-4xl flex-col">
      <p className="font-mono text-xs tracking-[0.15em] text-white/70">HELP</p>

      <div className={helpStyles.tabs}>
        {TABS.map((tab, idx) => (
          <button
            key={tab.id}
            className={helpStyles.tab}
            data-active={activeTab === tab.id}
            data-focused={focus.row === "L1" && focus.index === idx || undefined}
            data-position={tab.id === "legend" ? "end" : undefined}
            onClick={() => {
              setActiveTab(tab.id);
              setFocus({ row: "L1", index: idx });
            }}
            data-testid={`help-tab-${tab.id}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className={helpStyles.panel}>
        <div className={helpStyles.tabContent} data-active={activeTab === "general"} data-testid="help-content-general">
          <Tabs
            tabs={GENERAL_SUB_TABS}
            activeTab={generalSubTab}
            onChange={(id) => {
              setGeneralSubTab(id as GeneralSubTab);
              const idx = GENERAL_SUB_TABS.findIndex((t) => t.id === id);
              if (idx >= 0) setFocus({ row: "L2", index: idx });
            }}
            testIdPrefix="help-general-sub-tab"
            variant="secondary"
            focusedTabId={
              focus.row === "L2" && activeTab === "general"
                ? GENERAL_SUB_TABS[focus.index]?.id ?? null
                : null
            }
          />

          {generalSubTab === "navigation" && (
            <div data-testid="help-general-content-navigation">
              <div className={helpStyles.layoutSection}>
                <h3 className="text-xl font-semibold">Navigation</h3>
                <p className={helpStyles.layoutSectionIntro}>
                  Move around the cheatsheet, jump through the page, or return to the grid without reaching for the mouse.
                </p>
                <KeybindingChart entries={NAVIGATION_ENTRIES} />
              </div>
            </div>
          )}

          {generalSubTab === "misc" && (
            <div data-testid="help-general-content-misc">
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
          )}
        </div>

        <div className={helpStyles.tabContent} data-active={activeTab === "layout"} data-testid="help-content-layout">
          <Tabs
            tabs={LAYOUT_SUB_TABS}
            activeTab={layoutSubTab}
            onChange={(id) => {
              setLayoutSubTab(id as LayoutSubTab);
              const idx = LAYOUT_SUB_TABS.findIndex((t) => t.id === id);
              if (idx >= 0) setFocus({ row: "L2", index: idx });
            }}
            testIdPrefix="help-layout-sub-tab"
            variant="secondary"
            focusedTabId={
              focus.row === "L2" && activeTab === "layout"
                ? LAYOUT_SUB_TABS[focus.index]?.id ?? null
                : null
            }
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
                <h4 className="mt-6 text-lg font-semibold">Advanced resize</h4>
                <p className={helpStyles.layoutSectionIntro}>
                  Strict variants refuse any wrap or push. Compact variants pull neighbours inward when shrinking.
                </p>
                <KeybindingChart entries={LAYOUT_RESIZE_ADVANCED_ENTRIES} />
              </div>
            </div>
          )}
        </div>

        <div className={helpStyles.tabContent} data-active={activeTab === "developer"} data-testid="help-content-developer">
          <Tabs
            tabs={DEVELOPER_SUB_TABS}
            activeTab={developerSubTab}
            onChange={(id) => {
              setDeveloperSubTab(id as DeveloperSubTab);
              const idx = DEVELOPER_SUB_TABS.findIndex((t) => t.id === id);
              if (idx >= 0) setFocus({ row: "L2", index: idx });
            }}
            testIdPrefix="help-developer-sub-tab"
            variant="secondary"
            focusedTabId={
              focus.row === "L2" && activeTab === "developer"
                ? DEVELOPER_SUB_TABS[focus.index]?.id ?? null
                : null
            }
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

        <div className={helpStyles.tabContent} data-active={activeTab === "help"} data-testid="help-content-help">
          <div className={helpStyles.layoutSection}>
            <h3 className="text-xl font-semibold">Help Navigation</h3>
            <p className={helpStyles.layoutSectionIntro}>
              Move between the tabs of this help modal with the keyboard. The focused tab is highlighted; press <em>activate</em> to commit it.
            </p>
            <KeybindingChart entries={HELP_NAVIGATION_ENTRIES} />
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
