import { ACTION_IDS, type KeybindingContext } from "@/lib/keybindings";
import type { KeybindingsSubTab, KeybindingsSubSubTab } from "@/hooks/use-ui-settings";

/**
 * A section is a labelled group of keybindings rendered inside a sub-tab (or
 * sub-sub-tab). Sections are explicit: each one lists the action ids it
 * contains (in render order). This decouples the visual grouping from the
 * underlying scope/context, so a single context can be split across multiple
 * sections (e.g. `home` -> "Misc" + "Navigation"), or a single section can
 * span several contexts conceptually (handled by listing one section per
 * context with the same parent sub-tab).
 */
export type SectionConfig = {
  /** Unique id within a sub-tab. Used for React keys and data attributes. */
  id: string;
  /** Header label rendered above the section. */
  label: string;
  /** Short description rendered under the label. */
  description: string;
  /** Source context for the actions in this section. */
  context: KeybindingContext;
  /** Explicit list of action ids included in this section, in render order. */
  actionIds: readonly string[];
  /**
   * Optional per-action notes rendered under the row label. Useful for
   * documenting activation conditions or caveats that don't fit in the
   * section description.
   */
  notes?: Readonly<Record<string, string>>;
};

export type SubTabConfig = {
  id: KeybindingsSubTab;
  label: string;
  intro: string;
  /** Sections rendered when this sub-tab is active (only for non-cheatsheet sub-tabs). */
  sections?: SectionConfig[];
};

export type SubSubTabConfig = {
  id: KeybindingsSubSubTab;
  label: string;
  intro: string;
  sections: SectionConfig[];
};

// -- Section catalogues ------------------------------------------------------
//
// Sections are defined as data so that the renderer stays dumb. Action ids are
// referenced via ACTION_IDS to keep this file in sync with the source of
// truth.

const GENERAL_SECTIONS: SectionConfig[] = [
  {
    id: "global-misc",
    label: "Misc",
    description: "Shortcuts available everywhere, independent of the current page or modal.",
    context: "global",
    actionIds: [
      ACTION_IDS.TOGGLE_HELP,
      ACTION_IDS.TOGGLE_SETTINGS,
      ACTION_IDS.GO_TOP,
      ACTION_IDS.GO_BOTTOM,
    ],
  },
  {
    id: "help-modal",
    label: "Help",
    description: "Tab traversal inside the help modal.",
    context: "help",
    actionIds: [
      ACTION_IDS.HELP_TAB_LEFT,
      ACTION_IDS.HELP_TAB_RIGHT,
      ACTION_IDS.HELP_TAB_UP,
      ACTION_IDS.HELP_TAB_DOWN,
      ACTION_IDS.HELP_TAB_ACTIVATE,
    ],
  },
  {
    id: "settings-modal",
    label: "Settings",
    description: "Tab traversal inside the settings panel.",
    context: "settings",
    actionIds: [
      ACTION_IDS.SETTINGS_TAB_LEFT,
      ACTION_IDS.SETTINGS_TAB_RIGHT,
      ACTION_IDS.SETTINGS_TAB_UP,
      ACTION_IDS.SETTINGS_TAB_DOWN,
      ACTION_IDS.SETTINGS_TAB_ACTIVATE,
    ],
  },
];

const HOME_SECTIONS: SectionConfig[] = [
  {
    id: "home-misc",
    label: "Misc",
    description: "Top-level actions available on the home grid.",
    context: "home",
    actionIds: [
      ACTION_IDS.FOCUS_SEARCH,
      ACTION_IDS.CLEAR_SEARCH,
      ACTION_IDS.SHOW_INFO,
      ACTION_IDS.OPEN_SHEET,
    ],
    notes: {
      [ACTION_IDS.CLEAR_SEARCH]: "Only fires while the search field is focused.",
      [ACTION_IDS.SHOW_INFO]: "Acts on the currently focused sheet card.",
      [ACTION_IDS.OPEN_SHEET]: "Acts on the currently focused sheet card.",
    },
  },
  {
    id: "home-info",
    label: "Info modal",
    description: "Bindings active while the info modal is open on the home page.",
    context: "info",
    actionIds: [ACTION_IDS.INFO_CLOSE],
  },
  {
    id: "home-navigation",
    label: "Navigation",
    description: "Move the focused card around the home grid.",
    context: "home",
    actionIds: [
      ACTION_IDS.HOME_MOVE_LEFT,
      ACTION_IDS.HOME_MOVE_RIGHT,
      ACTION_IDS.HOME_MOVE_UP,
      ACTION_IDS.HOME_MOVE_DOWN,
    ],
  },
];

