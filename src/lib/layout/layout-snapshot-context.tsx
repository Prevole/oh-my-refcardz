"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { GridPosition, LayoutBlock, LayoutSnapshot } from "./solver/types";

/**
 * Context for publishing layout snapshots.
 *
 * This allows consumers (like heading navigation) to read the current
 * layout state without being coupled to the editing hooks.
 */
const LayoutSnapshotContext = createContext<LayoutSnapshot | null>(null);

type LayoutSnapshotProviderProps = {
  children: ReactNode;
  snapshot: LayoutSnapshot | null;
};

/**
 * Provide a layout snapshot to consumers.
 *
 * The snapshot contains the current block positions and metadata about
 * the current editing phase and source.
 */
export function LayoutSnapshotProvider({ children, snapshot }: LayoutSnapshotProviderProps) {
  return <LayoutSnapshotContext.Provider value={snapshot}>{children}</LayoutSnapshotContext.Provider>;
}

/**
 * Read the current layout snapshot.
 *
 * Returns null if no snapshot is available (no editing session active).
 */
export function useLayoutSnapshot(): LayoutSnapshot | null {
  return useContext(LayoutSnapshotContext);
}

/**
 * Get the position of a block by ID from the current snapshot.
 *
 * Returns null if the block is not found or no snapshot is available.
 */
export function useBlockPosition(blockId: string): GridPosition | null {
  const snapshot = useLayoutSnapshot();
  return snapshot?.blocks[blockId] ?? null;
}

/**
 * Get all block positions sorted by reading order (top-to-bottom, left-to-right).
 *
 * Returns an empty array if no snapshot is available.
 */
export function useSortedBlocks(): Array<{ id: string; position: GridPosition }> {
  const snapshot = useLayoutSnapshot();

  return useMemo(() => {
    if (!snapshot) return [];

    const entries = Object.entries(snapshot.blocks);

    return entries
      .map(([id, position]) => ({ id, position }))
      .sort((a, b) => {
        // Sort by y first (top to bottom), then x (left to right)
        if (a.position.y !== b.position.y) {
          return a.position.y - b.position.y;
        }
        return a.position.x - b.position.x;
      });
  }, [snapshot]);
}

/**
 * Create a LayoutSnapshot from an array of LayoutBlocks.
 *
 * This is a utility for creating snapshots from solver output.
 */
export function createSnapshot(
  blocks: LayoutBlock[],
  phase: LayoutSnapshot["phase"],
  source: LayoutSnapshot["source"]
): LayoutSnapshot {
  const blockPositions: Record<string, GridPosition> = {};

  for (const block of blocks) {
    blockPositions[block.id] = block.position;
  }

  return {
    blocks: blockPositions,
    phase,
    source,
  };
}
