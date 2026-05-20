import type { KeyboardScopeId } from "@/hooks/use-keyboard-context";

export type Modifier = "ctrl" | "alt" | "shift" | "meta";

export interface KeyCombo {
  key: string;
  modifiers: Modifier[];
  next?: KeyCombo;
}

export interface KeybindingAction {
  id: string;
  label: string;
  combos: KeyCombo[];
}

export interface KeyDisplayPart {
  type: "modifier" | "key";
  value: string;
}

export type KeybindingContext =
  | "global"
  | "home"
  | "sheet"
  | "layout"
  | "layout-navigation"
  | "layout-move"
  | "layout-resize"
  | "dev"
  | "dev-logs"
  | "dev-axes";

export function scopeToContext(scope: KeyboardScopeId): KeybindingContext | null {
  switch (scope) {
    case "global":
      return "global";
    case "layout":
      return "layout";
    case "layout-navigation":
      return "layout-navigation";
    case "layout-move":
      return "layout-move";
    case "layout-resize":
      return "layout-resize";
    case "dev":
      return "dev";
    case "dev-logs":
      return "dev-logs";
    case "dev-axes":
      return "dev-axes";
    default:
      return null;
  }
}

export type KeybindingsConfig = Record<KeybindingContext, KeybindingAction[]>;

