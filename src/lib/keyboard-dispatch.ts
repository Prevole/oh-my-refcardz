import {
  actionHandlerRegistry,
  type BoundHandler,
} from "@/lib/action-handler-registry";
import {
  scopeToContext,
  matchesAction,
  ACTION_IDS,
  type ActionId,
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

/**
 * Action IDs that pierce through modal scopes. These are surface-agnostic
 * UI toggles (help, settings): the underlying UI surface remains visually
 * present behind any modal, so the same keybinding should reach its
 * `global`-scope handler regardless of what modal is currently on top.
 *
 * Universals are resolved BEFORE the regular cascade, so a matching event
 * fires once and only once, no matter how deep the scope stack is.
 *
 * Each entry must be bound on the `global` scope. Entries not bound on
 * `global` are silently ignored by the dispatcher.
 */
export const UNIVERSAL_ACTION_IDS: ReadonlyArray<ActionId> = [
  ACTION_IDS.TOGGLE_HELP,
  ACTION_IDS.TOGGLE_SETTINGS,
];

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
 * Universals: before the cascade, any action listed in `UNIVERSAL_ACTION_IDS`
 * that matches the event and has a handler bound on `global` fires
 * immediately. This makes UI toggles (help, settings) reachable from any
 * modal scope without duplicating bindings.
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

  // Universals pre-pass: match against `global` action defs, fire the
  // `global` handler if any. Skipped silently when the action is not
  // configured or not bound.
  const globalActions = deps.getActionsForContext("global");
  const globalActionById = new Map(globalActions.map((a) => [a.id, a]));
  for (const universalId of UNIVERSAL_ACTION_IDS) {
    const action = globalActionById.get(universalId);
    if (!action) continue;
    if (!matchesAction(event, action)) continue;

    const globalHandlers = getHandlers("global");
    const bound = globalHandlers.find((h) => h.actionId === universalId);
    if (!bound) continue;

    event.preventDefault();
    bound.handler(event);
    return { kind: "matched", scope: "global", actionId: universalId };
  }

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
