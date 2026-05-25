import type { KeyboardScopeId, ScopeEntry } from "@/lib/keyboard-scope";
import { pushScopeToStack, popScopeFromStack } from "@/lib/keyboard-scope";

/**
 * Imperative wrapper around the pure `pushScopeToStack` /
 * `popScopeFromStack` helpers. Exposes a stack value via an
 * always-current `current` field plus a snapshot getter, and supports
 * subscriptions so a host (the React provider) can re-render when the
 * stack changes.
 *
 * The motivation is to expose a synchronous read path for the keyboard
 * dispatcher. React state updates triggered by a keydown handler are
 * not committed before the next key event is dispatched, which can let
 * a parent scope match an event that should have been blocked by a
 * freshly-pushed modal child scope. Reading from `current` instead of
 * a closed-over state value avoids that race entirely.
 */
export interface ScopeStackManager {
  /** Read-only live view of the stack. Always reflects the latest push/pop. */
  readonly current: ReadonlyArray<ScopeEntry>;
  push(scope: KeyboardScopeId, modal: boolean): ReadonlyArray<ScopeEntry>;
  pop(scope: KeyboardScopeId): ReadonlyArray<ScopeEntry>;
  /** Subscribe to mutations. Returns an unsubscribe callback. */
  subscribe(listener: (stack: ReadonlyArray<ScopeEntry>) => void): () => void;
}

export function createScopeStackManager(initial: ScopeEntry[]): ScopeStackManager {
  let stack: ReadonlyArray<ScopeEntry> = initial;
  const listeners = new Set<(stack: ReadonlyArray<ScopeEntry>) => void>();

  function notify(next: ReadonlyArray<ScopeEntry>) {
    for (const listener of listeners) listener(next);
  }

  return {
    get current() {
      return stack;
    },
    push(scope, modal) {
      const next = pushScopeToStack(stack as ScopeEntry[], scope, modal);
      if (next !== stack) {
        stack = next;
        notify(next);
      }
      return stack;
    },
    pop(scope) {
      const next = popScopeFromStack(stack as ScopeEntry[], scope);
      if (next !== stack) {
        stack = next;
        notify(next);
      }
      return stack;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
