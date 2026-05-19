import type { LayoutBlock } from "./types";

/**
 * Immutable session memory: snapshots each block's initial size at session start.
 *
 * Used during wrap to restore a wrapped block to the size it had when the
 * operation started (cf. docs/layout-engine.md, "Wrap rules").
 */
export type SessionMemory = {
  getInitialSize(blockId: string): { w: number; h: number } | undefined;
};

export function createSessionMemory(initial: readonly LayoutBlock[]): SessionMemory {
  const snapshot = new Map<string, { w: number; h: number }>();
  for (const block of initial) {
    snapshot.set(block.id, { w: block.position.w, h: block.position.h });
  }

  return {
    getInitialSize(blockId: string): { w: number; h: number } | undefined {
      const size = snapshot.get(blockId);
      if (!size) return undefined;
      return { w: size.w, h: size.h };
    },
  };
}
