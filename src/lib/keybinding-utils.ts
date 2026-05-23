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
  const result = {} as KeybindingsConfig;

  // Initialise every known context with an empty list so the result always has
  // the full shape. Unknown contexts present in `stored` (e.g. legacy keys
  // from a previous schema like the removed `sheet-layout`) are silently
  // ignored: the iteration below only walks defaults, so a stored payload
  // that references a context we no longer expose simply falls through.
  for (const context of Object.keys(DEFAULT_KEYBINDINGS) as KeybindingContext[]) {
    result[context] = [];
  }

  for (const context of Object.keys(DEFAULT_KEYBINDINGS) as KeybindingContext[]) {
    const defaultActions = DEFAULT_KEYBINDINGS[context];
    const storedActions = stored[context] ?? [];

    result[context] = defaultActions.map((defaultAction) => {
      // Stored actions whose id no longer exists in the defaults are dropped
      // here too — we only look up by the default id, so a renamed/removed
      // action ID never makes it back into the active config.
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

export function dedupeCombos(combos: KeyCombo[]): KeyCombo[] {
  const result: KeyCombo[] = [];

  for (const combo of combos) {
    if (result.some((existing) => combosEqual(existing, combo))) {
      continue;
    }

    result.push(combo);
  }

  return result;
}

// Scope-local conflict detection: two actions conflict only when they live
// in the same keybinding context. Cross-context "shadowing" (e.g. a `home`
// override masking a `global` binding) is intentional and not reported as
// a conflict here.
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

  return null;
}
