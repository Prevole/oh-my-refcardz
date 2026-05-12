"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { LayoutBlock, LayoutIntent, LayoutSnapshot, SolverOptions } from "@/lib/layout/solver/types";
import { solveLayout } from "@/lib/layout/solver/solve-layout";
import { createSnapshot } from "@/lib/layout/layout-snapshot-context";
import { debugRecorder } from "@/lib/debug";
import { getBlockConstraintsV2 } from "./block-types";

/**
 * State of an active editing interaction (drag, resize, or keyboard move/resize).
 */
export type InteractionState = {
  /** The type of interaction */
  type: "drag" | "resize" | "keyboard";
  /** The block being manipulated */
  blockId: string;
  /** Layout at the start of the interaction (for recomputation) */
  startLayout: LayoutBlock[];
  /** Current candidate layout from the solver */
  candidateLayout: LayoutBlock[];
  /** Last accepted candidate layout (used when solver blocks) */
  lastAcceptedLayout: LayoutBlock[];
  /** Whether the current position is blocked */
  isBlocked: boolean;
};

/**
 * Result of the useLayoutEditor hook.
 */
export type UseLayoutEditorResult = {
  /**
   * Current snapshot to publish to consumers.
   * This reflects either the committed layout or the preview during interaction.
   */
  snapshot: LayoutSnapshot;

  /**
   * Current blocks for rendering.
   * Returns candidate layout during interaction, committed layout otherwise.
   */
  currentBlocks: LayoutBlock[];

  /**
   * The committed (persisted) layout.
   */
  committedBlocks: LayoutBlock[];

  /**
   * Whether an interaction is in progress.
   */
  isInteracting: boolean;

  /**
   * Whether the current intent is blocked.
   * When true, the UI should indicate that further movement is not possible.
   */
  isBlocked: boolean;

  /**
   * The current interaction state, if any.
   */
  interaction: InteractionState | null;

  /**
   * Start a new interaction (drag, resize, or keyboard).
   * This captures the current layout as the start state.
   */
  startInteraction: (type: InteractionState["type"], blockId: string) => void;

  /**
   * Apply an intent during an interaction.
   * This recomputes the candidate layout from the start layout + intent.
   * Returns the resulting blocks for immediate use if needed.
   */
  applyIntent: (intent: LayoutIntent) => LayoutBlock[];

  /**
   * Commit the current candidate layout.
   * This ends the interaction and persists the result.
   */
  commitInteraction: () => void;

  /**
   * Cancel the current interaction.
   * This reverts to the start layout without persisting.
   */
  cancelInteraction: () => void;

  /**
   * Update the committed layout directly (e.g., from persistence layer).
   */
  setCommittedLayout: (blocks: LayoutBlock[]) => void;

  /**
   * Solver options derived from the current layout.
   */
  solverOptions: SolverOptions;
};

type UseLayoutEditorOptions = {
  /** Initial layout blocks */
  initialBlocks: LayoutBlock[];
  /** Number of grid columns */
  gridColumns: number;
  /** Callback when layout is committed */
  onCommit?: (blocks: LayoutBlock[]) => void;
};

/**
 * Hook that orchestrates layout editing sessions.
 *
 * This is the central coordinator for layout interactions:
 * - Maintains committed vs preview state
 * - Receives intents from interaction hooks (drag, resize, keyboard)
 * - Calls the solver to compute candidate layouts
 * - Publishes snapshots for consumers
 *
 * The interaction model is:
 * 1. User starts interaction (drag/resize/keyboard) → startInteraction()
 * 2. During interaction, intents are applied → applyIntent()
 * 3. User ends interaction → commitInteraction() or cancelInteraction()
 *
 * Preview recomputation is always done from the start layout + current intent,
 * ensuring deterministic and reversible behavior.
 */
