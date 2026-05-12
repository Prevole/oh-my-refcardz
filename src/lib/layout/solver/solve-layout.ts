/**
 * Main solver for the layout engine.
 *
 * This module orchestrates all layout operations:
 * - Move: relocate a block to a new position
 * - Resize: change a block's size from a specific edge
 *
 * The solver is:
 * - Deterministic: same input → same output
 * - Immutable: never mutates input, returns new arrays
 * - Stateless: no internal state between calls
 * - Reversible: can recompute from any starting state
 */

import { getBlockById, replaceBlock } from "./collision";
import {
  clampPosition,
  clampToGrid,
  DEFAULT_GRID_COLUMNS,
  getConstraints,
  buildConstraintsMap,
} from "./constraints";
import { pushBlocks, pushBlocksForMove, createPushOptions } from "./push";
import { compactBlocks, createCompactOptions } from "./compact";
import type {
  GridPosition,
  LayoutBlock,
  LayoutCandidate,
  LayoutIntent,
  MoveIntent,
  ResizeDirection,
  ResizeIntent,
  SolverOptions,
} from "./types";

// -----------------------------------------------------------------------------
// Solver Configuration
// -----------------------------------------------------------------------------

/**
 * Default drag vertical limit factor.
 * Blocks can be dragged at most this many times their height downward.
 */
export const DEFAULT_DRAG_VERTICAL_FACTOR = 3;

// -----------------------------------------------------------------------------
// Move Resolution
// -----------------------------------------------------------------------------

/**
 * Apply a resize delta to a position.
 */
function applyResizeDelta(
  pos: GridPosition,
  direction: ResizeDirection,
  delta: number
): GridPosition {
  switch (direction) {
    case "east":
      // Grow/shrink from right edge
      return { ...pos, w: pos.w + delta };
    case "west":
      // Grow/shrink from left edge (adjust x and w)
      return { ...pos, x: pos.x - delta, w: pos.w + delta };
    case "south":
      // Grow/shrink from bottom edge
      return { ...pos, h: pos.h + delta };
    case "north":
      // Grow/shrink from top edge (adjust y and h)
      return { ...pos, y: pos.y - delta, h: pos.h + delta };
  }
}

/**
 * Solve a move intent.
 *
 * 1. Calculate the target position
 * 2. Clamp to grid boundaries
 * 3. Push colliding blocks
 * 4. Compact layout after move
 */
function solveMove(
  intent: MoveIntent,
  blocks: LayoutBlock[],
  options: SolverOptions
): LayoutCandidate {
  const { gridColumns, constraints } = options;

  // Find the block to move
  const block = getBlockById(blocks, intent.blockId);
  if (!block) {
    return {
      layout: blocks,
      accepted: false,
      blockedReason: `Block ${intent.blockId} not found`,
      pushedIds: new Set(),
      shrunkIds: new Set(),
    };
  }

  // Calculate target position
  const targetPos: GridPosition = {
    x: intent.x,
    y: intent.y,
    w: block.position.w,
    h: block.position.h,
  };

  // Clamp to grid
  const clampedPos = clampToGrid(targetPos, gridColumns);

  // Create the moved block
  const movedBlock: LayoutBlock = {
    ...block,
    position: clampedPos,
  };

  // Update blocks with the moved block
  let result = replaceBlock(blocks, movedBlock);

  // Push colliding blocks in the direction of movement
  const pushResult = pushBlocksForMove(movedBlock, block.position, result, {
    gridColumns,
    constraints,
    allowShrink: intent.allowShrink ?? true,
  });

  if (!pushResult.success) {
    // Can't complete the move
    return {
      layout: blocks, // Return original
      accepted: false,
      blockedReason: pushResult.blockedReason,
      pushedIds: pushResult.pushedIds,
      shrunkIds: pushResult.shrunkIds,
    };
  }

  result = pushResult.blocks;

  // Auto-compact after move
  // Note: we don't compact during preview for performance
  // This could be made optional via options

  return {
    layout: result,
    accepted: true,
    pushedIds: pushResult.pushedIds,
    shrunkIds: pushResult.shrunkIds,
  };
}

/**
 * Solve a resize intent.
 *
 * 1. Calculate the new size
 * 2. Clamp to constraints
 * 3. If expanding: push colliding blocks
 * 4. If shrinking with compact: pull neighboring blocks
 */
