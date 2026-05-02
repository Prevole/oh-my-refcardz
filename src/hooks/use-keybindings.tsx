"use client";

import {
  createContext,
  useContext,
  useCallback,
  useSyncExternalStore,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import {
  DEFAULT_KEYBINDINGS,
  matchesAction,
  type KeybindingsConfig,
  type KeybindingContext,
  type KeybindingAction,
  type ActionId,
  type KeyCombo,
} from "@/lib/keybindings";

// ─────────────────────────────────────────────────────────────────────────────
// Storage
// ─────────────────────────────────────────────────────────────────────────────

const STORAGE_KEY = "oh-my-refcardz:keybindings";

let cachedConfig: KeybindingsConfig | null = null;

function loadKeybindings(): KeybindingsConfig {
  if (typeof window === "undefined") {
    return DEFAULT_KEYBINDINGS;
  }

  if (cachedConfig !== null) {
    return cachedConfig;
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as Partial<KeybindingsConfig>;
      // Deep merge with defaults to handle new actions
      cachedConfig = mergeWithDefaults(parsed);
      return cachedConfig;
    }
  } catch {
    // Ignore parse errors
  }

  cachedConfig = DEFAULT_KEYBINDINGS;
  return DEFAULT_KEYBINDINGS;
}

function saveKeybindings(config: KeybindingsConfig): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    cachedConfig = config;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY }));
  } catch {
    // Ignore storage errors
  }
}

function subscribe(callback: () => void): () => void {
  const handleStorageChange = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY || event.key === null) {
      cachedConfig = null;
      callback();
    }
  };
  window.addEventListener("storage", handleStorageChange);
  return () => window.removeEventListener("storage", handleStorageChange);
}

function getSnapshot(): KeybindingsConfig {
  return loadKeybindings();
}

function getServerSnapshot(): KeybindingsConfig {
  return DEFAULT_KEYBINDINGS;
}

// ─────────────────────────────────────────────────────────────────────────────
// Merge utilities
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Merges stored keybindings with defaults, keeping user customizations
 * but adding any new actions from defaults
 */
