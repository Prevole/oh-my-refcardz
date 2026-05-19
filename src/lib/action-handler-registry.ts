import type { KeyboardScopeId } from "@/lib/keyboard-scope";

export type ActionHandler = (event: KeyboardEvent) => void;

export interface BoundHandler {
  actionId: string;
  scope: KeyboardScopeId;
  handler: ActionHandler;
}

type ScopeMap = Map<string, ActionHandler>;

class ActionHandlerRegistry {
  private byScope = new Map<KeyboardScopeId, ScopeMap>();

  bindHandler(
    actionId: string,
    scope: KeyboardScopeId,
    handler: ActionHandler,
  ): () => void {
    let scopeMap = this.byScope.get(scope);
    if (!scopeMap) {
      scopeMap = new Map();
      this.byScope.set(scope, scopeMap);
    }
    if (scopeMap.has(actionId)) {
      throw new Error(
        `Action handler already bound for "${actionId}" in scope "${scope}". ` +
          `Each (actionId, scope) pair must have at most one handler.`,
      );
    }
    scopeMap.set(actionId, handler);

    return () => {
      const current = this.byScope.get(scope);
      if (!current) return;
      current.delete(actionId);
      if (current.size === 0) {
        this.byScope.delete(scope);
      }
    };
  }

  getHandlersForScope(scope: KeyboardScopeId): BoundHandler[] {
    const scopeMap = this.byScope.get(scope);
    if (!scopeMap) return [];
    const result: BoundHandler[] = [];
    for (const [actionId, handler] of scopeMap) {
      result.push({ actionId, scope, handler });
    }
    return result;
  }

  hasHandler(actionId: string, scope: KeyboardScopeId): boolean {
    return this.byScope.get(scope)?.has(actionId) ?? false;
  }

  /** Test-only: clear all bindings. */
  clear(): void {
    this.byScope.clear();
  }
}

export const actionHandlerRegistry = new ActionHandlerRegistry();
export { ActionHandlerRegistry };
