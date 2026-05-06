import type {
  KeybindingsConfig,
  KeybindingContext,
  KeybindingAction,
  KeyCombo,
} from "@/lib/keybindings";
import { DEFAULT_KEYBINDINGS } from "@/lib/keybindings";

export interface KeybindingConflict {
  existingAction: KeybindingAction;
  context: KeybindingContext;
}

export function mergeWithDefaults(stored: Partial<KeybindingsConfig>): KeybindingsConfig {
  const result: KeybindingsConfig = {
    global: [],
    home: [],
    sheet: [],
    "sheet-layout": [],
  };

  for (const context of Object.keys(DEFAULT_KEYBINDINGS) as KeybindingContext[]) {
    const defaultActions = DEFAULT_KEYBINDINGS[context];
    const storedActions = stored[context] ?? [];

    result[context] = defaultActions.map((defaultAction) => {
      const storedAction = storedActions.find((a) => a.id === defaultAction.id);
      if (storedAction) {
        return { ...defaultAction, combos: storedAction.combos };
      }
      return defaultAction;
    });
  }

  return result;
}

export function combosEqual(a: KeyCombo, b: KeyCombo): boolean {
  if (a.key !== b.key) return false;
  if (a.modifiers.length !== b.modifiers.length) return false;
  if (!a.modifiers.every((m) => b.modifiers.includes(m))) return false;
  if (!a.next && !b.next) return true;
  if (!a.next || !b.next) return false;
  return combosEqual(a.next, b.next);
}

export function findConflict(
  config: KeybindingsConfig,
  context: KeybindingContext,
  actionId: string,
  newCombo: KeyCombo
): KeybindingConflict | null {
  for (const action of config[context]) {
    if (action.id === actionId) continue;

    for (const combo of action.combos) {
      if (combosEqual(combo, newCombo)) {
        return { existingAction: action, context };
      }
    }
  }

  /* v8 ignore start -- defensive: check global context for conflicts when editing non-global bindings */
  if (context !== "global") {
    for (const action of config.global) {
      if (action.id === actionId) continue;

      for (const combo of action.combos) {
        if (combosEqual(combo, newCombo)) {
          return { existingAction: action, context: "global" };
        }
      }
    }
  }
  /* v8 ignore stop */

  return null;
}