function mergeWithDefaults(stored: Partial<KeybindingsConfig>): KeybindingsConfig {
  const result: KeybindingsConfig = {
    global: [],
    home: [],
    sheet: [],
    "sheet-commands": [],
  };

  for (const context of Object.keys(DEFAULT_KEYBINDINGS) as KeybindingContext[]) {
    const defaultActions = DEFAULT_KEYBINDINGS[context];
    const storedActions = stored[context] ?? [];

    result[context] = defaultActions.map((defaultAction) => {
      const storedAction = storedActions.find((a) => a.id === defaultAction.id);
      if (storedAction) {
        // Use stored combos but keep default label (in case we update it)
        return { ...defaultAction, combos: storedAction.combos };
      }
      return defaultAction;
    });
  }

  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// Conflict detection
// ─────────────────────────────────────────────────────────────────────────────

export interface KeybindingConflict {
  /** The action that already uses this combo */
  existingAction: KeybindingAction;
  /** The context where the conflict occurs */
  context: KeybindingContext;
}

/**
 * Checks if a combo is already used by another action in the same context
 */
function findConflict(
  config: KeybindingsConfig,
  context: KeybindingContext,
  actionId: string,
  newCombo: KeyCombo
): KeybindingConflict | null {
  // Check same context
  for (const action of config[context]) {
    if (action.id === actionId) continue;
    
    for (const combo of action.combos) {
      if (combosEqual(combo, newCombo)) {
        return { existingAction: action, context };
      }
    }
  }

  // Also check global context if we're not already in it
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

  return null;
}

function combosEqual(a: KeyCombo, b: KeyCombo): boolean {
  if (a.key !== b.key) return false;
  if (a.modifiers.length !== b.modifiers.length) return false;
  if (!a.modifiers.every((m) => b.modifiers.includes(m))) return false;
  if (!a.next && !b.next) return true;
  if (!a.next || !b.next) return false;
  return combosEqual(a.next, b.next);
}

// ─────────────────────────────────────────────────────────────────────────────
// Context
// ─────────────────────────────────────────────────────────────────────────────

interface KeybindingsContextValue {
  /** Current keybindings configuration */
  config: KeybindingsConfig;

  /** Get actions for a specific context */
  getActionsForContext: (context: KeybindingContext) => KeybindingAction[];

  /** Get a specific action by ID */
  getAction: (actionId: ActionId) => KeybindingAction | null;

  /** Check if an event matches an action */
  matchesAction: (event: KeyboardEvent, actionId: ActionId) => boolean;

  /** Resolve one matching action from a prioritized list */
  resolveAction: (event: KeyboardEvent, actionIds: ActionId[]) => ActionId | null;

  /** Update combos for an action */
  setActionCombos: (
    context: KeybindingContext,
    actionId: string,
    combos: KeyCombo[]
  ) => KeybindingConflict | null;

  /** Add a combo to an action */
  addCombo: (
    context: KeybindingContext,
    actionId: string,
    combo: KeyCombo
  ) => KeybindingConflict | null;

  /** Remove a combo from an action */
  removeCombo: (
    context: KeybindingContext,
    actionId: string,
    comboIndex: number
  ) => void;

  /** Set a combo as primary (move to first position) */
  setPrimaryCombo: (
    context: KeybindingContext,
    actionId: string,
    comboIndex: number
  ) => void;

  /** Reset a single action to defaults */
  resetAction: (context: KeybindingContext, actionId: string) => void;

  /** Reset all keybindings to defaults */
  resetAll: () => void;

  /** Check for conflicts before setting a combo */
  checkConflict: (
    context: KeybindingContext,
    actionId: string,
    combo: KeyCombo
  ) => KeybindingConflict | null;
}

const KeybindingsContext = createContext<KeybindingsContextValue | null>(null);

// ─────────────────────────────────────────────────────────────────────────────
// Provider
// ─────────────────────────────────────────────────────────────────────────────

export function KeybindingsProvider({ children }: { children: ReactNode }) {
  const config = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const pendingSequenceRef = useRef<
    Array<{ actionId: ActionId; next: KeyCombo; expiresAt: number }>
  >([]);

  const SEQUENCE_TIMEOUT_MS = 800;

  const getActionsForContext = useCallback(
    (context: KeybindingContext): KeybindingAction[] => {
      return config[context];
    },
    [config]
  );

  const getAction = useCallback(
    (actionId: ActionId): KeybindingAction | null => {
      for (const context of Object.keys(config) as KeybindingContext[]) {
        const action = config[context].find((a) => a.id === actionId);
        if (action) return action;
      }
      return null;
    },
    [config]
  );

  const resolveActionFn = useCallback(
    (event: KeyboardEvent, actionIds: ActionId[]): ActionId | null => {
      const now = Date.now();
      const pending = pendingSequenceRef.current.filter((entry) => entry.expiresAt >= now);

      if (pending.length > 0) {
        const pendingActionIds = new Set(pending.map((entry) => entry.actionId));
        const hasRelevantPending = actionIds.some((actionId) => pendingActionIds.has(actionId));

        if (!hasRelevantPending) {
          pendingSequenceRef.current = pending;
          return null;
        }

        for (const actionId of actionIds) {
          const candidate = pending.find((entry) => entry.actionId === actionId);
          if (candidate && matchesAction(event, { id: actionId, label: "", combos: [candidate.next] })) {
            pendingSequenceRef.current = [];
            return actionId;
          }
        }

        pendingSequenceRef.current = [];
      }

      const nextPending: Array<{ actionId: ActionId; next: KeyCombo; expiresAt: number }> = [];

      for (const actionId of actionIds) {
        const action = getAction(actionId);
        if (!action) continue;

        for (const binding of action.combos) {
          if (!binding.next) {
            if (matchesAction(event, { ...action, combos: [binding] })) {
              return actionId;
            }
            continue;
          }

          const firstStep: KeyCombo = { key: binding.key, modifiers: binding.modifiers };
          if (matchesAction(event, { ...action, combos: [firstStep] })) {
            nextPending.push({ actionId, next: binding.next, expiresAt: now + SEQUENCE_TIMEOUT_MS });
          }
        }
      }

      pendingSequenceRef.current = nextPending;
      return null;
    },
    [getAction]
  );

  const matchesActionFn = useCallback(
    (event: KeyboardEvent, actionId: ActionId): boolean => {
      const action = getAction(actionId);
      if (!action) return false;
      return matchesAction(event, action);
    },
    [getAction]
  );

  const checkConflict = useCallback(
    (
      context: KeybindingContext,
      actionId: string,
      combo: KeyCombo
    ): KeybindingConflict | null => {
      return findConflict(config, context, actionId, combo);
    },
    [config]
  );

  const setActionCombos = useCallback(
    (
      context: KeybindingContext,
      actionId: string,
      combos: KeyCombo[]
    ): KeybindingConflict | null => {
      // Check for conflicts with the first combo (main one)
      if (combos.length > 0) {
        const conflict = findConflict(config, context, actionId, combos[0]);
        if (conflict) {
          // Remove the conflicting combo from the existing action
          const newConfig = { ...config };
          newConfig[conflict.context] = newConfig[conflict.context].map((action) => {
            if (action.id === conflict.existingAction.id) {
              return {
                ...action,
                combos: action.combos.filter((c) => !combosEqual(c, combos[0])),
              };
            }
            return action;
          });

          // Now update the target action
          newConfig[context] = newConfig[context].map((action) => {
            if (action.id === actionId) {
              return { ...action, combos };
            }
            return action;
          });

          saveKeybindings(newConfig);
          return conflict;
        }
      }

      // No conflict, just update
      const newConfig = { ...config };
      newConfig[context] = newConfig[context].map((action) => {
        if (action.id === actionId) {
          return { ...action, combos };
        }
        return action;
      });

      saveKeybindings(newConfig);
      return null;
    },
    [config]
  );

  const addCombo = useCallback(
    (
      context: KeybindingContext,
      actionId: string,
      combo: KeyCombo
    ): KeybindingConflict | null => {
      const action = config[context].find((a) => a.id === actionId);
      if (!action) return null;

      const conflict = findConflict(config, context, actionId, combo);

      const newConfig = { ...config };

      // If there's a conflict, remove the combo from the conflicting action
      if (conflict) {
        newConfig[conflict.context] = newConfig[conflict.context].map((a) => {
          if (a.id === conflict.existingAction.id) {
            return {
              ...a,
              combos: a.combos.filter((c) => !combosEqual(c, combo)),
            };
          }
          return a;
        });
      }

      // Add the new combo to the target action
      newConfig[context] = newConfig[context].map((a) => {
        if (a.id === actionId) {
          return { ...a, combos: [...a.combos, combo] };
        }
        return a;
      });

      saveKeybindings(newConfig);
      return conflict;
    },
    [config]
  );

  const removeCombo = useCallback(
    (context: KeybindingContext, actionId: string, comboIndex: number) => {
      const newConfig = { ...config };
      newConfig[context] = newConfig[context].map((action) => {
        if (action.id === actionId) {
          const newCombos = [...action.combos];
          newCombos.splice(comboIndex, 1);
          return { ...action, combos: newCombos };
        }
        return action;
      });

      saveKeybindings(newConfig);
    },
    [config]
  );

  const setPrimaryCombo = useCallback(
    (context: KeybindingContext, actionId: string, comboIndex: number) => {
      if (comboIndex === 0) return; // Already primary

      const newConfig = { ...config };
      newConfig[context] = newConfig[context].map((action) => {
        if (action.id === actionId && comboIndex < action.combos.length) {
          const newCombos = [...action.combos];
          const [combo] = newCombos.splice(comboIndex, 1);
          newCombos.unshift(combo);
          return { ...action, combos: newCombos };
        }
        return action;
      });

      saveKeybindings(newConfig);
    },
    [config]
  );

  const resetAction = useCallback(
    (context: KeybindingContext, actionId: string) => {
      const defaultAction = DEFAULT_KEYBINDINGS[context].find((a) => a.id === actionId);
      if (!defaultAction) return;

      const newConfig = { ...config };
      newConfig[context] = newConfig[context].map((action) => {
        if (action.id === actionId) {
          return { ...action, combos: defaultAction.combos };
        }
        return action;
      });

      saveKeybindings(newConfig);
    },
    [config]
  );

  const resetAll = useCallback(() => {
    cachedConfig = null;
    localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY }));
  }, []);

  const value = useMemo<KeybindingsContextValue>(
    () => ({
      config,
      getActionsForContext,
      getAction,
      matchesAction: matchesActionFn,
      resolveAction: resolveActionFn,
      setActionCombos,
      addCombo,
      removeCombo,
      setPrimaryCombo,
      resetAction,
      resetAll,
      checkConflict,
    }),
    [
      config,
      getActionsForContext,
      getAction,
      matchesActionFn,
      resolveActionFn,
      setActionCombos,
      addCombo,
      removeCombo,
      setPrimaryCombo,
      resetAction,
      resetAll,
      checkConflict,
    ]
  );

  return (
    <KeybindingsContext.Provider value={value}>
      {children}
    </KeybindingsContext.Provider>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────

export function useKeybindings(): KeybindingsContextValue {
  const context = useContext(KeybindingsContext);
  if (!context) {
    throw new Error("useKeybindings must be used within a KeybindingsProvider");
  }
  return context;
}

/**
 * Hook to get keybindings for a specific context
 */
export function useContextKeybindings(context: KeybindingContext): KeybindingAction[] {
  const { getActionsForContext } = useKeybindings();
  return getActionsForContext(context);
}

/**
 * Hook to check if an event matches an action
 */
export function useActionMatcher() {
  const { matchesAction } = useKeybindings();
  return matchesAction;
}
