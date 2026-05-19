import { isContiguous } from "./geometry";
import type { Direction, LayoutBlock } from "./types";

/**
 * Compute the operation chain starting from `primaryId` in direction `D`.
 *
 * Breadth-first traversal: at every step, include all blocks contiguous to the
 * current member's `D` face. Contiguity propagates transitively through chain
 * members.
 *
 * Returns a Set of block ids. The primary is always included if it exists.
 */
export function computeOperationChain(
  primaryId: string,
  direction: Direction,
  blocks: readonly LayoutBlock[]
): Set<string> {
  const byId = new Map<string, LayoutBlock>();
  for (const block of blocks) {
    byId.set(block.id, block);
  }

  const primary = byId.get(primaryId);
  if (!primary) {
    return new Set();
  }

  const result = new Set<string>([primaryId]);
  const queue: LayoutBlock[] = [primary];

  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const candidate of blocks) {
      if (result.has(candidate.id)) continue;
      if (isContiguous(current.position, candidate.position, direction)) {
        result.add(candidate.id);
        queue.push(candidate);
      }
    }
  }

  return result;
}
