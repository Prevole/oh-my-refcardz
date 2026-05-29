"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  applyOperation,
  createEngineSession,
  type BlockConstraints,
  type EngineEventEmitter,
  type EngineSession,
  type LayoutBlock,
  type Operation,
  type OperationOptions,
} from "@/lib/layout/engine";
import { debugRecorder } from "@/lib/dev-mode";
import { getBlockConstraintsV2 } from "@/lib/layout/blocks";

/**
 * Type of interaction currently in progress.
 */
export type InteractionKind = "drag" | "resize";

/**
 * State of an active editing interaction.
 *
 * Behind the scenes, an EngineSession is kept alive in a ref for the
 * duration of the interaction (mousedown → mouseup). Each call to
 * `applyInteractionOperation` translates the caller's cumulative delta
 * (relative to the snapshot) into either `session.moveTo` (absolute
 * target) or repeated `session.resize` calls. The session's snapshot
 * cache guarantees that revisiting a footprint reproduces the exact
 * same layout (geometric reversibility).
 */
export type InteractionState = {
  kind: InteractionKind;
  blockId: string;
  /** Layout at the start of the interaction (immutable for the duration). */
  snapshot: LayoutBlock[];
  /** Latest preview produced by the live session; null before any operation. */
  preview: LayoutBlock[] | null;
  /**
   * Highest occupied row index in the snapshot (i.e. max of `y + h` across all
   * blocks). Used by the renderer to keep the grid from shrinking under the
   * cursor during a mouse drag/resize. The value is captured once on
   * interaction start and stays constant for the duration of the gesture; the
   * grid can still grow naturally if the preview pushes blocks further south.
   */
  snapshotMaxRow: number;
};

export type UseLayoutEditorResult = {
  /** Blocks to render: preview during interaction, committed otherwise. */
  currentBlocks: LayoutBlock[];
  /** Committed (persisted) blocks. */
  committedBlocks: LayoutBlock[];
  /** Whether an interaction is in progress. */
  isInteracting: boolean;
  /** The current interaction state, if any. */
  interaction: InteractionState | null;
  /** Begin a new interaction. Captures the current committed layout as the snapshot. */
  startInteraction: (kind: InteractionKind, blockId: string) => void;
  /**
   * Apply an operation against the current interaction snapshot.
   * Returns the resulting blocks. Updates the preview.
   * Must be called while an interaction is active.
   */
  applyInteractionOperation: (op: Operation, options?: OperationOptions) => LayoutBlock[];
  /** Commit the current interaction's preview to the committed layout. */
  commitInteraction: () => void;
  /** Cancel the current interaction; discard the preview. */
  cancelInteraction: () => void;
  /**
   * Apply an operation in one shot, outside of any interaction.
   * Used for keyboard moves or programmatic edits. Commits immediately.
   */
  applyOneShot: (op: Operation, options?: OperationOptions) => LayoutBlock[];
  /**
   * Commit a pre-computed layout directly to persistence. Unlike
   * `setCommittedLayout`, this also fires `onCommit` (used by the
   * keyboard buffered mode to persist the staged blocks on Return).
   */
  commitLayout: (blocks: readonly LayoutBlock[]) => void;
  /** Replace the committed layout directly (used by persistence). */
  setCommittedLayout: (blocks: LayoutBlock[]) => void;
};

type UseLayoutEditorOptions = {
  initialBlocks: LayoutBlock[];
  gridColumns: number;
  /** Called whenever the committed layout changes. */
  onCommit?: (blocks: LayoutBlock[]) => void;
  /**
   * Called when `commitInteraction` finalizes a drag/resize that actually
   * mutated the layout (a preview was produced AND it differs from the
   * snapshot). Used by the history layer to push a "mouse" entry.
   */
  onInteractionCommit?: (blocks: LayoutBlock[]) => void;
};

