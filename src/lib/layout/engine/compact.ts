/**
 * Compact: mirror of push, used by resize-shrink with the `compact` flag.
 *
 * See docs/layout-engine.md, "Compact (resize shrink + compact flag)".
 *
 * Pure function: returns the translation each chain member should undergo to
 * compact toward the primary. Does NOT check for collisions with non-chain
 * blocks — that is the caller's responsibility (engine.ts), which validates
 * the proposed translations before applying them and falls back when needed.
 */

import { computeOperationChain } from "./chain";
import type { Direction, LayoutBlock } from "./types";

/**
 * Compute the translation each block in the compact chain should apply.
 *
 * For a primary that shrunk its `edge` face (e.g. `east` retreats westward),
 * the chain in direction `edge` (toward the side that was vacated) is pulled
 * by 1 cell in the **opposite** direction (toward the primary).
 *
 * Returns a map: blockId → { dx, dy }. The primary itself is NOT included.
 * Empty map if nothing to compact.
 */
export function computeCompactTranslations(
  blocks: readonly LayoutBlock[],
  primaryId: string,
  edge: Direction
): Map<string, { dx: number; dy: number }> {
  const chainIds = computeOperationChain(primaryId, edge, blocks);
  if (chainIds.size <= 1) return new Map(); // only the primary, or unknown id

  const inverse = inverseDelta(edge);
  const result = new Map<string, { dx: number; dy: number }>();
  for (const id of chainIds) {
    if (id === primaryId) continue;
    result.set(id, inverse);
  }
  return result;
}

function inverseDelta(direction: Direction): { dx: number; dy: number } {
  switch (direction) {
    case "north":
      return { dx: 0, dy: 1 };
    case "south":
      return { dx: 0, dy: -1 };
    case "east":
      return { dx: -1, dy: 0 };
    case "west":
      return { dx: 1, dy: 0 };
  }
}