export const ACTION_IDS = {
  TOGGLE_HELP: "global.toggle-help",
  TOGGLE_SETTINGS: "global.toggle-settings",
  MOVE_LEFT: "global.move-left",
  MOVE_RIGHT: "global.move-right",
  MOVE_UP: "global.move-up",
  MOVE_DOWN: "global.move-down",
  GO_TOP: "global.go-top",
  GO_BOTTOM: "global.go-bottom",

  FOCUS_SEARCH: "home.focus-search",
  CLEAR_SEARCH: "home.clear-search",
  TOGGLE_INFO: "home.toggle-info",
  OPEN_SHEET: "home.open-sheet",

  BACK_TO_HOME: "sheet.back-to-home",
  COPY_COMMAND: "sheet.copy",
  SHOW_EXAMPLE: "sheet.show-details",
  CLEAR_COMMAND_FOCUS: "sheet.clear-focus",
  TOGGLE_DEVELOPER_MODE: "sheet.toggle-developer-mode",
  RESET_LAYOUT: "sheet.reset-layout",
  LAYOUT_ENTER_MODE: "sheet.layout-enter-mode",

  // Layout parent scope: shared mode-switch actions (cascade target from
  // sub-scopes when no sub-scope binding matches).
  LAYOUT_GOTO_NAVIGATION: "layout.goto-navigation",
  LAYOUT_GOTO_MOVE: "layout.goto-move",
  LAYOUT_GOTO_RESIZE: "layout.goto-resize",

  // Layout sub-mode: navigation (scope `layout-navigation`).
  LAYOUT_NAV_LEFT: "layout-navigation.left",
  LAYOUT_NAV_RIGHT: "layout-navigation.right",
  LAYOUT_NAV_UP: "layout-navigation.up",
  LAYOUT_NAV_DOWN: "layout-navigation.down",
  LAYOUT_NAV_EXIT: "layout-navigation.exit",

  // Layout sub-mode: move (scope `layout-move`).
  LAYOUT_MOVE_LEFT: "layout-move.left",
  LAYOUT_MOVE_RIGHT: "layout-move.right",
  LAYOUT_MOVE_UP: "layout-move.up",
  LAYOUT_MOVE_DOWN: "layout-move.down",
  LAYOUT_MOVE_STRICT_LEFT: "layout-move.strict-left",
  LAYOUT_MOVE_STRICT_RIGHT: "layout-move.strict-right",
  LAYOUT_MOVE_STRICT_UP: "layout-move.strict-up",
  LAYOUT_MOVE_STRICT_DOWN: "layout-move.strict-down",
  LAYOUT_MOVE_EXIT: "layout-move.exit",

  // Layout sub-mode: resize (scope `layout-resize`).
  LAYOUT_RESIZE_GROW_LEFT: "layout-resize.grow-left",
  LAYOUT_RESIZE_GROW_RIGHT: "layout-resize.grow-right",
  LAYOUT_RESIZE_GROW_UP: "layout-resize.grow-up",
  LAYOUT_RESIZE_GROW_DOWN: "layout-resize.grow-down",
  LAYOUT_RESIZE_SHRINK_LEFT: "layout-resize.shrink-left",
  LAYOUT_RESIZE_SHRINK_RIGHT: "layout-resize.shrink-right",
  LAYOUT_RESIZE_SHRINK_UP: "layout-resize.shrink-up",
  LAYOUT_RESIZE_SHRINK_DOWN: "layout-resize.shrink-down",
  LAYOUT_RESIZE_GROW_STRICT_LEFT: "layout-resize.grow-strict-left",
  LAYOUT_RESIZE_GROW_STRICT_RIGHT: "layout-resize.grow-strict-right",
  LAYOUT_RESIZE_GROW_STRICT_UP: "layout-resize.grow-strict-up",
  LAYOUT_RESIZE_GROW_STRICT_DOWN: "layout-resize.grow-strict-down",
  LAYOUT_RESIZE_SHRINK_STRICT_LEFT: "layout-resize.shrink-strict-left",
  LAYOUT_RESIZE_SHRINK_STRICT_RIGHT: "layout-resize.shrink-strict-right",
  LAYOUT_RESIZE_SHRINK_STRICT_UP: "layout-resize.shrink-strict-up",
  LAYOUT_RESIZE_SHRINK_STRICT_DOWN: "layout-resize.shrink-strict-down",
  LAYOUT_RESIZE_SHRINK_COMPACT_LEFT: "layout-resize.shrink-compact-left",
  LAYOUT_RESIZE_SHRINK_COMPACT_RIGHT: "layout-resize.shrink-compact-right",
  LAYOUT_RESIZE_SHRINK_COMPACT_UP: "layout-resize.shrink-compact-up",
  LAYOUT_RESIZE_SHRINK_COMPACT_DOWN: "layout-resize.shrink-compact-down",
  LAYOUT_RESIZE_EXIT: "layout-resize.exit",

  // Developer mode top-level actions (scope `dev` / context `dev`).
  DEV_SAVE_LAYOUT: "dev.save-layout",
  DEV_RESET_LAYOUT: "dev.reset-layout",
  DEV_TOGGLE_RECORDING: "dev.toggle-recording",
  DEV_TOGGLE_LOGS: "dev.toggle-logs",
  DEV_ENTER_AXES_MODE: "dev.enter-axes-mode",

  // Logs dropdown sub-mode (scope `dev-logs` / context `dev-logs`).
  DEV_LOGS_CURSOR_DOWN: "dev-logs.cursor-down",
  DEV_LOGS_CURSOR_UP: "dev-logs.cursor-up",
  DEV_LOGS_COPY_FILENAME: "dev-logs.copy-filename",
  DEV_LOGS_DELETE: "dev-logs.delete",
  DEV_LOGS_DELETE_ALL: "dev-logs.delete-all",
  DEV_LOGS_REFRESH: "dev-logs.refresh",
  DEV_LOGS_CLOSE: "dev-logs.close",

  // Axes selection sub-mode (scope `dev-axes` / context `dev-axes`).
  DEV_AXES_CURSOR_LEFT: "dev-axes.cursor-left",
  DEV_AXES_CURSOR_RIGHT: "dev-axes.cursor-right",
  DEV_AXES_CURSOR_UP: "dev-axes.cursor-up",
  DEV_AXES_CURSOR_DOWN: "dev-axes.cursor-down",
  DEV_AXES_TOGGLE_COL: "dev-axes.toggle-col",
  DEV_AXES_TOGGLE_ROW: "dev-axes.toggle-row",
  DEV_AXES_CLEAR_ALL: "dev-axes.clear-all",
  DEV_AXES_EXIT: "dev-axes.exit",
} as const;

