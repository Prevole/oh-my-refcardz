"use client";

/**
 * Thin React shell around `keyboard-session.ts`.
 *
 * Holds a single `KeyboardSession | null` instance behind a ref and surfaces
 * its state (`bufferBlocks`, `changesCount`, `isActive`) into React state so
 * components re-render on mutation. All semantics — change counting, undo
 * deltas, no-op detection — live in the pure module and are tested there.
 */

import { useCallback, useMemo, useRef, useState } from "react";
import {
  createKeyboardSession,
  type KeyboardSession,
  type SessionContext,
} from "./keyboard-session";
import type { LayoutBlock, Operation } from "@/lib/layout/engine";

export type { SessionContext } from "./keyboard-session";

export type ApplyOutcome = {
  blocks: readonly LayoutBlock[];
  changesCount: number;
  changed: boolean;
};

export type UseLayoutBufferStateResult = {
  bufferBlocks: readonly LayoutBlock[] | null;
  changesCount: number;
  isActive: boolean;
  start: (snapshot: readonly LayoutBlock[], ctx: SessionContext) => void;
  apply: (op: Operation) => ApplyOutcome | null;
  commit: () => readonly LayoutBlock[] | null;
  clear: () => void;
  reset: () => readonly LayoutBlock[] | null;
  replaceContents: (
    snapshot: readonly LayoutBlock[],
    delta: number,
  ) => readonly LayoutBlock[] | null;
};

export function useLayoutBufferState(): UseLayoutBufferStateResult {
  const sessionRef = useRef<KeyboardSession | null>(null);
  const [bufferBlocks, setBufferBlocks] = useState<readonly LayoutBlock[] | null>(
    null,
  );
  const [changesCount, setChangesCount] = useState(0);

  const start = useCallback(
    (snapshot: readonly LayoutBlock[], ctx: SessionContext) => {
      // Discard any prior session silently — entering a new keyboard mode
      // implies the previous one was already committed or discarded.
      const prior = sessionRef.current;
      if (prior) prior.cancel();
      const session = createKeyboardSession(snapshot, ctx);
      sessionRef.current = session;
      setBufferBlocks(session.getCurrentBlocks());
      setChangesCount(0);
    },
    [],
  );

  const apply = useCallback((op: Operation): ApplyOutcome | null => {
    const session = sessionRef.current;
    if (!session) return null;
    const outcome = session.apply(op);
    if (outcome.changed) {
      setBufferBlocks(outcome.blocks);
      setChangesCount(outcome.changesCount);
    }
    return outcome;
  }, []);

  const commit = useCallback((): readonly LayoutBlock[] | null => {
    const session = sessionRef.current;
    if (!session) return null;
    const blocks = session.commit();
    sessionRef.current = null;
    setBufferBlocks(null);
    setChangesCount(0);
    return blocks;
  }, []);

  const clear = useCallback(() => {
    const session = sessionRef.current;
    if (session) session.cancel();
    sessionRef.current = null;
    setBufferBlocks(null);
    setChangesCount(0);
  }, []);

  const reset = useCallback((): readonly LayoutBlock[] | null => {
    const session = sessionRef.current;
    if (!session) return null;
    const blocks = session.reset();
    setBufferBlocks(blocks);
    setChangesCount(0);
    return blocks;
  }, []);

  const replaceContents = useCallback(
    (
      snapshot: readonly LayoutBlock[],
      delta: number,
    ): readonly LayoutBlock[] | null => {
      const session = sessionRef.current;
      if (!session) return null;
      const blocks = session.replaceContents(snapshot, delta);
      setBufferBlocks(blocks);
      setChangesCount(session.getChangesCount());
      return blocks;
    },
    [],
  );

  return useMemo(
    () => ({
      bufferBlocks,
      changesCount,
      isActive: bufferBlocks !== null,
      start,
      apply,
      commit,
      clear,
      reset,
      replaceContents,
    }),
    [
      bufferBlocks,
      changesCount,
      start,
      apply,
      commit,
      clear,
      reset,
      replaceContents,
    ],
  );
}
