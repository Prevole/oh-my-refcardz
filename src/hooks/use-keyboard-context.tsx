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

export type KeyboardScopeId = "global" | "settings" | "help" | "info" | "sheet-commands" | "sheet-layout";

type KeyboardContextValue = {
  activeScope: KeyboardScopeId;
  isScopeActive: (scope: KeyboardScopeId) => boolean;
  pushScope: (scope: KeyboardScopeId) => void;
  popScope: (scope: KeyboardScopeId) => void;
};

const KeyboardContext = createContext<KeyboardContextValue | null>(null);

export function KeyboardContextProvider({ children }: { children: ReactNode }) {
  const [scopeStack, setScopeStack] = useState<KeyboardScopeId[]>(["global"]);

  const activeScope = scopeStack[scopeStack.length - 1];

  const isScopeActive = useCallback(
    (scope: KeyboardScopeId) => activeScope === scope,
    [activeScope]
  );

  const pushScope = useCallback((scope: KeyboardScopeId) => {
    setScopeStack((prev) => {
      if (prev[prev.length - 1] === scope) return prev;
      return [...prev, scope];
    });
  }, []);

  const popScope = useCallback((scope: KeyboardScopeId) => {
    setScopeStack((prev) => {
      const index = prev.lastIndexOf(scope);
      if (index === -1 || index === 0) return prev;
      return [...prev.slice(0, index), ...prev.slice(index + 1)];
    });
  }, []);

  const value = useMemo<KeyboardContextValue>(
    () => ({
      activeScope,
      isScopeActive,
      pushScope,
      popScope,
    }),
    [activeScope, isScopeActive, pushScope, popScope]
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

export function useKeyboardScope(scope: KeyboardScopeId, active: boolean): boolean {
  const { isScopeActive, pushScope, popScope } = useKeyboardContext();
  const wasActiveRef = useRef(false);

  useEffect(() => {
    if (active && !wasActiveRef.current) {
      pushScope(scope);
      wasActiveRef.current = true;
    } else if (!active && wasActiveRef.current) {
      popScope(scope);
      wasActiveRef.current = false;
    }
  }, [active, scope, pushScope, popScope]);

  useEffect(() => {
    return () => {
      if (wasActiveRef.current) {
        popScope(scope);
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