export type ActionId = (typeof ACTION_IDS)[keyof typeof ACTION_IDS];

export function key(k: string): KeyCombo {
  return { key: k, modifiers: [] };
}

export function combo(k: string, ...modifiers: Modifier[]): KeyCombo {
  return { key: k, modifiers };
}

export function sequence(first: KeyCombo, second: KeyCombo): KeyCombo {
  return { ...first, next: second };
}

export const DEFAULT_KEYBINDINGS: KeybindingsConfig = {
  global: [
    {
      id: ACTION_IDS.TOGGLE_HELP,
      label: "Toggle help",
      combos: [key("?")],
    },
    {
      id: ACTION_IDS.TOGGLE_SETTINGS,
      label: "Toggle settings",
      combos: [key(",")],
    },
    {
      id: ACTION_IDS.MOVE_LEFT,
      label: "Move left",
      combos: [key("ArrowLeft"), key("h")],
    },
    {
      id: ACTION_IDS.MOVE_RIGHT,
      label: "Move right",
      combos: [key("ArrowRight"), key("l")],
    },
    {
      id: ACTION_IDS.MOVE_UP,
      label: "Move up",
      combos: [key("ArrowUp"), key("k")],
    },
    {
      id: ACTION_IDS.MOVE_DOWN,
      label: "Move down",
      combos: [key("ArrowDown"), key("j")],
    },
    {
      id: ACTION_IDS.GO_TOP,
      label: "Go to top",
      combos: [sequence(key("g"), key("g"))],
    },
    {
      id: ACTION_IDS.GO_BOTTOM,
      label: "Go to bottom",
      combos: [combo("G", "shift")],
    },
  ],

  home: [
    {
      id: ACTION_IDS.FOCUS_SEARCH,
      label: "Focus search",
      combos: [key("/")],
    },
    {
      id: ACTION_IDS.CLEAR_SEARCH,
      label: "Clear search",
      combos: [key("Escape")],
    },
    {
      id: ACTION_IDS.TOGGLE_INFO,
      label: "Toggle details",
      combos: [key("i")],
    },
    {
      id: ACTION_IDS.OPEN_SHEET,
      label: "Open sheet",
      combos: [key(" "), key("Enter")],
    },
  ],

  sheet: [
    {
      id: ACTION_IDS.BACK_TO_HOME,
      label: "Back to grid",
      combos: [key("Backspace"), key("Escape")],
    },
    {
      id: ACTION_IDS.COPY_COMMAND,
      label: "Copy",
      combos: [key("y")],
    },
    {
      id: ACTION_IDS.SHOW_EXAMPLE,
      label: "Show details",
      combos: [key("i")],
    },
    {
      id: ACTION_IDS.CLEAR_COMMAND_FOCUS,
      label: "Clear selection",
      combos: [key("Escape")],
    },
    {
      id: ACTION_IDS.TOGGLE_DEVELOPER_MODE,
      label: "Toggle developer mode",
      combos: [combo("d", "ctrl", "shift")],
    },
    {
      id: ACTION_IDS.RESET_LAYOUT,
      label: "Reset layout to original",
      combos: [combo("R", "shift")],
    },
    {
      id: ACTION_IDS.LAYOUT_ENTER_MODE,
      label: "Enter layout mode",
      combos: [combo("m", "ctrl")],
    },
  ],

  layout: [
    {
      id: ACTION_IDS.LAYOUT_GOTO_NAVIGATION,
      label: "Switch to navigation sub-mode",
      combos: [key("n")],
    },
    {
      id: ACTION_IDS.LAYOUT_GOTO_MOVE,
      label: "Switch to move sub-mode",
      combos: [key("m")],
    },
    {
      id: ACTION_IDS.LAYOUT_GOTO_RESIZE,
      label: "Switch to resize sub-mode",
      combos: [key("b")],
    },
  ],

  "layout-navigation": [
    {
      id: ACTION_IDS.LAYOUT_NAV_LEFT,
      label: "Focus card to the left",
      combos: [key("ArrowLeft"), key("h")],
    },
    {
      id: ACTION_IDS.LAYOUT_NAV_RIGHT,
      label: "Focus card to the right",
      combos: [key("ArrowRight"), key("l")],
    },
    {
      id: ACTION_IDS.LAYOUT_NAV_UP,
      label: "Focus card above",
      combos: [key("ArrowUp"), key("k")],
    },
    {
      id: ACTION_IDS.LAYOUT_NAV_DOWN,
      label: "Focus card below",
      combos: [key("ArrowDown"), key("j")],
    },
    {
      id: ACTION_IDS.LAYOUT_NAV_EXIT,
      label: "Exit layout mode",
      combos: [key("Escape")],
    },
  ],

  "layout-move": [
    {
      id: ACTION_IDS.LAYOUT_MOVE_LEFT,
      label: "Move card left",
      combos: [key("ArrowLeft"), key("h")],
    },
    {
      id: ACTION_IDS.LAYOUT_MOVE_RIGHT,
      label: "Move card right",
      combos: [key("ArrowRight"), key("l")],
    },
    {
      id: ACTION_IDS.LAYOUT_MOVE_UP,
      label: "Move card up",
      combos: [key("ArrowUp"), key("k")],
    },
    {
      id: ACTION_IDS.LAYOUT_MOVE_DOWN,
      label: "Move card down",
      combos: [key("ArrowDown"), key("j")],
    },
    {
      id: ACTION_IDS.LAYOUT_MOVE_STRICT_LEFT,
      label: "Move card left (strict)",
      combos: [combo("ArrowLeft", "alt"), combo("h", "alt")],
    },
    {
      id: ACTION_IDS.LAYOUT_MOVE_STRICT_RIGHT,
      label: "Move card right (strict)",
      combos: [combo("ArrowRight", "alt"), combo("l", "alt")],
    },
    {
      id: ACTION_IDS.LAYOUT_MOVE_STRICT_UP,
      label: "Move card up (strict)",
      combos: [combo("ArrowUp", "alt"), combo("k", "alt")],
    },
    {
      id: ACTION_IDS.LAYOUT_MOVE_STRICT_DOWN,
      label: "Move card down (strict)",
      combos: [combo("ArrowDown", "alt"), combo("j", "alt")],
    },
    {
      id: ACTION_IDS.LAYOUT_MOVE_EXIT,
      label: "Exit layout mode",
      combos: [key("Escape")],
    },
  ],

  "layout-resize": [
    {
      id: ACTION_IDS.LAYOUT_RESIZE_GROW_LEFT,
      label: "Grow card to the left",
      combos: [key("ArrowLeft"), key("h")],
    },
    {
      id: ACTION_IDS.LAYOUT_RESIZE_GROW_RIGHT,
      label: "Grow card to the right",
      combos: [key("ArrowRight"), key("l")],
    },
    {
      id: ACTION_IDS.LAYOUT_RESIZE_GROW_UP,
      label: "Grow card upward",
      combos: [key("ArrowUp"), key("k")],
    },
    {
      id: ACTION_IDS.LAYOUT_RESIZE_GROW_DOWN,
      label: "Grow card downward",
      combos: [key("ArrowDown"), key("j")],
    },
    {
      id: ACTION_IDS.LAYOUT_RESIZE_SHRINK_LEFT,
      label: "Shrink card from the left",
      combos: [combo("ArrowLeft", "shift"), combo("H", "shift")],
    },
    {
      id: ACTION_IDS.LAYOUT_RESIZE_SHRINK_RIGHT,
      label: "Shrink card from the right",
      combos: [combo("ArrowRight", "shift"), combo("L", "shift")],
    },
    {
      id: ACTION_IDS.LAYOUT_RESIZE_SHRINK_UP,
      label: "Shrink card from the top",
      combos: [combo("ArrowUp", "shift"), combo("K", "shift")],
    },
    {
      id: ACTION_IDS.LAYOUT_RESIZE_SHRINK_DOWN,
      label: "Shrink card from the bottom",
      combos: [combo("ArrowDown", "shift"), combo("J", "shift")],
    },
    {
      id: ACTION_IDS.LAYOUT_RESIZE_GROW_STRICT_LEFT,
      label: "Grow card left (strict)",
      combos: [combo("ArrowLeft", "alt"), combo("h", "alt")],
    },
    {
      id: ACTION_IDS.LAYOUT_RESIZE_GROW_STRICT_RIGHT,
      label: "Grow card right (strict)",
      combos: [combo("ArrowRight", "alt"), combo("l", "alt")],
    },
    {
      id: ACTION_IDS.LAYOUT_RESIZE_GROW_STRICT_UP,
      label: "Grow card up (strict)",
      combos: [combo("ArrowUp", "alt"), combo("k", "alt")],
    },
    {
      id: ACTION_IDS.LAYOUT_RESIZE_GROW_STRICT_DOWN,
      label: "Grow card down (strict)",
      combos: [combo("ArrowDown", "alt"), combo("j", "alt")],
    },
    {
      id: ACTION_IDS.LAYOUT_RESIZE_SHRINK_STRICT_LEFT,
      label: "Shrink card left (strict)",
      combos: [combo("ArrowLeft", "alt", "shift"), combo("H", "alt", "shift")],
    },
    {
      id: ACTION_IDS.LAYOUT_RESIZE_SHRINK_STRICT_RIGHT,
      label: "Shrink card right (strict)",
      combos: [combo("ArrowRight", "alt", "shift"), combo("L", "alt", "shift")],
    },
    {
      id: ACTION_IDS.LAYOUT_RESIZE_SHRINK_STRICT_UP,
      label: "Shrink card up (strict)",
      combos: [combo("ArrowUp", "alt", "shift"), combo("K", "alt", "shift")],
    },
    {
      id: ACTION_IDS.LAYOUT_RESIZE_SHRINK_STRICT_DOWN,
      label: "Shrink card down (strict)",
      combos: [combo("ArrowDown", "alt", "shift"), combo("J", "alt", "shift")],
    },
    {
      id: ACTION_IDS.LAYOUT_RESIZE_SHRINK_COMPACT_LEFT,
      label: "Shrink card left (compact)",
      combos: [combo("ArrowLeft", "ctrl", "shift"), combo("H", "ctrl", "shift")],
    },
    {
      id: ACTION_IDS.LAYOUT_RESIZE_SHRINK_COMPACT_RIGHT,
      label: "Shrink card right (compact)",
      combos: [combo("ArrowRight", "ctrl", "shift"), combo("L", "ctrl", "shift")],
    },
    {
      id: ACTION_IDS.LAYOUT_RESIZE_SHRINK_COMPACT_UP,
      label: "Shrink card up (compact)",
      combos: [combo("ArrowUp", "ctrl", "shift"), combo("K", "ctrl", "shift")],
    },
    {
      id: ACTION_IDS.LAYOUT_RESIZE_SHRINK_COMPACT_DOWN,
      label: "Shrink card down (compact)",
      combos: [combo("ArrowDown", "ctrl", "shift"), combo("J", "ctrl", "shift")],
    },
    {
      id: ACTION_IDS.LAYOUT_RESIZE_EXIT,
      label: "Exit layout mode",
      combos: [key("Escape")],
    },
  ],

  dev: [
    {
      id: ACTION_IDS.DEV_SAVE_LAYOUT,
      label: "Save layout (dev)",
      combos: [key("s")],
    },
    {
      id: ACTION_IDS.DEV_RESET_LAYOUT,
      label: "Reset layout",
      combos: [key("w")],
    },
    {
      id: ACTION_IDS.DEV_TOGGLE_RECORDING,
      label: "Toggle recording",
      combos: [key("r")],
    },
    {
      id: ACTION_IDS.DEV_TOGGLE_LOGS,
      label: "Toggle logs dropdown",
      combos: [key("o")],
    },
    {
      id: ACTION_IDS.DEV_ENTER_AXES_MODE,
      label: "Enter axes selection mode",
      combos: [combo("G", "shift")],
    },
  ],

  "dev-logs": [
    {
      id: ACTION_IDS.DEV_LOGS_CURSOR_DOWN,
      label: "Cursor down",
      combos: [key("ArrowDown"), key("j")],
    },
    {
      id: ACTION_IDS.DEV_LOGS_CURSOR_UP,
      label: "Cursor up",
      combos: [key("ArrowUp"), key("k")],
    },
    {
      id: ACTION_IDS.DEV_LOGS_COPY_FILENAME,
      label: "Copy filename",
      combos: [key("y")],
    },
    {
      id: ACTION_IDS.DEV_LOGS_DELETE,
      label: "Delete session",
      combos: [key("d")],
    },
    {
      id: ACTION_IDS.DEV_LOGS_DELETE_ALL,
      label: "Delete all sessions",
      combos: [combo("D", "shift")],
    },
    {
      id: ACTION_IDS.DEV_LOGS_REFRESH,
      label: "Refresh list",
      combos: [combo("R", "shift")],
    },
    {
      id: ACTION_IDS.DEV_LOGS_CLOSE,
      label: "Close dropdown",
      combos: [key("Escape")],
    },
  ],

  "dev-axes": [
    {
      id: ACTION_IDS.DEV_AXES_CURSOR_LEFT,
      label: "Cursor left",
      combos: [key("ArrowLeft"), key("h")],
    },
    {
      id: ACTION_IDS.DEV_AXES_CURSOR_RIGHT,
      label: "Cursor right",
      combos: [key("ArrowRight"), key("l")],
    },
    {
      id: ACTION_IDS.DEV_AXES_CURSOR_UP,
      label: "Cursor up",
      combos: [key("ArrowUp"), key("k")],
    },
    {
      id: ACTION_IDS.DEV_AXES_CURSOR_DOWN,
      label: "Cursor down",
      combos: [key("ArrowDown"), key("j")],
    },
    {
      id: ACTION_IDS.DEV_AXES_TOGGLE_COL,
      label: "Toggle column pin",
      combos: [key(" "), key("Enter")],
    },
    {
      id: ACTION_IDS.DEV_AXES_TOGGLE_ROW,
      label: "Toggle row pin",
      combos: [combo(" ", "shift"), combo("Enter", "shift")],
    },
    {
      id: ACTION_IDS.DEV_AXES_CLEAR_ALL,
      label: "Clear all pinned",
      combos: [key("c")],
    },
    {
      id: ACTION_IDS.DEV_AXES_EXIT,
      label: "Exit axes mode",
      combos: [key("Escape")],
    },
  ],
};

