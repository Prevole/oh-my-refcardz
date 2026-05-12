/**
 * Compact resolution for the layout solver.
 *
 * When a block shrinks, neighboring blocks can be pulled toward
 * the freed space to reduce gaps. This is the opposite of push.
 *
 * Compacting rules:
 * - Only occurs when explicitly requested (Shift modifier)
 * - Pulls blocks in the opposite direction of the shrink
 * - Does NOT resize blocks, only moves them
 * - Respects grid boundaries
 * - Transitive: pulling one block may allow pulling others
 */

import { right, bottom, sortByDirection } from "./geometry";
import { hasCollision, replaceBlock } from "./collision";
import { DEFAULT_GRID_COLUMNS } from "./constraints";
import type { GridPosition, LayoutBlock, ResizeDirection } from "./types";

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

/**
 * Result of a compact operation.
 */
export type CompactResult = {
  /** The resulting blocks after compacting */
  blocks: LayoutBlock[];
  /** IDs of blocks that were moved */
  movedIds: Set<string>;
};

/**
 * Options for compact resolution.
 */
export type CompactOptions = {
  /** Number of columns in the grid */
  gridColumns: number;
};

// -----------------------------------------------------------------------------
// Direction Helpers
// -----------------------------------------------------------------------------

/**
 * Get the opposite direction (for pulling instead of pushing).
 */
export function oppositeDirection(direction: ResizeDirection): ResizeDirection {
  switch (direction) {
    case "east":
      return "west";
    case "west":
      return "east";
    case "south":
      return "north";
    case "north":
      return "south";
  }
}

/**
 * Check if a block is in the direction of potential compacting.
 *
 * For shrink direction "east" (block got smaller on right side):
 * - We pull blocks from the east (right) toward west (left)
 * - So we look for blocks that are to the right of the shrunken block
 */
function isInCompactDirection(
  candidate: GridPosition,
  reference: GridPosition,
  shrinkDirection: ResizeDirection
): boolean {
  switch (shrinkDirection) {
    case "east":
      // Shrink from right → pull blocks from the right
      return candidate.x >= right(reference);
    case "west":
      // Shrink from left → pull blocks from the left
      return right(candidate) <= reference.x;
    case "south":
      // Shrink from bottom → pull blocks from below
      return candidate.y >= bottom(reference);
    case "north":
      // Shrink from top → pull blocks from above
      return bottom(candidate) <= reference.y;
  }
}

/**
 * Calculate how much a block can be pulled toward the shrunken block.
 */
function calculatePullDistance(
  shrunk: GridPosition,
  candidate: GridPosition,
  shrinkDirection: ResizeDirection
): number {
  switch (shrinkDirection) {
    case "east":
      // Pull from right to left
      // Max distance = how far until candidate's left edge hits shrunk's right edge
      return candidate.x - right(shrunk);
    case "west":
      // Pull from left to right
      // Max distance = how far until candidate's right edge hits shrunk's left edge
      return shrunk.x - right(candidate);
    case "south":
      // Pull from below to above
      return candidate.y - bottom(shrunk);
    case "north":
      // Pull from above to below
      return shrunk.y - bottom(candidate);
  }
}

/**
 * Apply a pull (move toward the freed space).
 */
function applyPull(
  block: LayoutBlock,
  shrinkDirection: ResizeDirection,
  distance: number
): LayoutBlock {
  const pos = block.position;

  // Pull is opposite to shrink direction
  switch (shrinkDirection) {
    case "east":
      // Shrunk from right → pull left (decrease x)
      return { ...block, position: { ...pos, x: pos.x - distance } };
    case "west":
      // Shrunk from left → pull right (increase x)
      return { ...block, position: { ...pos, x: pos.x + distance } };
    case "south":
      // Shrunk from bottom → pull up (decrease y)
      return { ...block, position: { ...pos, y: pos.y - distance } };
    case "north":
      // Shrunk from top → pull down (increase y)
      return { ...block, position: { ...pos, y: pos.y + distance } };
  }
}

/**
 * Check if a pulled position would be valid.
 */
function isValidPull(
  pulled: GridPosition,
  shrinkDirection: ResizeDirection,
  gridColumns: number
): boolean {
  // Check grid boundaries
  if (pulled.x < 0 || pulled.y < 0) return false;
  if (right(pulled) > gridColumns) return false;

  return true;
}

// -----------------------------------------------------------------------------
// Main Compact Function
// -----------------------------------------------------------------------------