const SHEET_GENERAL_SECTIONS: SectionConfig[] = [
  {
    id: "sheet-misc",
    label: "Misc",
    description: "Actions available while browsing a cheatsheet.",
    context: "sheet",
    actionIds: [
      ACTION_IDS.BACK_TO_HOME,
      ACTION_IDS.COPY_COMMAND,
      ACTION_IDS.SHOW_EXAMPLE,
      ACTION_IDS.CLEAR_COMMAND_FOCUS,
      ACTION_IDS.TOGGLE_DEVELOPER_MODE,
      ACTION_IDS.RESET_LAYOUT,
      ACTION_IDS.LAYOUT_ENTER_MODE,
    ],
    notes: {
      [ACTION_IDS.COPY_COMMAND]: "Only fires when the focused entry exposes a copyable value.",
      [ACTION_IDS.SHOW_EXAMPLE]: "Only fires when the focused entry has additional details to show.",
      [ACTION_IDS.CLEAR_COMMAND_FOCUS]: "Only fires while an entry is focused.",
      [ACTION_IDS.RESET_LAYOUT]: "Only fires when the layout has been modified from its original state.",
    },
  },
  {
    id: "sheet-navigation",
    label: "Navigation",
    description: "Move the focused entry inside the cheatsheet grid.",
    context: "sheet",
    actionIds: [
      ACTION_IDS.SHEET_MOVE_LEFT,
      ACTION_IDS.SHEET_MOVE_RIGHT,
      ACTION_IDS.SHEET_MOVE_UP,
      ACTION_IDS.SHEET_MOVE_DOWN,
    ],
  },
  {
    id: "cheat-info-modal",
    label: "Info modal",
    description: "Bindings active inside the item-detail modal opened from a cheatsheet entry.",
    context: "cheat-info-modal",
    actionIds: [
      ACTION_IDS.CHEAT_INFO_MODAL_MOVE_UP,
      ACTION_IDS.CHEAT_INFO_MODAL_MOVE_DOWN,
      ACTION_IDS.CHEAT_INFO_MODAL_COPY,
      ACTION_IDS.CHEAT_INFO_MODAL_CLOSE,
    ],
  },
  {
    id: "cheat-copy-modal",
    label: "Copy modal",
    description: "Bindings active inside the command-copy modal opened from a cheatsheet entry.",
    context: "cheat-copy-modal",
    actionIds: [
      ACTION_IDS.CHEAT_COPY_MODAL_MOVE_UP,
      ACTION_IDS.CHEAT_COPY_MODAL_MOVE_DOWN,
      ACTION_IDS.CHEAT_COPY_MODAL_SUBMIT,
      ACTION_IDS.CHEAT_COPY_MODAL_CANCEL,
    ],
  },
];

