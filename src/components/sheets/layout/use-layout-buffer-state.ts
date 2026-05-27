"use client";

/**
 * React state wrapper around the pure `layout-buffer` module.
 *
 * Owns a single `LayoutBuffer | null` cell and exposes a small action
 * surface (`start`, `apply`, `commit`, `clear`) that mirrors the pure
 * API while integrating with React rendering. This hook is the single
 * source of truth for the buffered keyboard layout session — both the
 * keyboard hook (which applies operations) and the sheet renderer
 * (which displays the staged blocks) consume the same instance.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { LayoutBlock, Operation } from "@/lib/layout/engine";
import {
  applyToBuffer,
  commitBuffer,
  createBuffer,
  replaceBufferContents,
  resetBuffer,
  type ApplyContext,
  type ApplyResult,
  type LayoutBuffer,
} from "./layout-buffer";

export type ApplyOutcome = {
  /** Resulting blocks (== bufferBlocks after the call). */
  blocks: readonly LayoutBlock[];
  /** Effective edits counter after the call (synchronous, post-apply). */
  changesCount: number;
  /** True when the engine produced a change (changesCount incremented). */
  changed: boolean;
};

export type UseLayoutBufferStateResult = {
  /** Underlying buffer reference; `null` when no session is active. */
  buffer: LayoutBuffer | null;
  /** Convenience: the staged blocks, or `null` when no session is active. */
  bufferBlocks: readonly LayoutBlock[] | null;
  /** Convenience: the number of effective edits since `start`. 0 when idle. */
  changesCount: number;
  /** True while a buffered session is active. */
  isActive: boolean;
  /** Begin a buffered session rooted at `snapshot`. Replaces any prior buffer. */
  start: (snapshot: readonly LayoutBlock[]) => void;
  /**
   * Apply `op` to the current buffer through the engine. Returns the
   * resulting blocks, or `null` when no buffer is active (caller error).
   */
  apply: (op: Operation, ctx: ApplyContext) => ApplyOutcome | null;
  /**
   * Snapshot the current buffer contents and clear the session. Returns
   * the blocks for the caller to persist, or `null` when no session is
   * active.
   */
  commit: () => readonly LayoutBlock[] | null;
  /** Drop the buffer without producing any output. */
  clear: () => void;
  /**
   * Reset the buffer to its initial snapshot without ending the
   * session. The user stays in layout mode; staged edits are
   * forgotten and `changesCount` returns to 0. Returns the initial
   * snapshot blocks, or `null` when no session is active.
   */
  reset: () => readonly LayoutBlock[] | null;
  /**
   * Replace the buffer's current contents with `snapshot` and adjust
   * `changesCount` by `delta` (typically -1 for undo, +1 for redo).
   * `changesCount` is clamped to >= 0 and forced to 0 when the new
   * snapshot equals the initial snapshot structurally. Returns the
   * new buffer blocks, or `null` when no session is active.
   *
   * Used by the history layer to apply an undo/redo step inside an
   * active buffered keyboard session.
   */
  replaceContents: (
    snapshot: readonly LayoutBlock[],
    delta: number,
  ) => readonly LayoutBlock[] | null;
};

export function useLayoutBufferState(): UseLayoutBufferStateResult {
  const [buffer, setBuffer] = useState<LayoutBuffer | null>(null);

  // Keep a ref so `apply` and `commit` can read the latest buffer
  // synchronously without recreating their callbacks on every change.
  const bufferRef = useRef<LayoutBuffer | null>(null);
  useEffect(() => {
    bufferRef.current = buffer;
  }, [buffer]);

  const start = useCallback((snapshot: readonly LayoutBlock[]) => {
    const fresh = createBuffer(snapshot);
    bufferRef.current = fresh;
    setBuffer(fresh);
  }, []);

  const apply = useCallback(
    (op: Operation, ctx: ApplyContext): ApplyOutcome | null => {
      const current = bufferRef.current;
      if (!current) return null;
      const result: ApplyResult = applyToBuffer(current, op, ctx);
      const changed = result.buffer !== current;
      if (changed) {
        bufferRef.current = result.buffer;
        setBuffer(result.buffer);
      }
      return {
        blocks: result.blocks,
        changesCount: result.buffer.changesCount,
        changed,
      };
    },
    [],
  );

  const commit = useCallback((): readonly LayoutBlock[] | null => {
    const current = bufferRef.current;
    if (!current) return null;
    const blocks = commitBuffer(current);
    bufferRef.current = null;
    setBuffer(null);
    return blocks;
  }, []);

  const clear = useCallback(() => {
    bufferRef.current = null;
    setBuffer(null);
  }, []);

  const reset = useCallback((): readonly LayoutBlock[] | null => {
    const current = bufferRef.current;
    if (!current) return null;
    const next = resetBuffer(current);
    if (next !== current) {
      bufferRef.current = next;
      setBuffer(next);
    }
    return next.currentBuffer;
  }, []);

  const replaceContents = useCallback(
    (
      snapshot: readonly LayoutBlock[],
      delta: number,
    ): readonly LayoutBlock[] | null => {
      const current = bufferRef.current;
      if (!current) return null;
      const next = replaceBufferContents(current, snapshot, delta);
      bufferRef.current = next;
      setBuffer(next);
      return next.currentBuffer;
    },
    [],
  );

  return useMemo(
    () => ({
      buffer,
      bufferBlocks: buffer?.currentBuffer ?? null,
      changesCount: buffer?.changesCount ?? 0,
      isActive: buffer !== null,
      start,
      apply,
      commit,
      clear,
      reset,
      replaceContents,
    }),
    [buffer, start, apply, commit, clear, reset, replaceContents],
  );
}
