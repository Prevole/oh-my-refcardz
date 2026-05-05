export type KeyboardScopeId = "global" | "settings" | "help" | "info" | "sheet-commands" | "sheet-layout";

/**
 * Push a scope onto the stack, avoiding duplicates at the top.
 * Returns the same array if the scope is already at top.
 */
export function pushScopeToStack(stack: KeyboardScopeId[], scope: KeyboardScopeId): KeyboardScopeId[] {
  if (stack[stack.length - 1] === scope) return stack;
  return [...stack, scope];
}

/**
 * Pop a specific scope from the stack by value (not position).
 * Does not remove the base "global" scope (index 0).
 * Returns the same array if scope is not found or is at index 0.
 */
export function popScopeFromStack(stack: KeyboardScopeId[], scope: KeyboardScopeId): KeyboardScopeId[] {
  const index = stack.lastIndexOf(scope);
  if (index === -1 || index === 0) return stack;
  return [...stack.slice(0, index), ...stack.slice(index + 1)];
}

/**
 * Check if a scope is the active (top) scope.
 */
export function isScopeActiveInStack(stack: KeyboardScopeId[], scope: KeyboardScopeId): boolean {
  return stack[stack.length - 1] === scope;
}

/**
 * Get the active (top) scope from the stack.
 */
export function getActiveScope(stack: KeyboardScopeId[]): KeyboardScopeId {
  return stack[stack.length - 1];
}
