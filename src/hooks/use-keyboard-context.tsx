"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  isScopeActiveInStack,
  getActiveScope,
  type KeyboardScopeId,
  type ScopeEntry,
} from "@/lib/keyboard-scope";
import {
  createScopeStackManager,
  type ScopeStackManager,
} from "@/lib/scope-stack-manager";

export type { KeyboardScopeId } from "@/lib/keyboard-scope";

export interface PushScopeOptions {
  /** Modal scopes block unmatched events from cascading to lower scopes. */
  modal?: boolean;
}

type KeyboardContextValue = {
  activeScope: KeyboardScopeId;
  scopeStack: ReadonlyArray<ScopeEntry>;
  /**
   * Live read-only view of the scope stack. Reads return the latest
   * value synchronously, even between React commits. The keyboard
   * dispatcher uses this so that a `pushScope` triggered by a previous
   * event is visible to the immediately-following event without
   * waiting for a `setState` flush. The `scopeStack` array above
   * remains the source of truth for components that need to re-render
   * on changes.
   */
  scopeStackRef: { readonly current: ReadonlyArray<ScopeEntry> };
  isScopeActive: (scope: KeyboardScopeId) => boolean;
  pushScope: (scope: KeyboardScopeId, options?: PushScopeOptions) => void;
  popScope: (scope: KeyboardScopeId) => void;
};

const KeyboardContext = createContext<KeyboardContextValue | null>(null);

const ROOT_ENTRY: ScopeEntry = { scope: "global", modal: false };

export function KeyboardContextProvider({ children }: { children: ReactNode }) {
  // The manager owns the canonical stack and exposes a synchronous
  // `current` getter consumed by the keyboard dispatcher. React state
  // mirrors it via `useSyncExternalStore` so consumers re-render on
  // changes and the initial value is always read from the live
  // manager (which may already hold pushes performed by child
  // components whose effects run before the provider's).
  const [manager] = useState<ScopeStackManager>(() =>
    createScopeStackManager([ROOT_ENTRY]),
  );

  const subscribe = useMemo(
    () => (listener: () => void) =>
      manager.subscribe(() => listener()),
    [manager],
  );
  // React Compiler flags `manager.current` access inside a memoized
  // closure as suspicious (`.current` looks like a mutable ref), but
  // this getter is exactly what `useSyncExternalStore` requires.
  // eslint-disable-next-line react-hooks/preserve-manual-memoization
  const getSnapshot = useMemo(() => () => manager.current, [manager]);
  const scopeStack = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const activeScope = getActiveScope(scopeStack as ScopeEntry[]);

  const isScopeActive = useCallback(
    (scope: KeyboardScopeId) => isScopeActiveInStack(scopeStack as ScopeEntry[], scope),
    [scopeStack],
  );

  const pushScope = useCallback(
    (scope: KeyboardScopeId, options?: PushScopeOptions) => {
      manager.push(scope, options?.modal ?? false);
    },
    [manager],
  );

  const popScope = useCallback(
    (scope: KeyboardScopeId) => {
      manager.pop(scope);
    },
    [manager],
  );

  const value = useMemo<KeyboardContextValue>(
    () => ({
      activeScope,
      scopeStack,
      scopeStackRef: manager,
      isScopeActive,
      pushScope,
      popScope,
    }),
    [activeScope, scopeStack, manager, isScopeActive, pushScope, popScope],
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
