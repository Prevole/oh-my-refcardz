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
import {
  mergeWithDefaults,
  combosEqual,
  dedupeCombos,
  findConflict,
  type KeybindingConflict,
} from "@/lib/keybinding-utils";

export type { KeybindingConflict } from "@/lib/keybinding-utils";

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
      cachedConfig = mergeWithDefaults(parsed);
      return cachedConfig;
    }
  } catch {
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

interface KeybindingsContextValue {
  config: KeybindingsConfig;
  getActionsForContext: (context: KeybindingContext) => KeybindingAction[];
  getAction: (actionId: ActionId) => KeybindingAction | null;
  matchesAction: (event: KeyboardEvent, actionId: ActionId) => boolean;
  resolveAction: (event: KeyboardEvent, actionIds: ActionId[]) => ActionId | null;
  setActionCombos: (
    context: KeybindingContext,
    actionId: string,
    combos: KeyCombo[]
  ) => KeybindingConflict | null;
  addCombo: (
    context: KeybindingContext,
    actionId: string,
    combo: KeyCombo
  ) => KeybindingConflict | null;
  removeCombo: (
    context: KeybindingContext,
    actionId: string,
    comboIndex: number
  ) => void;
  setPrimaryCombo: (
    context: KeybindingContext,
    actionId: string,
    comboIndex: number
  ) => void;

  resetAction: (context: KeybindingContext, actionId: string) => KeybindingConflict | null;
  resetActions: (
    targets: ReadonlyArray<{ context: KeybindingContext; actionId: string }>
  ) => void;
  checkConflict: (
    context: KeybindingContext,
    actionId: string,
    combo: KeyCombo
  ) => KeybindingConflict | null;
}

const KeybindingsContext = createContext<KeybindingsContextValue | null>(null);

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
      const uniqueCombos = dedupeCombos(combos);

      if (combos.length > 0) {
        const conflict = findConflict(config, context, actionId, uniqueCombos[0]);
        if (conflict) {
          const newConfig = { ...config };
          newConfig[conflict.context] = newConfig[conflict.context].map((action) => {
            if (action.id === conflict.existingAction.id) {
              return {
                ...action,
                combos: action.combos.filter((c) => !combosEqual(c, uniqueCombos[0])),
              };
            }
            return action;
          });

          newConfig[context] = newConfig[context].map((action) => {
            if (action.id === actionId) {
              return { ...action, combos: uniqueCombos };
            }
            return action;
          });

          saveKeybindings(newConfig);
          return conflict;
        }
      }

      const newConfig = { ...config };
      newConfig[context] = newConfig[context].map((action) => {
        if (action.id === actionId) {
          return { ...action, combos: uniqueCombos };
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

      newConfig[context] = newConfig[context].map((a) => {
        if (a.id === actionId) {
          return { ...a, combos: dedupeCombos([...a.combos, combo]) };
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
    (context: KeybindingContext, actionId: string): KeybindingConflict | null => {
      const defaultAction = DEFAULT_KEYBINDINGS[context].find((a) => a.id === actionId);
      if (!defaultAction) return null;

      let newConfig = { ...config };
      let firstConflict: KeybindingConflict | null = null;

      for (const combo of defaultAction.combos) {
        const conflict = findConflict(newConfig, context, actionId, combo);
        if (conflict) {
          if (!firstConflict) {
            firstConflict = conflict;
          }
          newConfig = { ...newConfig };
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
      }

      newConfig[context] = newConfig[context].map((action) => {
        if (action.id === actionId) {
          return { ...action, combos: defaultAction.combos };
        }
        return action;
      });

      saveKeybindings(newConfig);
      return firstConflict;
    },
    [config]
  );

  const resetActions = useCallback(
    (
      targets: ReadonlyArray<{ context: KeybindingContext; actionId: string }>
    ): void => {
      let working = { ...config };
      let changed = false;

      for (const { context, actionId } of targets) {
        const defaultAction = DEFAULT_KEYBINDINGS[context].find((a) => a.id === actionId);
        if (!defaultAction) continue;

        working = { ...working };
        working[context] = working[context].map((action) => {
          if (action.id === actionId) {
            return { ...action, combos: defaultAction.combos };
          }
          return action;
        });
        changed = true;
      }

      if (changed) {
        saveKeybindings(working);
      }
    },
    [config]
  );

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
      resetActions,
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
      resetActions,
      checkConflict,
    ]
  );

  return (
    <KeybindingsContext.Provider value={value}>
      {children}
    </KeybindingsContext.Provider>
  );
}

export function useKeybindings(): KeybindingsContextValue {
  const context = useContext(KeybindingsContext);
  if (!context) {
    throw new Error("useKeybindings must be used within a KeybindingsProvider");
  }
  return context;
}