/**
 * Characters that are typically produced with Shift on various keyboard layouts.
 * For these, we ignore the Shift modifier when matching because Shift is part
 * of typing the character itself, not a modifier intent.
 */
const SHIFT_PRODUCED_CHARS = new Set([
  "?", "/", "!", "@", "#", "$", "%", "^", "&", "*", "(", ")", "_", "+",
  "{", "}", "|", ":", '"', "<", ">", "~",
]);

export function matchesCombo(event: KeyboardEvent, combo: KeyCombo): boolean {
  const eventKey = event.key;
  const eventCode = event.code;
  const targetKey = combo.key;

  const keyMatches =
    eventKey === targetKey ||
    (isLetterKey(targetKey) && eventCode === `Key${targetKey.toUpperCase()}`);

  if (!keyMatches) return false;

  const hasCtrl = combo.modifiers.includes("ctrl");
  const hasAlt = combo.modifiers.includes("alt");
  const hasShift = combo.modifiers.includes("shift");
  const hasMeta = combo.modifiers.includes("meta");

  // For characters that are produced with Shift (like ? or /), ignore the Shift
  // modifier check because Shift is part of typing the character, not a modifier intent.
  const ignoreShift = SHIFT_PRODUCED_CHARS.has(eventKey) && !hasShift;

  return (
    event.ctrlKey === hasCtrl &&
    event.altKey === hasAlt &&
    (ignoreShift || event.shiftKey === hasShift) &&
    event.metaKey === hasMeta
  );
}

