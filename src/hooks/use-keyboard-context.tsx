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

/**
 * Keyboard context system for managing contextual keyboard shortcuts.
 *
 * Contexts are organized in a stack:
 * - The "global" context is always at the bottom
 * - Panels/modals push their context when they open
 * - Only the topmost context receives keyboard events
 *
 * Example usage:
 *   const { isActive } = useKeyboardScope("settings");
 *   // In settings panel: pushScope("settings") on open, popScope("settings") on close
 */

export type KeyboardScopeId = "global" | "settings" | "help" | "info" | "sheet-commands" | "sheet-layout";

type KeyboardContextValue = {
  /** Current active scope (top of the stack) */
  activeScope: KeyboardScopeId;
  /** Check if a specific scope is currently active */
  isScopeActive: (scope: KeyboardScopeId) => boolean;
  /** Push a scope onto the stack (call when panel opens) */
  pushScope: (scope: KeyboardScopeId) => void;
  /** Pop a scope from the stack (call when panel closes) */
  popScope: (scope: KeyboardScopeId) => void;
};

const KeyboardContext = createContext<KeyboardContextValue | null>(null);

export function KeyboardContextProvider({ children }: { children: ReactNode }) {
  // Stack of active scopes, "global" is always at the bottom
  const [scopeStack, setScopeStack] = useState<KeyboardScopeId[]>(["global"]);

  const activeScope = scopeStack[scopeStack.length - 1];

  const isScopeActive = useCallback(
    (scope: KeyboardScopeId) => activeScope === scope,
    [activeScope]
  );

  const pushScope = useCallback((scope: KeyboardScopeId) => {
    setScopeStack((prev) => {
      // Don't push if already on top
      if (prev[prev.length - 1] === scope) return prev;
      return [...prev, scope];
    });
  }, []);

  const popScope = useCallback((scope: KeyboardScopeId) => {
    setScopeStack((prev) => {
      // Find and remove the scope from the stack
      const index = prev.lastIndexOf(scope);
      if (index === -1 || index === 0) return prev; // Don't remove "global"
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

/**
 * Hook to access the keyboard context
 */
export function useKeyboardContext(): KeyboardContextValue {
  const context = useContext(KeyboardContext);
  if (!context) {
    throw new Error("useKeyboardContext must be used within a KeyboardContextProvider");
  }
  return context;
}

/**
 * Hook to manage a specific keyboard scope.
 * Automatically pushes/pops the scope based on `active` prop.
 *
 * @param scope - The scope identifier
 * @param active - Whether this scope should be active (e.g., when panel is open)
 * @returns Whether this scope is currently the active (topmost) scope
 */
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

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (wasActiveRef.current) {
        popScope(scope);
      }
    };
  }, [scope, popScope]);

  return isScopeActive(scope);
}

/**
 * Hook for registering keyboard shortcuts that only fire when a scope is active.
 * This is a convenience wrapper around useEffect + addEventListener.
 *
 * @param scope - The scope in which this handler should be active
 * @param handler - The keyboard event handler
 * @param deps - Additional dependencies for the effect
 */
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
