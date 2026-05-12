/**
 * Push resolution for the layout solver.
 *
 * When a block moves or resizes and collides with other blocks,
 * those blocks are pushed away in the appropriate direction.
 *
 * Key behaviors:
 * - Blocks are pushed transitively (A pushes B, B pushes C)
 * - Blocks at grid boundaries may be shrunk to make room
 * - If shrinking is not possible, the operation is blocked
 * - Processing order is deterministic (most distant first)
 */

import { right, bottom, sortByDirection } from "./geometry";
import { findCollisions, replaceBlock } from "./collision";
import {
  clampToConstraints,
  DEFAULT_GRID_COLUMNS,
  getConstraints,
} from "./constraints";
import type { BlockConstraints, GridPosition, LayoutBlock, ResizeDirection } from "./types";

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

/**
 * Result of a push operation.
 */
export type PushResult = {
  /** The resulting blocks after pushing */
  blocks: LayoutBlock[];
  /** Whether the push was fully successful */
  success: boolean;
  /** If not successful, why it was blocked */
  blockedReason?: string;
  /** IDs of blocks that were pushed */
  pushedIds: Set<string>;
  /** IDs of blocks that were shrunk */
  shrunkIds: Set<string>;
};

/**
 * Options for push resolution.
 */
export type PushOptions = {
  /** Number of columns in the grid */
  gridColumns: number;
  /** Constraints for each block */
  constraints: Map<string, BlockConstraints>;
  /** Allow shrinking blocks to make room */
  allowShrink: boolean;
};

// -----------------------------------------------------------------------------
// Push Calculation
// -----------------------------------------------------------------------------

/**
 * Calculate how much a block needs to move to avoid collision.
 */
function calculatePushDistance(
  pusher: GridPosition,
  pushed: GridPosition,
  direction: ResizeDirection
): number {
  switch (direction) {
    case "east":
      // Pushed block needs to move right until its left edge clears pusher's right edge
      return right(pusher) - pushed.x;
    case "west":
      // Pushed block needs to move left until its right edge clears pusher's left edge
      return right(pushed) - pusher.x;
    case "south":
      // Pushed block needs to move down until its top edge clears pusher's bottom edge
      return bottom(pusher) - pushed.y;
    case "north":
      // Pushed block needs to move up until its bottom edge clears pusher's top edge
      return bottom(pushed) - pusher.y;
  }
}

/**
 * Apply a push to a block's position.
 */
function applyPush(
  block: LayoutBlock,
  direction: ResizeDirection,
  distance: number
): LayoutBlock {
  const pos = block.position;

  switch (direction) {
    case "east":
      return { ...block, position: { ...pos, x: pos.x + distance } };
    case "west":
      return { ...block, position: { ...pos, x: pos.x - distance } };
    case "south":
      return { ...block, position: { ...pos, y: pos.y + distance } };
    case "north":
      return { ...block, position: { ...pos, y: pos.y - distance } };
  }
}

/**
 * Check if a position exceeds grid boundaries in the push direction.
 */
function exceedsBoundary(
  pos: GridPosition,
  direction: ResizeDirection,
  gridColumns: number
): boolean {
  switch (direction) {
    case "east":
      return right(pos) > gridColumns;
    case "west":
      return pos.x < 0;
    case "south":
      // No boundary going down (unlimited rows)
      return false;
    case "north":
      return pos.y < 0;
  }
}

/**
 * Calculate how much to shrink a block to fit within grid boundaries.
 */
function calculateShrinkAmount(
  pos: GridPosition,
  direction: ResizeDirection,
  gridColumns: number
): number {
  switch (direction) {
    case "east":
      return right(pos) - gridColumns;
    case "west":
      return -pos.x;
    case "south":
      return 0; // No shrinking needed going down
    case "north":
      return -pos.y;
  }
}

/**
 * Apply shrinking to a block.
 * Shrinks from the appropriate edge based on push direction.
 */
function applyShrink(
  block: LayoutBlock,
  direction: ResizeDirection,
  amount: number,
  constraints: BlockConstraints
): { block: LayoutBlock; actualShrink: number } | null {
  const pos = block.position;
  let newPos: GridPosition;

  switch (direction) {
    case "east":
      // Shrink from the right edge (reduce width)
      newPos = { ...pos, w: pos.w - amount };
      break;
    case "west":
      // Shrink from the left edge (move right and reduce width)
      newPos = { ...pos, x: 0, w: pos.w - amount };
      break;
    case "south":
      // Shrink from the bottom edge (reduce height)
      newPos = { ...pos, h: pos.h - amount };
      break;
    case "north":
      // Shrink from the top edge (move down and reduce height)
      newPos = { ...pos, y: 0, h: pos.h - amount };
      break;
  }

  // Clamp to constraints
  const clamped = clampToConstraints(newPos, constraints);

  // Check if we achieved the required shrink
  const actualShrink =
    direction === "east" || direction === "west"
      ? pos.w - clamped.w
      : pos.h - clamped.h;

  if (actualShrink < amount) {
    // Can't shrink enough
    return null;
  }

  return {
    block: { ...block, position: clamped },
    actualShrink,
  };
}

