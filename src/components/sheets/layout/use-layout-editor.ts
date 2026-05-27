"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  applyOperation,
  type BlockConstraints,
  type EngineEventEmitter,
  type LayoutBlock,
  type Operation,
  type OperationOptions,
} from "@/lib/layout/engine";
import { debugRecorder } from "@/lib/dev-mode";
import { getBlockConstraintsV2 } from "./block-types";

/**
 * Type of interaction currently in progress.
 */
export type InteractionKind = "drag" | "resize";

/**
 * State of an active editing interaction.
 *
 * The snapshot captures the layout when the interaction started; all calls to
 * applyOperation during the interaction are made against this snapshot, with
 * cumulative deltas computed by the calling hook.
 */
export type InteractionState = {
  kind: InteractionKind;
  blockId: string;
  /** Layout at the start of the interaction (immutable for the duration). */
  snapshot: LayoutBlock[];
  /** Latest accepted preview from applyOperation; null if no operation applied yet. */
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
      return {
        kind,
        blockId,
        snapshot: committedBlocks,
        preview: null,
        snapshotMaxRow: computeMaxRow(committedBlocks),
      };
    });
  }, [committedBlocks]);

  const applyInteractionOperation = useCallback(
    (op: Operation, options?: OperationOptions): LayoutBlock[] => {
      if (!interaction) {
        // No interaction active; return committed blocks unchanged.
        return committedBlocks;
      }

      const constraints = buildConstraintsMap(interaction.snapshot);
      const opWithOptions: Operation = options ? { ...op, options } : op;
      const result = applyOperation(interaction.snapshot, opWithOptions, {
        gridColumns,
        constraints,
        emitter: getEmitter(),
      });

      setInteraction({
        ...interaction,
        preview: result.blocks,
      });

      return result.blocks;
    },
    [committedBlocks, getEmitter, gridColumns, interaction]
  );

  const commitInteraction = useCallback(() => {
    if (!interaction) return;

    const finalBlocks = interaction.preview ?? interaction.snapshot;
    const mutated = interaction.preview !== null && blocksDiffer(finalBlocks, interaction.snapshot);
    setCommittedBlocks(finalBlocks);
    setInteraction(null);
    onCommitRef.current?.(finalBlocks);
    if (mutated) {
      onInteractionCommitRef.current?.(finalBlocks);
    }
  }, [interaction]);

  const cancelInteraction = useCallback(() => {
    setInteraction(null);
  }, []);

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
    setCommittedBlocks(blocks);
    setInteraction(null);
  }, []);

  const commitLayout = useCallback((blocks: readonly LayoutBlock[]) => {
    const copy = blocks.slice();
    setCommittedBlocks(copy);
    setInteraction(null);
    onCommitRef.current?.(copy);
  }, []);

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
