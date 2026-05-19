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
import { debugRecorder } from "@/lib/debug";
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
  /** Replace the committed layout directly (used by persistence). */
  setCommittedLayout: (blocks: LayoutBlock[]) => void;
};

type UseLayoutEditorOptions = {
  initialBlocks: LayoutBlock[];
  gridColumns: number;
  /** Called whenever the committed layout changes. */
  onCommit?: (blocks: LayoutBlock[]) => void;
};

function buildConstraintsMap(blocks: LayoutBlock[]): Map<string, BlockConstraints> {
  const map = new Map<string, BlockConstraints>();
  for (const block of blocks) {
    map.set(block.id, getBlockConstraintsV2(block.kind));
  }
  return map;
}

export function useLayoutEditor({
  initialBlocks,
  gridColumns,
  onCommit,
}: UseLayoutEditorOptions): UseLayoutEditorResult {
  const [committedBlocks, setCommittedBlocks] = useState<LayoutBlock[]>(initialBlocks);
  const [interaction, setInteraction] = useState<InteractionState | null>(null);

  const onCommitRef = useRef(onCommit);
  useEffect(() => {
    onCommitRef.current = onCommit;
  }, [onCommit]);

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
    setCommittedBlocks(finalBlocks);
    setInteraction(null);
    onCommitRef.current?.(finalBlocks);
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
    setCommittedLayout,
  };
}
