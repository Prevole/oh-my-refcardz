import type { GridPosition, LayoutBlock } from "./types";

/**
 * Immutable session memory: snapshots each block's initial position and size at
 * session start.
 *
 * Used during wrap to:
 *  - restore a wrapped block to the size it had when the operation started
 *    (cf. docs/layout-engine.md, "Wrap rules"),
 *  - place a wrapped block on its initial-session X column when the south
 *    fallback runs (cf. docs/layout-engine.md, "South fallback for horizontal
 *    wrap"). Keeping the shrunk X can push a block past the grid right edge
 *    once its width is restored.
 */
export type SessionMemory = {
  getInitialSize(blockId: string): { w: number; h: number } | undefined;
  getInitialPosition(blockId: string): GridPosition | undefined;
};

export function createSessionMemory(initial: readonly LayoutBlock[]): SessionMemory {
  const snapshot = new Map<string, GridPosition>();
  for (const block of initial) {
    snapshot.set(block.id, { ...block.position });
  }

  return {
    getInitialSize(blockId: string): { w: number; h: number } | undefined {
      const pos = snapshot.get(blockId);
      if (!pos) return undefined;
      return { w: pos.w, h: pos.h };
    },
    getInitialPosition(blockId: string): GridPosition | undefined {
      const pos = snapshot.get(blockId);
      if (!pos) return undefined;
      return { ...pos };
    },
  };
}