// -----------------------------------------------------------------------------
// Main Push Function
// -----------------------------------------------------------------------------

/**
 * Push blocks away from a source block in a given direction.
 *
 * This function handles:
 * 1. Finding blocks that collide with the source
 * 2. Processing them in the correct order (most distant first)
 * 3. Pushing them away (and transitively pushing their collisions)
 * 4. Shrinking blocks at boundaries if allowed and necessary
 * 5. Blocking the operation if resolution is impossible
 *
 * @param source The block causing the push (at its new position)
 * @param direction Direction to push colliding blocks
 * @param blocks All blocks in the layout
 * @param options Push options
 * @returns Result of the push operation
 */
export function pushBlocks(
  source: LayoutBlock,
  direction: ResizeDirection,
  blocks: LayoutBlock[],
  options: PushOptions
): PushResult {
  const { gridColumns, constraints, allowShrink } = options;

  // Start with a copy of all blocks, with source at its new position
  let result = blocks.map((b) => (b.id === source.id ? source : b));
  const pushedIds = new Set<string>();
  const shrunkIds = new Set<string>();

  // Queue of blocks that need to push their collisions
  // Start with the source block
  const pushQueue: string[] = [source.id];
  const processed = new Set<string>();

  let iterations = 0;
  const maxIterations = blocks.length * 3; // Safety limit

  while (pushQueue.length > 0 && iterations < maxIterations) {
    iterations++;

    const pusherId = pushQueue.shift()!;
    if (processed.has(pusherId)) continue;
    processed.add(pusherId);

    const pusher = result.find((b) => b.id === pusherId)!;

    // Find blocks that collide with this pusher
    const collisions = findCollisions(pusher, result);

    if (collisions.length === 0) continue;

    // Sort by direction (process most distant first for stability)
    const sorted = sortByDirection(collisions, direction);

    for (const colliding of sorted) {
      // Calculate push distance
      const distance = calculatePushDistance(
        pusher.position,
        colliding.position,
        direction
      );

      if (distance <= 0) continue; // No push needed

      // Apply push
      let pushed = applyPush(colliding, direction, distance);
      pushedIds.add(pushed.id);

      // Check if push exceeds boundary
      if (exceedsBoundary(pushed.position, direction, gridColumns)) {
        if (!allowShrink) {
          return {
            blocks: result,
            success: false,
            blockedReason: `Block ${pushed.id} would exceed grid boundary`,
            pushedIds,
            shrunkIds,
          };
        }

        // Try to shrink
        const shrinkAmount = calculateShrinkAmount(pushed.position, direction, gridColumns);
        const blockConstraints = getConstraints(pushed, constraints);
        const shrinkResult = applyShrink(pushed, direction, shrinkAmount, blockConstraints);

        if (!shrinkResult) {
          return {
            blocks: result,
            success: false,
            blockedReason: `Block ${pushed.id} cannot be shrunk enough`,
            pushedIds,
            shrunkIds,
          };
        }

        pushed = shrinkResult.block;
        shrunkIds.add(pushed.id);
      }

      // Update result
      result = replaceBlock(result, pushed);

      // Add this pushed block to the queue so it can push its collisions
      if (!processed.has(pushed.id)) {
        pushQueue.push(pushed.id);
      }
    }
  }

  if (iterations >= maxIterations) {
    return {
      blocks: result,
      success: false,
      blockedReason: "Push resolution exceeded iteration limit",
      pushedIds,
      shrunkIds,
    };
  }

  return {
    blocks: result,
    success: true,
    pushedIds,
    shrunkIds,
  };
}

/**
 * Push blocks in the default direction for a move operation.
 * Prefers pushing right, then down.
 */
export function pushBlocksForMove(
  source: LayoutBlock,
  blocks: LayoutBlock[],
  options: Omit<PushOptions, "allowShrink">
): PushResult {
  // Try pushing right first
  const rightResult = pushBlocks(source, "east", blocks, {
    ...options,
    allowShrink: true,
  });

  if (rightResult.success) {
    return rightResult;
  }

  // Try pushing down
  const downResult = pushBlocks(source, "south", blocks, {
    ...options,
    allowShrink: false, // No shrink needed going down
  });

  if (downResult.success) {
    return downResult;
  }

  // Return the right result with failure info
  return rightResult;
}

/**
 * Create default push options.
 */
export function createPushOptions(
  blocks: LayoutBlock[],
  overrides?: Partial<PushOptions>
): PushOptions {
  const constraintsMap = new Map<string, BlockConstraints>();

  for (const block of blocks) {
    constraintsMap.set(block.id, getConstraints(block, constraintsMap));
  }

  return {
    gridColumns: DEFAULT_GRID_COLUMNS,
    constraints: constraintsMap,
    allowShrink: true,
    ...overrides,
  };
}