/**
 * Compact blocks toward freed space after a shrink.
 *
 * @param shrunkBlock The block that was shrunk (at its new, smaller size)
 * @param shrinkDirection Direction from which the block was shrunk
 * @param blocks All blocks in the layout
 * @param options Compact options
 * @returns Result of the compact operation
 */
export function compactBlocks(
  shrunkBlock: LayoutBlock,
  shrinkDirection: ResizeDirection,
  blocks: LayoutBlock[],
  options: CompactOptions
): CompactResult {
  const { gridColumns } = options;
  const movedIds = new Set<string>();

  // Start with a copy of all blocks
  let result = [...blocks];

  // Find blocks that could potentially be pulled
  const candidates = result.filter(
    (b) =>
      b.id !== shrunkBlock.id &&
      isInCompactDirection(b.position, shrunkBlock.position, shrinkDirection)
  );

  if (candidates.length === 0) {
    return { blocks: result, movedIds };
  }

  // Sort by direction (closest first for compacting)
  // This is opposite to push - we want to pull closest blocks first
  const pullDirection = oppositeDirection(shrinkDirection);
  const sorted = sortByDirection(candidates, pullDirection);

  // Process each candidate
  for (const candidate of sorted) {
    // Get current state of the candidate (it might have been updated)
    const current = result.find((b) => b.id === candidate.id)!;

    // Calculate max pull distance
    const maxPull = calculatePullDistance(
      shrunkBlock.position,
      current.position,
      shrinkDirection
    );

    if (maxPull <= 0) continue; // Can't pull closer

    // Try to pull as much as possible without causing collision
    let pullDistance = maxPull;
    let pulled = applyPull(current, shrinkDirection, pullDistance);

    // Check for collisions with other blocks (excluding the candidate itself)
    const others = result.filter((b) => b.id !== current.id);

    while (pullDistance > 0 && hasCollision(pulled, others)) {
      pullDistance--;
      pulled = applyPull(current, shrinkDirection, pullDistance);
    }

    // Check if the pull is valid
    if (pullDistance > 0 && isValidPull(pulled.position, shrinkDirection, gridColumns)) {
      result = replaceBlock(result, pulled);
      movedIds.add(pulled.id);
    }
  }

  return { blocks: result, movedIds };
}

/**
 * Perform a full compact pass on the layout.
 * This tries to reduce gaps by pulling all blocks upward and leftward.
 *
 * This is a more aggressive compacting that doesn't require a shrink event.
 *
 * @param blocks The blocks to compact
 */
export function compactLayout(blocks: LayoutBlock[]): CompactResult {
  const movedIds = new Set<string>();
  let result = [...blocks];
  let changed = true;
  let iterations = 0;
  const maxIterations = blocks.length * 2;

  // Keep compacting until no more changes
  while (changed && iterations < maxIterations) {
    changed = false;
    iterations++;

    // Sort by reading order (top-left first)
    const sorted = [...result].sort((a, b) => {
      if (a.position.y !== b.position.y) return a.position.y - b.position.y;
      if (a.position.x !== b.position.x) return a.position.x - b.position.x;
      return a.id.localeCompare(b.id);
    });

    for (const block of sorted) {
      const current = result.find((b) => b.id === block.id)!;
      const others = result.filter((b) => b.id !== current.id);

      // Try to move up
      let newY = current.position.y;
      while (newY > 0) {
        const testPos = { ...current.position, y: newY - 1 };
        const testBlock = { ...current, position: testPos };
        if (hasCollision(testBlock, others)) break;
        newY--;
      }

      // Try to move left
      let newX = current.position.x;
      const posAfterY = { ...current.position, y: newY };
      while (newX > 0) {
        const testPos = { ...posAfterY, x: newX - 1 };
        const testBlock = { ...current, position: testPos };
        if (hasCollision(testBlock, others)) break;
        newX--;
      }

      if (newY !== current.position.y || newX !== current.position.x) {
        const moved = {
          ...current,
          position: { ...current.position, x: newX, y: newY },
        };
        result = replaceBlock(result, moved);
        movedIds.add(moved.id);
        changed = true;
      }
    }
  }

  return { blocks: result, movedIds };
}

/**
 * Create default compact options.
 */
export function createCompactOptions(
  overrides?: Partial<CompactOptions>
): CompactOptions {
  return {
    gridColumns: DEFAULT_GRID_COLUMNS,
    ...overrides,
  };
}
