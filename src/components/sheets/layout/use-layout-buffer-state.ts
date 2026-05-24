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
  type ApplyContext,
  type ApplyResult,
  type LayoutBuffer,
} from "./layout-buffer";

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
  apply: (op: Operation, ctx: ApplyContext) => readonly LayoutBlock[] | null;
  /**
   * Snapshot the current buffer contents and clear the session. Returns
   * the blocks for the caller to persist, or `null` when no session is
   * active.
   */
  commit: () => readonly LayoutBlock[] | null;
  /** Drop the buffer without producing any output. */
  clear: () => void;
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
    (op: Operation, ctx: ApplyContext): readonly LayoutBlock[] | null => {
      const current = bufferRef.current;
      if (!current) return null;
      const result: ApplyResult = applyToBuffer(current, op, ctx);
      if (result.buffer !== current) {
        bufferRef.current = result.buffer;
        setBuffer(result.buffer);
      }
      return result.blocks;
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
    }),
    [buffer, start, apply, commit, clear],
  );
}