const SHEET_LAYOUT_SECTIONS: SectionConfig[] = [
  {
    id: "layout-parent",
    label: "Layout",
    description: "Enter, switch sub-mode, commit changes, or exit layout mode.",
    context: "layout",
    actionIds: [
      ACTION_IDS.LAYOUT_GOTO_NAVIGATION,
      ACTION_IDS.LAYOUT_GOTO_MOVE,
      ACTION_IDS.LAYOUT_GOTO_RESIZE,
      ACTION_IDS.LAYOUT_COMMIT,
      ACTION_IDS.LAYOUT_EXIT,
    ],
  },
  {
    id: "layout-navigation",
    label: "Navigation",
    description: "Move the cursor between cards in layout mode without affecting their position.",
    context: "layout-navigation",
    actionIds: [
      ACTION_IDS.LAYOUT_NAV_LEFT,
      ACTION_IDS.LAYOUT_NAV_RIGHT,
      ACTION_IDS.LAYOUT_NAV_UP,
      ACTION_IDS.LAYOUT_NAV_DOWN,
    ],
  },
  {
    id: "layout-move",
    label: "Move",
    description: "Slide the focused card. Neighbours reflow to make room.",
    context: "layout-move",
    actionIds: [
      ACTION_IDS.LAYOUT_MOVE_LEFT,
      ACTION_IDS.LAYOUT_MOVE_RIGHT,
      ACTION_IDS.LAYOUT_MOVE_UP,
      ACTION_IDS.LAYOUT_MOVE_DOWN,
    ],
  },
  {
    id: "layout-move-strict",
    label: "Move strict",
    description: "Stays on a single axis; stops at the first obstacle instead of pushing neighbours.",
    context: "layout-move",
    actionIds: [
      ACTION_IDS.LAYOUT_MOVE_STRICT_LEFT,
      ACTION_IDS.LAYOUT_MOVE_STRICT_RIGHT,
      ACTION_IDS.LAYOUT_MOVE_STRICT_UP,
      ACTION_IDS.LAYOUT_MOVE_STRICT_DOWN,
    ],
  },
  {
    id: "layout-resize",
    label: "Resize",
    description: "Grow or shrink the selected card along the chosen edge.",
    context: "layout-resize",
    actionIds: [
      ACTION_IDS.LAYOUT_RESIZE_GROW_LEFT,
      ACTION_IDS.LAYOUT_RESIZE_GROW_RIGHT,
      ACTION_IDS.LAYOUT_RESIZE_GROW_UP,
      ACTION_IDS.LAYOUT_RESIZE_GROW_DOWN,
      ACTION_IDS.LAYOUT_RESIZE_SHRINK_LEFT,
      ACTION_IDS.LAYOUT_RESIZE_SHRINK_RIGHT,
      ACTION_IDS.LAYOUT_RESIZE_SHRINK_UP,
      ACTION_IDS.LAYOUT_RESIZE_SHRINK_DOWN,
    ],
  },
  {
    id: "layout-resize-strict",
    label: "Resize strict",
    description: "Strict resize: never pushes neighbours; stops at the first obstacle.",
    context: "layout-resize",
    actionIds: [
      ACTION_IDS.LAYOUT_RESIZE_GROW_STRICT_LEFT,
      ACTION_IDS.LAYOUT_RESIZE_GROW_STRICT_RIGHT,
      ACTION_IDS.LAYOUT_RESIZE_GROW_STRICT_UP,
      ACTION_IDS.LAYOUT_RESIZE_GROW_STRICT_DOWN,
      ACTION_IDS.LAYOUT_RESIZE_SHRINK_STRICT_LEFT,
      ACTION_IDS.LAYOUT_RESIZE_SHRINK_STRICT_RIGHT,
      ACTION_IDS.LAYOUT_RESIZE_SHRINK_STRICT_UP,
      ACTION_IDS.LAYOUT_RESIZE_SHRINK_STRICT_DOWN,
    ],
  },
  {
    id: "layout-resize-compact",
    label: "Resize compact",
    description: "Shrink the card and immediately compact neighbours into the freed space.",
    context: "layout-resize",
    actionIds: [
      ACTION_IDS.LAYOUT_RESIZE_SHRINK_COMPACT_LEFT,
      ACTION_IDS.LAYOUT_RESIZE_SHRINK_COMPACT_RIGHT,
      ACTION_IDS.LAYOUT_RESIZE_SHRINK_COMPACT_UP,
      ACTION_IDS.LAYOUT_RESIZE_SHRINK_COMPACT_DOWN,
    ],
  },
];