function isLetterKey(key: string): boolean {
  return /^[a-zA-Z]$/.test(key);
}

export function matchesAction(event: KeyboardEvent, action: KeybindingAction): boolean {
  return action.combos.some((c) => matchesCombo(event, c));
}

export function findMatchingAction(
  event: KeyboardEvent,
  actions: KeybindingAction[]
): KeybindingAction | null {
  return actions.find((action) => matchesAction(event, action)) ?? null;
}

const KEY_DISPLAY_MAP: Record<string, string> = {
  " ": "␣",
  Enter: "↩",
  Escape: "esc",
  Backspace: "⌫",
  ArrowLeft: "←",
  ArrowRight: "→",
  ArrowUp: "↑",
  ArrowDown: "↓",
  Tab: "⇥",
  Delete: "⌦",
};

const MODIFIER_DISPLAY_MAP: Record<Modifier, string> = {
  ctrl: "^",
  alt: "⌥",
  shift: "⇧",
  meta: "⌘",
};

export function getKeyDisplay(key: string): string {
  return KEY_DISPLAY_MAP[key] ?? key;
}

function getKeycapDisplayValue(key: string): string {
  if (/^[a-zA-Z]$/.test(key)) {
    return key.toLowerCase();
  }

  return getKeyDisplay(key);
}

