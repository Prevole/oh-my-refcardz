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

export type KeybindingContext = "global" | "home" | "sheet" | "sheet-layout";

export function scopeToContext(scope: KeyboardScopeId): KeybindingContext | null {
  switch (scope) {
    case "global":
      return "global";
    case "sheet-layout":
      return "sheet-layout";
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
  TOGGLE_DEBUG_OVERLAY: "sheet.toggle-debug-overlay",

  CARD_NAV_LEFT: "sheet-layout.nav-left",
  CARD_NAV_RIGHT: "sheet-layout.nav-right",
  CARD_NAV_UP: "sheet-layout.nav-up",
  CARD_NAV_DOWN: "sheet-layout.nav-down",
  CARD_CLEAR_FOCUS: "sheet-layout.clear-focus",
  CARD_MOVE_LEFT: "sheet-layout.move-left",
  CARD_MOVE_RIGHT: "sheet-layout.move-right",
  CARD_MOVE_UP: "sheet-layout.move-up",
  CARD_MOVE_DOWN: "sheet-layout.move-down",
  CARD_SHRINK_WIDTH: "sheet-layout.shrink-width",
  CARD_GROW_WIDTH: "sheet-layout.grow-width",
  CARD_SHRINK_HEIGHT: "sheet-layout.shrink-height",
  CARD_GROW_HEIGHT: "sheet-layout.grow-height",
  LAYOUT_DEV_SAVE: "sheet-layout.dev-save",
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
      id: ACTION_IDS.TOGGLE_DEBUG_OVERLAY,
      label: "Toggle layout debug overlay",
      combos: [combo("d", "ctrl", "shift")],
    },
  ],

  "sheet-layout": [
    {
      id: ACTION_IDS.CARD_NAV_LEFT,
      label: "Navigate to card left",
      combos: [combo("h", "shift"), combo("ArrowLeft", "shift")],
    },
    {
      id: ACTION_IDS.CARD_NAV_RIGHT,
      label: "Navigate to card right",
      combos: [combo("l", "shift"), combo("ArrowRight", "shift")],
    },
    {
      id: ACTION_IDS.CARD_NAV_UP,
      label: "Navigate to card above",
      combos: [combo("k", "shift"), combo("ArrowUp", "shift")],
    },
    {
      id: ACTION_IDS.CARD_NAV_DOWN,
      label: "Navigate to card below",
      combos: [combo("j", "shift"), combo("ArrowDown", "shift")],
    },
    {
      id: ACTION_IDS.CARD_CLEAR_FOCUS,
      label: "Clear card focus",
      combos: [key("Escape")],
    },
    {
      id: ACTION_IDS.CARD_MOVE_LEFT,
      label: "Move card left",
      combos: [combo("h", "alt"), combo("ArrowLeft", "alt")],
    },
    {
      id: ACTION_IDS.CARD_MOVE_RIGHT,
      label: "Move card right",
      combos: [combo("l", "alt"), combo("ArrowRight", "alt")],
    },
    {
      id: ACTION_IDS.CARD_MOVE_UP,
      label: "Move card up",
      combos: [combo("k", "alt"), combo("ArrowUp", "alt")],
    },
    {
      id: ACTION_IDS.CARD_MOVE_DOWN,
      label: "Move card down",
      combos: [combo("j", "alt"), combo("ArrowDown", "alt")],
    },
    {
      id: ACTION_IDS.CARD_SHRINK_WIDTH,
      label: "Shrink card width",
      combos: [combo("H", "alt", "shift"), combo("ArrowLeft", "alt", "shift")],
    },
    {
      id: ACTION_IDS.CARD_GROW_WIDTH,
      label: "Grow card width",
      combos: [combo("L", "alt", "shift"), combo("ArrowRight", "alt", "shift")],
    },
    {
      id: ACTION_IDS.CARD_SHRINK_HEIGHT,
      label: "Shrink card height",
      combos: [combo("K", "alt", "shift"), combo("ArrowUp", "alt", "shift")],
    },
    {
      id: ACTION_IDS.CARD_GROW_HEIGHT,
      label: "Grow card height",
      combos: [combo("J", "alt", "shift"), combo("ArrowDown", "alt", "shift")],
    },
    {
      id: ACTION_IDS.LAYOUT_DEV_SAVE,
      label: "Save layout to dev backend",
      combos: [combo("s", "ctrl", "shift")],
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