function blocksDiffer(a: readonly LayoutBlock[], b: readonly LayoutBlock[]): boolean {
  if (a.length !== b.length) return true;
  for (let i = 0; i < a.length; i++) {
    const ab = a[i];
    const bb = b[i];
    if (ab.id !== bb.id) return true;
    const ap = ab.position;
    const bp = bb.position;
    if (ap.x !== bp.x || ap.y !== bp.y || ap.w !== bp.w || ap.h !== bp.h) return true;
  }
  return false;
}

function buildConstraintsMap(blocks: LayoutBlock[]): Map<string, BlockConstraints> {
  const map = new Map<string, BlockConstraints>();
  for (const block of blocks) {
    map.set(block.id, getBlockConstraintsV2(block.kind));
  }
  return map;
}

function computeMaxRow(blocks: readonly LayoutBlock[]): number {
  let max = 0;
  for (const block of blocks) {
    const bottom = block.position.y + block.position.h;
    if (bottom > max) max = bottom;
  }
  return max;
}

export function useLayoutEditor({
  initialBlocks,
  gridColumns,
  onCommit,
  onInteractionCommit,
}: UseLayoutEditorOptions): UseLayoutEditorResult {
  const [committedBlocks, setCommittedBlocks] = useState<LayoutBlock[]>(initialBlocks);
  const [interaction, setInteraction] = useState<InteractionState | null>(null);

  // The live EngineSession backing the current interaction. Mutations on the
  // session bypass React; the `interaction.preview` field is republished on
  // each applyInteractionOperation call to trigger re-renders.
  const sessionRef = useRef<EngineSession | null>(null);

  const onCommitRef = useRef(onCommit);
  useEffect(() => {
    onCommitRef.current = onCommit;
  }, [onCommit]);

  const onInteractionCommitRef = useRef(onInteractionCommit);
  useEffect(() => {
    onInteractionCommitRef.current = onInteractionCommit;
  }, [onInteractionCommit]);

  /**
   * Resolve the live engine emitter from the debug recorder.
   * The emitter is always live (noop when not recording); reading it on each
   * call ensures we pick up recording state changes without re-rendering.
   */
  const getEmitter = useCallback((): EngineEventEmitter | undefined => {
    return debugRecorder.getEngineEmitter();
  }, []);

  // Tear down the live session if any. Safe to call multiple times.
  const closeSession = useCallback((mode: "commit" | "cancel"): LayoutBlock[] | null => {
    const s = sessionRef.current;
    if (!s) return null;
    sessionRef.current = null;
    return mode === "commit" ? s.commit() : s.cancel();
  }, []);

  const currentBlocks = useMemo(() => {
    if (interaction) {
      return interaction.preview ?? interaction.snapshot;
    }
    return committedBlocks;
  }, [committedBlocks, interaction]);

  const startInteraction = useCallback((kind: InteractionKind, blockId: string) => {
    setInteraction((prev) => {
      if (prev) {
        // An interaction is already active; reuse the existing snapshot to avoid
        // disrupting the user. The caller is responsible for not starting two.
        return prev;
      }
      // Open a fresh session for this interaction.
      sessionRef.current = createEngineSession(committedBlocks, {
        gridColumns,
        constraints: buildConstraintsMap(committedBlocks),
        emitter: getEmitter(),
      });
      return {
        kind,
        blockId,
        snapshot: committedBlocks,
        preview: null,
        snapshotMaxRow: computeMaxRow(committedBlocks),
      };
    });
  }, [committedBlocks, getEmitter, gridColumns]);

  const applyInteractionOperation = useCallback(
    (op: Operation, options?: OperationOptions): LayoutBlock[] => {
      if (!interaction) {
        // No interaction active; return committed blocks unchanged.
        return committedBlocks;
      }
      const session = sessionRef.current;
      if (!session) {
        // Defensive fallback: interaction state exists but the session was
        // lost (shouldn't happen). Apply statelessly against the snapshot.
        const constraints = buildConstraintsMap(interaction.snapshot);
        const opWithOptions: Operation = options ? { ...op, options } : op;
        const result = applyOperation(interaction.snapshot, opWithOptions, {
          gridColumns,
          constraints,
          emitter: getEmitter(),
        });
        setInteraction({ ...interaction, preview: result.blocks });
        return result.blocks;
      }

      // Propagate per-call options to the live session (e.g. Shift toggling
      // strict mode mid-drag).
      if (options) session.setOperationOptions(options);

      if (op.kind === "move") {
        // The caller passes dx/dy as cumulative offsets from the snapshot
        // position. Translate to an absolute target for moveTo, which then
        // figures out the delta from the session's current position.
        const snap = interaction.snapshot.find((b) => b.id === op.blockId);
        if (snap) {
          session.moveTo({
            blockId: op.blockId,
            x: snap.position.x + op.dx,
            y: snap.position.y + op.dy,
          });
        }
      } else {
        // Resize: op.delta is cumulative (in cells) from the snapshot size on
        // the given edge. Compare with the current session size on that edge
        // to compute how many unit steps remain to apply.
        const snap = interaction.snapshot.find((b) => b.id === op.blockId);
        const cur = session.getCurrentBlocks().find((b) => b.id === op.blockId);
        if (snap && cur) {
          const horizontal = op.edge === "east" || op.edge === "west";
          const snapSize = horizontal ? snap.position.w : snap.position.h;
          const curSize = horizontal ? cur.position.w : cur.position.h;
          const targetDelta = op.delta;
          const currentDelta = curSize - snapSize;
          const remaining = targetDelta - currentDelta;
          const dir: "grow" | "shrink" = remaining < 0 ? "shrink" : "grow";
          for (let i = 0; i < Math.abs(remaining); i++) {
            const r = session.resize({
              blockId: op.blockId,
              edge: op.edge,
              direction: dir,
            });
            if (!r.accepted) break;
          }
        }
      }

      const newPreview = session.getCurrentBlocks();
      setInteraction({ ...interaction, preview: newPreview });
      return newPreview;
    },
    [committedBlocks, getEmitter, gridColumns, interaction]
  );

  const commitInteraction = useCallback(() => {
    if (!interaction) return;

    const sessionFinal = closeSession("commit");
    const finalBlocks = sessionFinal ?? interaction.preview ?? interaction.snapshot;
    const mutated =
      interaction.preview !== null && blocksDiffer(finalBlocks, interaction.snapshot);
    setCommittedBlocks(finalBlocks);
    setInteraction(null);
    onCommitRef.current?.(finalBlocks);
    if (mutated) {
      onInteractionCommitRef.current?.(finalBlocks);
    }
  }, [closeSession, interaction]);

  const cancelInteraction = useCallback(() => {
    closeSession("cancel");
    setInteraction(null);
  }, [closeSession]);

  const applyOneShot = useCallback(
    (op: Operation, options?: OperationOptions): LayoutBlock[] => {
      const constraints = buildConstraintsMap(committedBlocks);
      const opWithOptions: Operation = options ? { ...op, options } : op;
      const result = applyOperation(committedBlocks, opWithOptions, {
        gridColumns,
        constraints,
        emitter: getEmitter(),
      });
      setCommittedBlocks(result.blocks);
      onCommitRef.current?.(result.blocks);
      return result.blocks;
    },
    [committedBlocks, getEmitter, gridColumns]
  );

  const setCommittedLayout = useCallback((blocks: LayoutBlock[]) => {
    closeSession("cancel");
    setCommittedBlocks(blocks);
    setInteraction(null);
  }, [closeSession]);

  const commitLayout = useCallback((blocks: readonly LayoutBlock[]) => {
    closeSession("cancel");
    const copy = blocks.slice();
    setCommittedBlocks(copy);
    setInteraction(null);
    onCommitRef.current?.(copy);
  }, [closeSession]);

  return {
    currentBlocks,
    committedBlocks,
    isInteracting: interaction !== null,
    interaction,
    startInteraction,
    applyInteractionOperation,
    commitInteraction,
    cancelInteraction,
    applyOneShot,
    commitLayout,
    setCommittedLayout,
  };
}
