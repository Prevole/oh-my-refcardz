/**
 * Impact set computation for the layout solver.
 *
 * The impact set is the transitive closure of blocks affected by
 * collisions and constraint resolution. When block A pushes block B,
 * and B collides with C, then C becomes part of the impact set even
 * though A never directly intersected C.
 *
 * Propagation rules:
 * - Horizontal operations (east/west): propagate through shared rows
 * - Vertical operations (north/south): propagate through shared columns
 */

import { intersects, sharesRows, sharesColumns, right, bottom } from "./geometry";
import type { GridPosition, LayoutBlock, ResizeDirection } from "./types";

/**
 * Direction of propagation for impact analysis.
 */
export type PropagationDirection = ResizeDirection | "move";

/**
 * Find blocks that could potentially be impacted by a push in the given direction.
 *
 * For horizontal pushes (east/west):
 * - Only blocks that share rows with the source can be directly impacted
 *
 * For vertical pushes (north/south):
 * - Only blocks that share columns with the source can be directly impacted
 *
 * For moves:
 * - Any block that intersects with the target position could be impacted
 */
export function findPotentiallyImpacted(
  source: GridPosition,
  direction: PropagationDirection,
  blocks: LayoutBlock[],
  excludeId?: string
): LayoutBlock[] {
  return blocks.filter((block) => {
    if (block.id === excludeId) return false;

    switch (direction) {
      case "east":
        // Blocks to the right that share rows
        return block.position.x >= source.x && sharesRows(source, block.position);

      case "west":
        // Blocks to the left that share rows
        return right(block.position) <= right(source) && sharesRows(source, block.position);

      case "south":
        // Blocks below that share columns
        return block.position.y >= source.y && sharesColumns(source, block.position);

      case "north":
        // Blocks above that share columns
        return bottom(block.position) <= bottom(source) && sharesColumns(source, block.position);

      case "move":
        // Any block that intersects
        return intersects(source, block.position);
    }
  });
}

/**
 * Compute the direct collisions for a block at a new position.
 */
export function findDirectCollisions(
  newPosition: GridPosition,
  blocks: LayoutBlock[],
  excludeId: string
): LayoutBlock[] {
  return blocks.filter(
    (block) => block.id !== excludeId && intersects(newPosition, block.position)
  );
}

/**
 * Compute the transitive closure of impacted blocks.
 *
 * Starting from the initial collisions, this function repeatedly
 * finds new blocks that would be impacted if the current set of
 * impacted blocks were pushed, until no new blocks are found.
 *
 * The algorithm uses a visited set to prevent infinite loops
 * and oscillation.
 *
 * @param initialImpacted Initial set of directly colliding blocks
 * @param direction Direction of the push
 * @param allBlocks All blocks in the layout
 * @param sourceId ID of the source block (excluded from impact set)
 * @returns Set of all transitively impacted block IDs
 */
export function computeImpactSet(
  initialImpacted: LayoutBlock[],
  direction: PropagationDirection,
  allBlocks: LayoutBlock[],
  sourceId: string
): Set<string> {
  const impacted = new Set<string>();
  const visited = new Set<string>();
  const queue: LayoutBlock[] = [...initialImpacted];

  // Add initial impacted blocks
  for (const block of initialImpacted) {
    impacted.add(block.id);
  }

  while (queue.length > 0) {
    const current = queue.shift()!;

    if (visited.has(current.id)) continue;
    visited.add(current.id);

    // Find blocks that could be impacted if we push this block
    const potentiallyImpacted = findPotentiallyImpacted(
      current.position,
      direction,
      allBlocks,
      sourceId
    );

    for (const candidate of potentiallyImpacted) {
      if (!impacted.has(candidate.id) && candidate.id !== sourceId) {
        // Check if pushing current would cause a collision with candidate
        const pushedPosition = simulatePush(current.position, direction, 1);

        if (intersects(pushedPosition, candidate.position)) {
          impacted.add(candidate.id);
          queue.push(candidate);
        }
      }
    }
  }

  return impacted;
}

/**
 * Simulate pushing a position in a direction by a delta.
 * This is used to predict collisions after a push.
 */
function simulatePush(
  pos: GridPosition,
  direction: PropagationDirection,
  delta: number
): GridPosition {
  switch (direction) {
    case "east":
      return { ...pos, x: pos.x + delta };
    case "west":
      return { ...pos, x: pos.x - delta };
    case "south":
      return { ...pos, y: pos.y + delta };
    case "north":
      return { ...pos, y: pos.y - delta };
    case "move":
      // For move, we can't predict the push direction
      // Return the same position
      return pos;
  }
}

/**
 * Compute the full impact set for a source block moving to a new position.
 *
 * This is a convenience function that combines finding initial collisions
 * and computing the transitive closure.
 */
export function computeFullImpactSet(
  sourceId: string,
  newPosition: GridPosition,
  direction: PropagationDirection,
  allBlocks: LayoutBlock[]
): Set<string> {
  // Find initial direct collisions
  const directCollisions = findDirectCollisions(newPosition, allBlocks, sourceId);

  if (directCollisions.length === 0) {
    return new Set();
  }

  // Compute transitive closure
  return computeImpactSet(directCollisions, direction, allBlocks, sourceId);
}

/**
 * Get the blocks from an impact set.
 */
export function getImpactedBlocks(
  impactSet: Set<string>,
  allBlocks: LayoutBlock[]
): LayoutBlock[] {
  return allBlocks.filter((block) => impactSet.has(block.id));
}