const SHEET_DEVELOPER_SECTIONS: SectionConfig[] = [
  {
    id: "dev-misc",
    label: "Misc",
    description: "Top-level Developer Mode actions.",
    context: "dev",
    actionIds: [
      ACTION_IDS.DEV_SAVE_LAYOUT,
      ACTION_IDS.DEV_RESET_LAYOUT,
      ACTION_IDS.DEV_TOGGLE_RECORDING,
      ACTION_IDS.DEV_TOGGLE_LOGS,
      ACTION_IDS.DEV_ENTER_AXES_MODE,
    ],
  },
  {
    id: "dev-logs",
    label: "Logs",
    description: "Keys active when the logs dropdown is open.",
    context: "dev-logs",
    actionIds: [
      ACTION_IDS.DEV_LOGS_CURSOR_DOWN,
      ACTION_IDS.DEV_LOGS_CURSOR_UP,
      ACTION_IDS.DEV_LOGS_COPY_FILENAME,
      ACTION_IDS.DEV_LOGS_DELETE,
      ACTION_IDS.DEV_LOGS_DELETE_ALL,
      ACTION_IDS.DEV_LOGS_REFRESH,
      ACTION_IDS.DEV_LOGS_CLOSE,
    ],
  },
  {
    id: "dev-axes",
    label: "Axes",
    description: "Keys active in axes overlay sub-mode.",
    context: "dev-axes",
    actionIds: [
      ACTION_IDS.DEV_AXES_CURSOR_LEFT,
      ACTION_IDS.DEV_AXES_CURSOR_RIGHT,
      ACTION_IDS.DEV_AXES_CURSOR_UP,
      ACTION_IDS.DEV_AXES_CURSOR_DOWN,
      ACTION_IDS.DEV_AXES_TOGGLE_COL,
      ACTION_IDS.DEV_AXES_TOGGLE_ROW,
      ACTION_IDS.DEV_AXES_CLEAR_ALL,
      ACTION_IDS.DEV_AXES_EXIT,
    ],
  },
];

export const SUB_TABS: SubTabConfig[] = [
  {
    id: "general",
    label: "General",
    intro: "Cross-cutting shortcuts grouped for discoverability: top-level actions available everywhere, plus the navigation bindings scoped to the Help modal and the Settings panel.",
    sections: GENERAL_SECTIONS,
  },
  {
    id: "home",
    label: "Home",
    intro: "Shortcuts active on the home grid.",
    sections: HOME_SECTIONS,
  },
  {
    id: "cheatsheet",
    label: "Cheatsheet",
    intro: "Shortcuts active while browsing a cheatsheet, editing its layout, or using Developer Mode.",
  },
];

export const SUB_SUB_TABS: SubSubTabConfig[] = [
  {
    id: "general",
    label: "General",
    intro: "Shortcuts active while browsing a cheatsheet.",
    sections: SHEET_GENERAL_SECTIONS,
  },
  {
    id: "layout",
    label: "Layout",
    intro: "Shortcuts active while editing the layout of a cheatsheet.",
    sections: SHEET_LAYOUT_SECTIONS,
  },
  {
    id: "developer",
    label: "Developer",
    intro: "Shortcuts active in Developer Mode and its sub-modes.",
    sections: SHEET_DEVELOPER_SECTIONS,
  },
];

export function getActiveSections(
  sub: KeybindingsSubTab,
  subSub: KeybindingsSubSubTab,
): { sections: SectionConfig[]; intro: string } {
  if (sub === "cheatsheet") {
    const subConfig = SUB_SUB_TABS.find((t) => t.id === subSub) ?? SUB_SUB_TABS[0];
    return { sections: subConfig.sections, intro: subConfig.intro };
  }
  const subConfig = SUB_TABS.find((t) => t.id === sub) ?? SUB_TABS[0];
  return { sections: subConfig.sections ?? [], intro: subConfig.intro };
}