export function getComboDisplayParts(combo: KeyCombo): KeyDisplayPart[] {
  const modifiers = combo.modifiers.map((modifier) => ({
    type: "modifier" as const,
    value: MODIFIER_DISPLAY_MAP[modifier],
  }));

  return [...modifiers, { type: "key", value: getKeycapDisplayValue(combo.key) }];
}

export function getComboSequenceDisplayParts(combo: KeyCombo): KeyDisplayPart[][] {
  const parts = [getComboDisplayParts(combo)];

  if (combo.next) {
    parts.push(...getComboSequenceDisplayParts(combo.next));
  }

  return parts;
}

export function getComboDisplay(combo: KeyCombo): string {
  if (combo.next) {
    const firstDisplay = getComboDisplay({ key: combo.key, modifiers: combo.modifiers });
    const secondDisplay = getComboDisplay(combo.next);
    if (
      combo.modifiers.length === 0 &&
      combo.next.modifiers.length === 0 &&
      combo.key.length === 1 &&
      combo.next.key.length === 1
    ) {
      return `${combo.key}${combo.next.key}`;
    }
    return `${firstDisplay} ${secondDisplay}`;
  }

  if (combo.modifiers.length === 1 && combo.modifiers[0] === "shift" && combo.key.length === 1) {
    return combo.key;
  }

  const modifierSymbols = combo.modifiers.map((m) => MODIFIER_DISPLAY_MAP[m]);
  const keyDisplay = getKeyDisplay(combo.key);
  return [...modifierSymbols, keyDisplay].join("");
}

export function getCombosDisplay(combos: KeyCombo[]): string[] {
  return combos.map(getComboDisplay);
}

export function isArrowKey(display: string): boolean {
  return display === "←" || display === "→" || display === "↑" || display === "↓";
}

export function getArrowDirection(display: string): "left" | "right" | "up" | "down" | null {
  switch (display) {
    case "←":
      return "left";
    case "→":
      return "right";
    case "↑":
      return "up";
    case "↓":
      return "down";
    default:
      return null;
  }
}
