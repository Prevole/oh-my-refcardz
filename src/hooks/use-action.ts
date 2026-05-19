"use client";

import { useEffect, useRef } from "react";
import type { KeyboardScopeId } from "@/lib/keyboard-scope";
import {
  actionHandlerRegistry,
  type ActionHandler,
} from "@/lib/action-handler-registry";

/**
 * Bind a handler for `actionId` while it is mounted. The handler reference is
 * kept up-to-date via a ref so callers do not need to memoize it; only
 * `actionId` and `scope` participate in the bind/unbind effect.
 */
export function useAction(
  actionId: string,
  scope: KeyboardScopeId,
  handler: ActionHandler,
): void {
  const handlerRef = useRef(handler);

  useEffect(() => {
    handlerRef.current = handler;
  });

  useEffect(() => {
    const unbind = actionHandlerRegistry.bindHandler(
      actionId,
      scope,
      (event) => {
        handlerRef.current(event);
      },
    );
    return unbind;
  }, [actionId, scope]);
}