export function useLayoutEditor({
  initialBlocks,
  gridColumns,
  onCommit,
}: UseLayoutEditorOptions): UseLayoutEditorResult {
  // Committed layout (persisted state)
  const [committedBlocks, setCommittedBlocks] = useState<LayoutBlock[]>(initialBlocks);

  // Active interaction state
  const [interaction, setInteraction] = useState<InteractionState | null>(null);

  // Ref to track onCommit callback without re-creating callbacks
  const onCommitRef = useRef(onCommit);
  useEffect(() => {
    onCommitRef.current = onCommit;
  }, [onCommit]);

  // Build solver options from current blocks
  const solverOptions = useMemo((): SolverOptions => {
    const constraints = new Map<string, import("@/lib/layout/solver/types").BlockConstraints>();
    const blocks = interaction?.candidateLayout ?? committedBlocks;

    for (const block of blocks) {
      constraints.set(block.id, getBlockConstraintsV2(block.kind));
    }

    return {
      gridColumns,
      constraints,
    };
  }, [committedBlocks, gridColumns, interaction?.candidateLayout]);

  // Current blocks for rendering
  const currentBlocks = interaction?.candidateLayout ?? committedBlocks;

  // Build snapshot for consumers
  const snapshot = useMemo((): LayoutSnapshot => {
    if (interaction) {
      const source =
        interaction.type === "drag"
          ? "drag"
          : interaction.type === "resize"
            ? "resize"
            : "keyboard";
      return createSnapshot(interaction.candidateLayout, "preview", source);
    }
    return createSnapshot(committedBlocks, "commit", "load");
  }, [committedBlocks, interaction]);

  // Start a new interaction
  const startInteraction = useCallback(
    (type: InteractionState["type"], blockId: string) => {
      // Record interaction start
      debugRecorder.recordInteractionStart({
        interactionType: type,
        blockId,
        startLayout: committedBlocks,
      });

      setInteraction({
        type,
        blockId,
        startLayout: committedBlocks,
        candidateLayout: committedBlocks,
        lastAcceptedLayout: committedBlocks,
        isBlocked: false,
      });
    },
    [committedBlocks]
  );

  // Apply an intent during interaction
  const applyIntent = useCallback(
    (intent: LayoutIntent): LayoutBlock[] => {
      if (!interaction) {
        // If no interaction, start one implicitly (for keyboard single-step moves)
        const newInteraction: InteractionState = {
          type: "keyboard",
          blockId: intent.blockId,
          startLayout: committedBlocks,
          candidateLayout: committedBlocks,
          lastAcceptedLayout: committedBlocks,
          isBlocked: false,
        };

        // Solve from start layout
        const candidate = solveLayout(newInteraction.startLayout, intent, solverOptions);

        // Record the intent for debugging
        debugRecorder.recordIntent({
          intent,
          startLayout: newInteraction.startLayout,
          resultLayout: candidate.layout,
          accepted: candidate.accepted,
          pushedIds: [...candidate.pushedIds],
          shrunkIds: [...candidate.shrunkIds],
        });

        // For keyboard, we commit immediately (only if accepted)
        if (candidate.accepted) {
          setCommittedBlocks(candidate.layout);
          onCommitRef.current?.(candidate.layout);
        }
        // If blocked, don't change anything

        return candidate.accepted ? candidate.layout : committedBlocks;
      }

      // Solve from start layout (not from current candidate)
      // This ensures deterministic and reversible behavior
      const candidate = solveLayout(interaction.startLayout, intent, solverOptions);

      // Record the intent for debugging
      debugRecorder.recordIntent({
        intent,
        startLayout: interaction.startLayout,
        resultLayout: candidate.layout,
        accepted: candidate.accepted,
        pushedIds: [...candidate.pushedIds],
        shrunkIds: [...candidate.shrunkIds],
      });

      if (candidate.accepted) {
        // Intent was accepted - update both candidate and lastAccepted
        setInteraction({
          ...interaction,
          candidateLayout: candidate.layout,
          lastAcceptedLayout: candidate.layout,
          isBlocked: false,
        });
        return candidate.layout;
      } else {
        // Intent was blocked - keep the last accepted layout
        // This makes the UI "freeze" at the last valid position
        setInteraction({
          ...interaction,
          candidateLayout: interaction.lastAcceptedLayout,
          isBlocked: true,
        });
        return interaction.lastAcceptedLayout;
      }
    },
    [committedBlocks, interaction, solverOptions]
  );

  // Commit the current interaction
  const commitInteraction = useCallback(() => {
    if (!interaction) return;

    // Record interaction end
    debugRecorder.recordInteractionEnd({
      interactionType: interaction.type,
      blockId: interaction.blockId,
      outcome: "commit",
      finalLayout: interaction.lastAcceptedLayout,
    });

    // Always commit the last accepted layout (not the blocked candidate)
    setCommittedBlocks(interaction.lastAcceptedLayout);
    setInteraction(null);
    onCommitRef.current?.(interaction.lastAcceptedLayout);
  }, [interaction]);

  // Cancel the current interaction
  const cancelInteraction = useCallback(() => {
    if (interaction) {
      debugRecorder.recordInteractionEnd({
        interactionType: interaction.type,
        blockId: interaction.blockId,
        outcome: "cancel",
        finalLayout: interaction.startLayout,
      });
    }
    setInteraction(null);
  }, [interaction]);

  // Update committed layout directly
  const setCommittedLayout = useCallback((blocks: LayoutBlock[]) => {
    setCommittedBlocks(blocks);
    setInteraction(null);
  }, []);

  return {
    snapshot,
    currentBlocks,
    committedBlocks,
    isInteracting: interaction !== null,
    isBlocked: interaction?.isBlocked ?? false,
    interaction,
    startInteraction,
    applyIntent,
    commitInteraction,
    cancelInteraction,
    setCommittedLayout,
    solverOptions,
  };
}
