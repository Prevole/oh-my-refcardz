import {
  actionHandlerRegistry,
  type BoundHandler,
} from "@/lib/action-handler-registry";
import {
  scopeToContext,
  matchesAction,
  type KeybindingAction,
  type KeybindingContext,
} from "@/lib/keybindings";
import type { KeyboardScopeId, ScopeEntry } from "@/lib/keyboard-scope";

export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (target.isContentEditable) return true;
  return false;
}

interface DispatchDeps {
  /** Resolve the action set bound to a keybinding context. */
  getActionsForContext: (context: KeybindingContext) => KeybindingAction[];
  /** Read all handlers currently bound to a scope. */
  getHandlersForScope?: (scope: KeyboardScopeId) => BoundHandler[];
}

type DispatchOutcome =
  | { kind: "ignored-editable" }
  | { kind: "no-match" }
  | { kind: "blocked-modal"; scope: KeyboardScopeId }
  | { kind: "matched"; scope: KeyboardScopeId; actionId: string }
  | { kind: "conflict"; scope: KeyboardScopeId; actionIds: string[] };

interface MatchCandidate {
  bound: BoundHandler;
  action: KeybindingAction;
}

/**
 * Pure dispatch routine: walks the scope stack top-down, runs at most one
 * handler. Returns a structured outcome to make behavior observable in tests.
 *
 * Modality: when a modal scope has no matches (either no handlers at all,
 * or none matched the event), the cascade stops at it.
 *
 * Conflict policy: when two handlers in the same scope match the same event,
 * throws in development. In other environments, callers can pass an
 * `onConflict` hook to log; the dispatcher will still pick the first match
 * deterministically.
 */
export function dispatchKeyEvent(
  event: KeyboardEvent,
  scopeStack: ReadonlyArray<ScopeEntry>,
  deps: DispatchDeps,
  onConflict?: (scope: KeyboardScopeId, actionIds: string[]) => void,
): DispatchOutcome {
  if (isEditableTarget(event.target)) {
    return { kind: "ignored-editable" };
  }

  const getHandlers =
    deps.getHandlersForScope ??
    ((scope: KeyboardScopeId) => actionHandlerRegistry.getHandlersForScope(scope));

  for (let i = scopeStack.length - 1; i >= 0; i--) {
    const entry = scopeStack[i];
    const scope = entry.scope;
    const context = scopeToContext(scope);

    if (!context) {
      if (entry.modal) return { kind: "blocked-modal", scope };
      continue;
    }

    const bound = getHandlers(scope);
    const actions = deps.getActionsForContext(context);
    const actionById = new Map(actions.map((a) => [a.id, a]));

    const matches: MatchCandidate[] = [];
    for (const handler of bound) {
      const action = actionById.get(handler.actionId);
      if (!action) continue;
      if (matchesAction(event, action)) {
        matches.push({ bound: handler, action });
      }
    }

    if (matches.length === 0) {
      if (entry.modal) return { kind: "blocked-modal", scope };
      continue;
    }

    if (matches.length > 1) {
      const ids = matches.map((m) => m.action.id);
      if (process.env.NODE_ENV === "development") {
        throw new Error(
          `Conflicting key handlers in scope "${scope}": ${ids.join(", ")}`,
        );
      }
      onConflict?.(scope, ids);
    }

    event.preventDefault();
    matches[0].bound.handler(event);
    return { kind: "matched", scope, actionId: matches[0].action.id };
  }

  return { kind: "no-match" };
}