function solveResize(
  intent: ResizeIntent,
  blocks: LayoutBlock[],
  options: SolverOptions
): LayoutCandidate {
  const { gridColumns, constraints } = options;
  const pushedIds = new Set<string>();
  const shrunkIds = new Set<string>();

  // Find the block to resize
  const block = getBlockById(blocks, intent.blockId);
  if (!block) {
    return {
      layout: blocks,
      accepted: false,
      blockedReason: `Block ${intent.blockId} not found`,
      pushedIds,
      shrunkIds,
    };
  }

  const blockConstraints = getConstraints(block, constraints);

  // Check if resize direction is allowed
  if (!blockConstraints.allowedResizeDirections.includes(intent.direction)) {
    return {
      layout: blocks,
      accepted: false,
      blockedReason: `Resize direction ${intent.direction} not allowed for this block`,
      pushedIds,
      shrunkIds,
    };
  }

  // Apply resize delta
  const newPos = applyResizeDelta(block.position, intent.direction, intent.delta);

  // Clamp to constraints and grid
  const clampedPos = clampPosition(newPos, blockConstraints, gridColumns);

  // Create the resized block
  const resizedBlock: LayoutBlock = {
    ...block,
    position: clampedPos,
  };

  // Update blocks with the resized block
  let result = replaceBlock(blocks, resizedBlock);

  const isExpanding = intent.delta > 0;
  const isShrinking = intent.delta < 0;

  if (isExpanding) {
    // Push colliding blocks in the resize direction
    const pushOpts = createPushOptions(result, {
      gridColumns,
      constraints,
      allowShrink: true,
    });

    const pushResult = pushBlocks(resizedBlock, intent.direction, result, pushOpts);

    if (!pushResult.success) {
      // Try with reduced expansion
      // For now, just fail
      return {
        layout: blocks,
        accepted: false,
        blockedReason: pushResult.blockedReason,
        pushedIds: pushResult.pushedIds,
        shrunkIds: pushResult.shrunkIds,
      };
    }

    result = pushResult.blocks;
    pushResult.pushedIds.forEach(id => pushedIds.add(id));
    pushResult.shrunkIds.forEach(id => shrunkIds.add(id));
  }

  if (isShrinking && intent.compact) {
    // Compact neighboring blocks toward the freed space
    const compactOpts = createCompactOptions({ gridColumns });
    const compactResult = compactBlocks(resizedBlock, intent.direction, result, compactOpts);
    result = compactResult.blocks;
  }

  return {
    layout: result,
    accepted: true,
    pushedIds,
    shrunkIds,
  };
}

// -----------------------------------------------------------------------------
// Main Solver
// -----------------------------------------------------------------------------

/**
 * Solve a layout intent.
 *
 * This is the main entry point for the solver. It takes:
 * - An initial layout (immutable)
 * - An intent (move or resize)
 * - Solver options
 *
 * And returns a LayoutCandidate with:
 * - The resulting layout
 * - Whether the intent was accepted
 * - Optional reason if blocked
 *
 * The solver is deterministic and immutable - it never modifies its inputs.
 */
export function solveLayout(
  initialLayout: LayoutBlock[],
  intent: LayoutIntent,
  options: SolverOptions
): LayoutCandidate {
  switch (intent.type) {
    case "move":
      return solveMove(intent, initialLayout, options);
    case "resize":
      return solveResize(intent, initialLayout, options);
  }
}

// -----------------------------------------------------------------------------
// Convenience Functions
// -----------------------------------------------------------------------------

/**
 * Create default solver options.
 */
export function createSolverOptions(
  blocks: LayoutBlock[],
  overrides?: Partial<SolverOptions>
): SolverOptions {
  return {
    gridColumns: DEFAULT_GRID_COLUMNS,
    constraints: buildConstraintsMap(blocks),
    ...overrides,
  };
}

/**
 * Create a move intent.
 */
export function createMoveIntent(
  blockId: string,
  x: number,
  y: number
): MoveIntent {
  return { type: "move", blockId, x, y };
}

/**
 * Create a resize intent.
 */
export function createResizeIntent(
  blockId: string,
  direction: ResizeDirection,
  delta: number,
  compact: boolean = false
): ResizeIntent {
  return { type: "resize", blockId, direction, delta, compact };
}
