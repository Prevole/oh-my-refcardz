"use client";

import { useEffect } from "react";
import { useKeyboardContext } from "@/hooks/use-keyboard-context";
import { useKeybindings } from "@/hooks/use-keybindings";
import { dispatchKeyEvent } from "@/lib/keyboard-dispatch";

/**
 * Mounts a single global `keydown` listener that delegates to the pure
 * `dispatchKeyEvent` routine. See `src/lib/keyboard-dispatch.ts` for the
 * cascade and modality semantics.
 */
export function KeyboardDispatcher() {
  const { scopeStack } = useKeyboardContext();
  const { getActionsForContext } = useKeybindings();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      dispatchKeyEvent(
        event,
        scopeStack,
        { getActionsForContext },
        (scope, ids) => {
          console.warn(
            `Conflicting key handlers in scope "${scope}": ${ids.join(", ")}`,
          );
        },
      );
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [scopeStack, getActionsForContext]);

  return null;
}
