export type KeyboardScopeId =
  | "global"
  | "home"
  | "sheet"
  | "modal"
  | "settings"
  | "help"
  | "info"
  | "layout"
  | "layout-navigation"
  | "layout-move"
  | "layout-resize"
  | "dev"
  | "dev-logs"
  | "dev-axes";

export interface ScopeEntry {
  scope: KeyboardScopeId;
  /**
   * Modal scopes block unmatched events from cascading to lower scopes on the
   * stack. Non-modal scopes are transparent: unmatched events fall through.
   */
  modal: boolean;
}

/**
 * Push a scope onto the stack, avoiding duplicates at the top.
 * Returns the same array if the same scope is already at top (with same
 * modality).
 */
export function pushScopeToStack(
  stack: ScopeEntry[],
  scope: KeyboardScopeId,
  modal: boolean,
): ScopeEntry[] {
  const top = stack[stack.length - 1];
  if (top && top.scope === scope && top.modal === modal) return stack;
  return [...stack, { scope, modal }];
}

/**
 * Pop a specific scope from the stack by value (not position).
 * Does not remove the base entry (index 0).
 * Returns the same array if scope is not found or is at index 0.
 */
export function popScopeFromStack(
  stack: ScopeEntry[],
  scope: KeyboardScopeId,
): ScopeEntry[] {
  let index = -1;
  for (let i = stack.length - 1; i > 0; i--) {
    if (stack[i].scope === scope) {
      index = i;
      break;
    }
  }
  if (index === -1) return stack;
  return [...stack.slice(0, index), ...stack.slice(index + 1)];
}

/**
 * Check if a scope is the active (top) scope.
 */
export function isScopeActiveInStack(
  stack: ScopeEntry[],
  scope: KeyboardScopeId,
): boolean {
  return stack[stack.length - 1]?.scope === scope;
}

/**
 * Get the active (top) scope from the stack.
 */
export function getActiveScope(stack: ScopeEntry[]): KeyboardScopeId {
  return stack[stack.length - 1].scope;
}
