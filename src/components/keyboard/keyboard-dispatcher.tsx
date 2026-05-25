"use client";

import { useEffect } from "react";
import { useKeyboardContext } from "@/hooks/use-keyboard-context";
import { useKeybindings } from "@/hooks/use-keybindings";
import { dispatchKeyEvent } from "@/lib/keyboard-dispatch";

/**
 * Mounts a single global `keydown` listener that delegates to the pure
 * `dispatchKeyEvent` routine. See `src/lib/keyboard-dispatch.ts` for the
 * cascade and modality semantics.
 *
 * The listener reads the scope stack from `scopeStackRef.current` so
 * that an update triggered by the previous keydown (e.g. pushing a
 * modal scope) is visible to the very next key event, even if React
 * has not committed the corresponding state update yet.
 */
export function KeyboardDispatcher() {
  const { scopeStackRef } = useKeyboardContext();
  const { getActionsForContext } = useKeybindings();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      dispatchKeyEvent(
        event,
        scopeStackRef.current,
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
  }, [scopeStackRef, getActionsForContext]);

  return null;
}
