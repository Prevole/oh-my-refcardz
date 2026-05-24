"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  pushScopeToStack,
  popScopeFromStack,
  isScopeActiveInStack,
  getActiveScope,
  type KeyboardScopeId,
  type ScopeEntry,
} from "@/lib/keyboard-scope";

export type { KeyboardScopeId } from "@/lib/keyboard-scope";

export interface PushScopeOptions {
  /** Modal scopes block unmatched events from cascading to lower scopes. */
  modal?: boolean;
}

type KeyboardContextValue = {
  activeScope: KeyboardScopeId;
  scopeStack: ReadonlyArray<ScopeEntry>;
  isScopeActive: (scope: KeyboardScopeId) => boolean;
  pushScope: (scope: KeyboardScopeId, options?: PushScopeOptions) => void;
  popScope: (scope: KeyboardScopeId) => void;
};

const KeyboardContext = createContext<KeyboardContextValue | null>(null);

const ROOT_ENTRY: ScopeEntry = { scope: "global", modal: false };

export function KeyboardContextProvider({ children }: { children: ReactNode }) {
  const [scopeStack, setScopeStack] = useState<ScopeEntry[]>([ROOT_ENTRY]);

  const activeScope = getActiveScope(scopeStack);

  const isScopeActive = useCallback(
    (scope: KeyboardScopeId) => isScopeActiveInStack(scopeStack, scope),
    [scopeStack]
  );

  const pushScope = useCallback(
    (scope: KeyboardScopeId, options?: PushScopeOptions) => {
      const modal = options?.modal ?? false;
      setScopeStack((prev) => pushScopeToStack(prev, scope, modal));
    },
    []
  );

  const popScope = useCallback((scope: KeyboardScopeId) => {
    setScopeStack((prev) => popScopeFromStack(prev, scope));
  }, []);

  const value = useMemo<KeyboardContextValue>(
    () => ({
      activeScope,
      scopeStack,
      isScopeActive,
      pushScope,
      popScope,
    }),
    [activeScope, scopeStack, isScopeActive, pushScope, popScope]
  );

  return (
    <KeyboardContext.Provider value={value}>
      {children}
    </KeyboardContext.Provider>
  );
}

export function useKeyboardContext(): KeyboardContextValue {
  const context = useContext(KeyboardContext);
  if (!context) {
    throw new Error("useKeyboardContext must be used within a KeyboardContextProvider");
  }
  return context;
}

export function useKeyboardScope(
  scope: KeyboardScopeId,
  active: boolean,
  options?: PushScopeOptions,
): boolean {
  const { isScopeActive, pushScope, popScope } = useKeyboardContext();
  const wasActiveRef = useRef(false);
  const modal = options?.modal ?? false;

  useEffect(() => {
    if (active && !wasActiveRef.current) {
      pushScope(scope, { modal });
      wasActiveRef.current = true;
    } else if (!active && wasActiveRef.current) {
      popScope(scope);
      wasActiveRef.current = false;
    }
  }, [active, scope, modal, pushScope, popScope]);

  useEffect(() => {
    return () => {
      if (wasActiveRef.current) {
        popScope(scope);
        wasActiveRef.current = false;
      }
    };
  }, [scope, popScope]);

  return isScopeActive(scope);
}

export function useScopedKeyboardHandler(
  scope: KeyboardScopeId,
  handler: (event: KeyboardEvent) => void,
  deps: unknown[] = []
) {
  const { isScopeActive } = useKeyboardContext();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!isScopeActive(scope)) return;
      handler(event);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, isScopeActive, handler, ...deps]);
}
