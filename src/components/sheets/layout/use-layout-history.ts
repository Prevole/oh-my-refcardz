"use client";

/**
 * useLayoutHistory — owner-side glue between LayoutHistory and the two
 * mutation funnels (mouse via useLayoutEditor.commitInteraction, keyboard
 * via useLayoutBufferState.apply).
 *
 * Lifecycle: one instance per cheatsheet page session. The history pile is
 * created once on first mount (a stable ref) and discarded with the
 * component, which matches the route key in `src/app/cheatsheets/[slug]/page.tsx`.
 *
 * Push policy (Phase H model):
 *  - `pushMouse(snapshot)` — call after a mouse gesture commits (one push per
 *    drag/resize gesture, regardless of how many intermediate `applyOperation`
 *    calls the gesture produced).
 *  - `pushKeyboard(snapshot)` — call after a keyboard mutation that actually
 *    changed the buffer (one push per effective keystroke). Also called on
 *    LAYOUT_RESET so a single `u` can revert the reset.
 *
 * Undo/redo routing:
 *  - When the buffered keyboard session is NOT active (mouse mode), the
 *    restored snapshot is applied via `editor.commitLayout` which flows
 *    through `onCommit` and therefore persists immediately.
 *  - When the buffered keyboard session IS active, the restored snapshot is
 *    applied to the buffer via `bufferState.replaceContents(snapshot, ±1)`.
 *    Persistence happens at session commit, except when the restored entry's
 *    source is `"mouse"`: in that case, the editor's committed layout is also
 *    updated (so post-session edits remain consistent with the persisted
 *    state).
 *
 * Anti-loop guard: when undo/redo writes back via `commitLayout`, the
 * `onCommit` callback in the sheet renderer fires `setBlockLayouts(...)`,
 * which schedules a `useEffect` that pushes the new persistence value back
 * into the editor. The `isApplyingHistory` flag short-circuits that effect
 * during a history-driven write.
 */

import { useCallback, useMemo, useRef } from "react";

import type { LayoutBlock } from "@/lib/layout/engine";
import {
  createLayoutHistory,
  type LayoutHistory,
} from "@/lib/layout/history";

import type { UseLayoutBufferStateResult } from "./use-layout-buffer-state";
import type { UseLayoutEditorResult } from "./use-layout-editor";

export type UseLayoutHistoryOptions = {
  editor: Pick<UseLayoutEditorResult, "commitLayout">;
  bufferState: Pick<
    UseLayoutBufferStateResult,
    "isActive" | "replaceContents"
  >;
  /**
   * Optional ref-like flag that the sheet renderer can read in its
   * persistence-sync effect to short-circuit the round-trip during a
   * history-driven write. The hook sets this to `true` immediately before
   * writing back, and resets to `false` on the next microtask.
   */
  isApplyingHistoryRef?: { current: boolean };
};

export type UseLayoutHistoryResult = {
  pushMouse: (snapshot: readonly LayoutBlock[]) => void;
  pushKeyboard: (snapshot: readonly LayoutBlock[]) => void;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
  /** Drop the whole history. Used on slug change or explicit reset. */
  clear: () => void;
};

export function useLayoutHistory({
  editor,
  bufferState,
  isApplyingHistoryRef,
}: UseLayoutHistoryOptions): UseLayoutHistoryResult {
  const historyRef = useRef<LayoutHistory | null>(null);
  if (historyRef.current === null) {
    historyRef.current = createLayoutHistory();
  }
  const history = historyRef.current;

  const guardWrite = useCallback(
    (write: () => void) => {
      if (isApplyingHistoryRef) {
        isApplyingHistoryRef.current = true;
        try {
          write();
        } finally {
          // Defer reset so the persistence-sync effect (scheduled by React
          // after this synchronous block) observes the flag as `true` and
          // bails out. The microtask runs before the effect fires.
          queueMicrotask(() => {
            isApplyingHistoryRef.current = false;
          });
        }
      } else {
        write();
      }
    },
    [isApplyingHistoryRef],
  );

  const pushMouse = useCallback(
    (snapshot: readonly LayoutBlock[]) => {
      history.push(snapshot, "mouse");
    },
    [history],
  );

  const pushKeyboard = useCallback(
    (snapshot: readonly LayoutBlock[]) => {
      history.push(snapshot, "keyboard");
    },
    [history],
  );

  const undo = useCallback(() => {
    const entry = history.undo();
    if (!entry) return;
    const { snapshot, source } = entry;

    if (bufferState.isActive) {
      // Keyboard session active: restore into the buffer.
      bufferState.replaceContents(snapshot, -1);
      // If the undone entry was a mouse step, also reflect the change in
      // the editor's committed layout so the post-session state remains
      // consistent. This persists immediately via onCommit.
      if (source === "mouse") {
        guardWrite(() => editor.commitLayout(snapshot));
      }
      return;
    }

    // Mouse mode: write directly to the editor and persist.
    guardWrite(() => editor.commitLayout(snapshot));
  }, [bufferState, editor, guardWrite, history]);

  const redo = useCallback(() => {
    const entry = history.redo();
    if (!entry) return;
    const { snapshot, source } = entry;

    if (bufferState.isActive) {
      bufferState.replaceContents(snapshot, +1);
      if (source === "mouse") {
        guardWrite(() => editor.commitLayout(snapshot));
      }
      return;
    }

    guardWrite(() => editor.commitLayout(snapshot));
  }, [bufferState, editor, guardWrite, history]);

  const canUndo = useCallback(() => history.canUndo(), [history]);
  const canRedo = useCallback(() => history.canRedo(), [history]);

  const clear = useCallback(() => history.clear(), [history]);

  return useMemo(
    () => ({
      pushMouse,
      pushKeyboard,
      undo,
      redo,
      canUndo,
      canRedo,
      clear,
    }),
    [pushMouse, pushKeyboard, undo, redo, canUndo, canRedo, clear],
  );
}
