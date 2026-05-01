/**
 * Keybinding system for customizable keyboard shortcuts.
 *
 * Keybindings are organized by context (global, home, sheet, sheet-commands).
 * Each action has a unique ID, a label, and an array of key combinations.
 */

import type { KeyboardScopeId } from "@/hooks/use-keyboard-context";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/** Modifier keys */
export type Modifier = "ctrl" | "alt" | "shift" | "meta";

/**
 * Represents a single key combination (e.g., Ctrl+K or just "k")
 */
export interface KeyCombo {
  /** The main key (e.g., "k", "Enter", "ArrowUp") */
  key: string;
  /** Modifier keys required */
  modifiers: Modifier[];
}

/**
 * An action that can be triggered by a keybinding
 */
export interface KeybindingAction {
  /** Unique identifier for the action */
  id: string;
  /** Human-readable label */
  label: string;
  /** Array of key combinations that trigger this action (first match wins) */
  combos: KeyCombo[];
}

/**
 * Context-specific keybindings configuration
 */
export type KeybindingContext = "global" | "home" | "sheet" | "sheet-commands";

/**
 * Map a KeyboardScopeId to a KeybindingContext
 */
export function scopeToContext(scope: KeyboardScopeId): KeybindingContext | null {
  switch (scope) {
    case "global":
      return "global";
    case "sheet-commands":
      return "sheet-commands";
    default:
      return null;
  }
}

/**
 * All keybindings organized by context
 */
export type KeybindingsConfig = Record<KeybindingContext, KeybindingAction[]>;

// ─────────────────────────────────────────────────────────────────────────────
// Action IDs (typed constants for type-safety)
// ─────────────────────────────────────────────────────────────────────────────

export const ACTION_IDS = {
  // Global actions (available everywhere)
  TOGGLE_HELP: "global.toggle-help",
  TOGGLE_SETTINGS: "global.toggle-settings",
  MOVE_LEFT: "global.move-left",
  MOVE_RIGHT: "global.move-right",
  MOVE_UP: "global.move-up",
  MOVE_DOWN: "global.move-down",

  // Home page actions
  FOCUS_SEARCH: "home.focus-search",
  CLEAR_SEARCH: "home.clear-search",
  TOGGLE_INFO: "home.toggle-info",
  OPEN_SHEET: "home.open-sheet",

  // Sheet page actions
  BACK_TO_HOME: "sheet.back-to-home",

  // Sheet commands actions
  COPY_COMMAND: "sheet-commands.copy",
  SHOW_EXAMPLE: "sheet-commands.show-example",
} as const;

export type ActionId = (typeof ACTION_IDS)[keyof typeof ACTION_IDS];

// ─────────────────────────────────────────────────────────────────────────────
// Helper functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Creates a simple key combo (no modifiers)
 */
export function key(k: string): KeyCombo {
  return { key: k, modifiers: [] };
}

/**
 * Creates a key combo with modifiers
 */
export function combo(k: string, ...modifiers: Modifier[]): KeyCombo {
  return { key: k, modifiers };
}

// ─────────────────────────────────────────────────────────────────────────────
// Default keybindings
// ─────────────────────────────────────────────────────────────────────────────

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
  ],

  "sheet-commands": [
    {
      id: ACTION_IDS.COPY_COMMAND,
      label: "Copy command",
      combos: [key("y")],
    },
    {
      id: ACTION_IDS.SHOW_EXAMPLE,
      label: "Show example",
      combos: [key("i")],
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// Key matching utilities
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Characters that are typically produced with Shift on various keyboard layouts.
 * For these, we ignore the Shift modifier when matching because Shift is part
 * of typing the character itself, not a modifier intent.
 */
const SHIFT_PRODUCED_CHARS = new Set([
  "?", "/", "!", "@", "#", "$", "%", "^", "&", "*", "(", ")", "_", "+",
  "{", "}", "|", ":", '"', "<", ">", "~",
  // Also include characters that might need Shift on some layouts
  "A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M",
  "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z",
]);

/**
 * Checks if a KeyboardEvent matches a KeyCombo
 */
export function matchesCombo(event: KeyboardEvent, combo: KeyCombo): boolean {
  // Normalize the key comparison
  const eventKey = event.key;
  const targetKey = combo.key;

  // Check if the main key matches
  if (eventKey !== targetKey) return false;

  // Check modifiers
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

/**
 * Checks if a KeyboardEvent matches any combo in an action
 */
export function matchesAction(event: KeyboardEvent, action: KeybindingAction): boolean {
  return action.combos.some((c) => matchesCombo(event, c));
}

/**
 * Finds the first matching action in a list
 */
export function findMatchingAction(
  event: KeyboardEvent,
  actions: KeybindingAction[]
): KeybindingAction | null {
  return actions.find((action) => matchesAction(event, action)) ?? null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Display utilities
// ─────────────────────────────────────────────────────────────────────────────

/** Map of special keys to their display symbols */
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

/** Map of modifier keys to their display symbols */
const MODIFIER_DISPLAY_MAP: Record<Modifier, string> = {
  ctrl: "^",
  alt: "⌥",
  shift: "⇧",
  meta: "⌘",
};

/**
 * Converts a key to its display form
 */
export function getKeyDisplay(key: string): string {
  return KEY_DISPLAY_MAP[key] ?? key;
}

/**
 * Converts a KeyCombo to its display string
 */
export function getComboDisplay(combo: KeyCombo): string {
  const modifierSymbols = combo.modifiers.map((m) => MODIFIER_DISPLAY_MAP[m]);
  const keyDisplay = getKeyDisplay(combo.key);
  return [...modifierSymbols, keyDisplay].join("");
}

/**
 * Converts an array of KeyCombos to a display string with "or" separators
 */
export function getCombosDisplay(combos: KeyCombo[]): string[] {
  return combos.map(getComboDisplay);
}

/**
 * Checks if a key display should render as an arrow glyph
 */
export function isArrowKey(display: string): boolean {
  return display === "←" || display === "→" || display === "↑" || display === "↓";
}

/**
 * Gets the arrow direction from a display string
 */
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
