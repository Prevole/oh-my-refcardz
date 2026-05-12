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

import { right, bottom, sortByDirection, intersects } from "./geometry";
import { findCollisions, replaceBlock } from "./collision";
import {
  clampToConstraints,
  DEFAULT_GRID_COLUMNS,
  getConstraints,
} from "./constraints";
import { debugRecorder } from "@/lib/debug";
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

// -----------------------------------------------------------------------------
// Move Push Resolution (Independent Axes with Wrapping)
// -----------------------------------------------------------------------------

/**
 * Options for move push resolution.
 */
export type MovePushOptions = {
  /** Number of columns in the grid */
  gridColumns: number;
  /** Constraints for each block */
  constraints: Map<string, BlockConstraints>;
  /** Allow shrinking blocks to make room (can be disabled with Alt+Drag) */
  allowShrink: boolean;
};

/**
 * Check if a block is "in the path" of movement on the X axis.
 * A block is in the path if it overlaps the horizontal sweep between
 * the original and new positions.
 */
function isInHorizontalPath(
  block: LayoutBlock,
  originalPos: GridPosition,
  newPos: GridPosition
): boolean {
  // Block must share rows with the moving block
  if (block.position.y >= bottom(newPos) || bottom(block.position) <= newPos.y) {
    return false;
  }

  // Check if block overlaps the horizontal sweep
  const sweepLeft = Math.min(originalPos.x, newPos.x);
  const sweepRight = Math.max(right(originalPos), right(newPos));

  return block.position.x < sweepRight && right(block.position) > sweepLeft;
}

/**
 * Check if a block is "in the path" of movement on the Y axis.
 * A block is in the path if it overlaps the vertical sweep between
 * the original and new positions.
 */
function isInVerticalPath(
  block: LayoutBlock,
  originalPos: GridPosition,
  newPos: GridPosition
): boolean {
  // Block must share columns with the moving block
  if (block.position.x >= right(newPos) || right(block.position) <= newPos.x) {
    return false;
  }

  // Check if block overlaps the vertical sweep
  const sweepTop = Math.min(originalPos.y, newPos.y);
  const sweepBottom = Math.max(bottom(originalPos), bottom(newPos));

  return block.position.y < sweepBottom && bottom(block.position) > sweepTop;
}

/**
 * Determine if a block is "ahead" of the source in the push direction.
 * A block is "ahead" if pushing it in the direction makes sense.
 * 
 * For moving right: block is ahead if its center is to the right of source's center
 * For moving left: block is ahead if its center is to the left of source's center
 * etc.
 */
function isAheadInDirection(
  block: LayoutBlock,
  source: LayoutBlock,
  originalPos: GridPosition,
  direction: "horizontal" | "vertical"
): boolean {
  if (direction === "horizontal") {
    const dx = source.position.x - originalPos.x;
    const blockCenterX = block.position.x + block.position.w / 2;
    const sourceCenterX = source.position.x + source.position.w / 2;
    
    if (dx > 0) {
      // Moving right: block is ahead if its center is to the right of (or at) source's center
      return blockCenterX >= sourceCenterX;
    } else if (dx < 0) {
      // Moving left: block is ahead if its center is to the left of (or at) source's center
      return blockCenterX <= sourceCenterX;
    }
    return false;
  } else {
    const dy = source.position.y - originalPos.y;
    const blockCenterY = block.position.y + block.position.h / 2;
    const sourceCenterY = source.position.y + source.position.h / 2;
    
    if (dy > 0) {
      // Moving down: block is ahead if its center is below (or at) source's center
      return blockCenterY >= sourceCenterY;
    } else if (dy < 0) {
      // Moving up: block is ahead if its center is above (or at) source's center
      return blockCenterY <= sourceCenterY;
    }
    return false;
  }
}

/**
 * Wrap a block below the source block.
 * When pushing fails (in any direction), we always wrap downward
 * because south is the only direction without a grid limit.
 * 
 * The block keeps its X position (C1 decision).
 */
function wrapBlock(
  block: LayoutBlock,
  source: LayoutBlock
): LayoutBlock {
  const pos = block.position;
  // Always wrap below the source, keeping X position
  return { ...block, position: { ...pos, y: bottom(source.position) } };
}

/**
 * Resolve collisions for a single axis.
 * Returns the modified blocks and tracking info.
 */
function resolveAxisCollisions(
  source: LayoutBlock,
  originalPos: GridPosition,
  blocks: LayoutBlock[],
  axis: "horizontal" | "vertical",
  options: MovePushOptions
): PushResult {
  const { gridColumns, constraints, allowShrink } = options;
  const direction: ResizeDirection = axis === "horizontal"
    ? (source.position.x > originalPos.x ? "east" : "west")
    : (source.position.y > originalPos.y ? "south" : "north");

  // No movement on this axis
  const delta = axis === "horizontal"
    ? source.position.x - originalPos.x
    : source.position.y - originalPos.y;

  if (delta === 0) {
    return {
      blocks,
      success: true,
      pushedIds: new Set(),
      shrunkIds: new Set(),
    };
  }

  // Start with a copy of blocks
  let result = [...blocks];
  const pushedIds = new Set<string>();
  const shrunkIds = new Set<string>();
  const wrappedIds = new Set<string>();

  // Find blocks in the path
  const inPath = axis === "horizontal"
    ? (b: LayoutBlock) => isInHorizontalPath(b, originalPos, source.position)
    : (b: LayoutBlock) => isInVerticalPath(b, originalPos, source.position);

  // Blocks that need resolution (collide with source AND are in the path)
  const allCollisions = findCollisions(source, result);
  const collisions = allCollisions.filter(inPath);

  // Record collision event for debug recorder
  debugRecorder.recordCollision({
    sourceId: source.id,
    sourcePosition: source.position,
    originalPosition: { x: originalPos.x, y: originalPos.y },
    axis,
    direction,
    allCollisions: allCollisions.map(b => b.id),
    collisionsInPath: collisions.map(b => b.id),
  });

  if (collisions.length === 0) {
    return {
      blocks: result,
      success: true,
      pushedIds,
      shrunkIds,
    };
  }

  // Sort by direction for stable processing
  const sorted = sortByDirection(collisions, direction);

  // Process each collision
  for (const colliding of sorted) {
    // Skip if already wrapped (will be handled in cascade)
    if (wrappedIds.has(colliding.id)) continue;

    // Get the current version of the block (may have been modified)
    const current = result.find(b => b.id === colliding.id);
    if (!current) continue;

    // Check if it still collides
    if (!intersects(source.position, current.position)) continue;

    // Determine if block is ahead (in movement direction) or behind
    const isAhead = isAheadInDirection(current, source, originalPos, axis);

    if (isAhead) {
      // Block is ahead: try push → shrink → wrap
      const pushDistance = calculatePushDistance(source.position, current.position, direction);

      if (pushDistance <= 0) continue;

      let pushed = applyPush(current, direction, pushDistance);
      
      // Check if the push would cause a NEW collision with other blocks
      // If so, try to shrink or wrap THIS block instead of cascading
      const wouldCauseCollision = findCollisions(pushed, result).some(
        c => c.id !== source.id && !pushedIds.has(c.id) && !wrappedIds.has(c.id)
      );
      
      if (wouldCauseCollision) {
        // Try to shrink this block to fit without causing collision
        const blockConstraints = getConstraints(current, constraints);
        
        if (allowShrink) {
          // Calculate how much we need to shrink to avoid the cascade collision
          const shrinkResult = applyShrink(current, direction, pushDistance, blockConstraints);
          
          if (shrinkResult) {
            pushed = shrinkResult.block;
            shrunkIds.add(pushed.id);
            result = replaceBlock(result, pushed);
            continue;
          }
        }
        
        // Can't shrink enough, wrap this block below the source
        pushed = wrapBlock(current, source);
        wrappedIds.add(pushed.id);
        result = replaceBlock(result, pushed);
        continue;
      }
      
      pushedIds.add(pushed.id);

      // Check boundary
      if (exceedsBoundary(pushed.position, direction, gridColumns)) {
        if (allowShrink) {
          // Try to shrink
          const shrinkAmount = calculateShrinkAmount(pushed.position, direction, gridColumns);
          const blockConstraints = getConstraints(pushed, constraints);
          const shrinkResult = applyShrink(pushed, direction, shrinkAmount, blockConstraints);

          if (shrinkResult) {
            pushed = shrinkResult.block;
            shrunkIds.add(pushed.id);
          } else {
            // Can't shrink enough, wrap instead
            pushed = wrapBlock(current, source);
            wrappedIds.add(pushed.id);
            pushedIds.delete(pushed.id);
          }
        } else {
          // No shrink allowed, wrap
          pushed = wrapBlock(current, source);
          wrappedIds.add(pushed.id);
          pushedIds.delete(pushed.id);
        }
      }

      result = replaceBlock(result, pushed);
    } else {
      // Block is behind or overlapping: wrap it to the other side
      const wrapped = wrapBlock(current, source);
      wrappedIds.add(wrapped.id);
      result = replaceBlock(result, wrapped);
    }
  }

  // Cascade: pushed/wrapped blocks may now collide with others
  // Process in order based on direction
  const toProcess = [...pushedIds, ...wrappedIds];

  for (const blockId of toProcess) {
    const pusher = result.find(b => b.id === blockId);
    if (!pusher) continue;

    // Find new collisions caused by this block
    const newCollisions = findCollisions(pusher, result);

    for (const collision of newCollisions) {
      // Skip the source and already processed blocks
      if (collision.id === source.id) continue;
      if (pushedIds.has(collision.id) || wrappedIds.has(collision.id)) continue;

      // Wrapped blocks push south (they were moved down)
      // Pushed blocks push in the original direction
      const cascadeDirection = wrappedIds.has(blockId) ? "south" : direction;
      
      const pushDistance = calculatePushDistance(pusher.position, collision.position, cascadeDirection);
      if (pushDistance <= 0) continue;

      let pushed = applyPush(collision, cascadeDirection, pushDistance);
      pushedIds.add(pushed.id);

      // Handle boundary
      if (exceedsBoundary(pushed.position, cascadeDirection, gridColumns)) {
        if (allowShrink) {
          const shrinkAmount = calculateShrinkAmount(pushed.position, cascadeDirection, gridColumns);
          const blockConstraints = getConstraints(pushed, constraints);
          const shrinkResult = applyShrink(pushed, cascadeDirection, shrinkAmount, blockConstraints);

          if (shrinkResult) {
            pushed = shrinkResult.block;
            shrunkIds.add(pushed.id);
          } else {
            // Can't shrink, push down as fallback (south never fails)
            const fallbackPush = bottom(pusher.position) - pushed.position.y;
            pushed = applyPush(collision, "south", Math.max(1, fallbackPush));
          }
        } else {
          // Push down as fallback
          const fallbackPush = bottom(pusher.position) - pushed.position.y;
          pushed = applyPush(collision, "south", Math.max(1, fallbackPush));
        }
      }

      result = replaceBlock(result, pushed);
    }
  }

  return {
    blocks: result,
    success: true,
    pushedIds,
    shrunkIds,
  };
}

/**
 * Push blocks for a move operation using independent axis resolution.
 *
 * Algorithm:
 * 1. Process X axis: push/shrink/wrap blocks in the horizontal path
 * 2. Process Y axis: push/shrink/wrap blocks in the vertical path
 * 3. Merge results
 *
 * This approach handles diagonal movement naturally and ensures
 * blocks can always be rearranged (via wrapping).
 *
 * @param source The block at its new position
 * @param originalPosition The block's original position (before move)
 * @param blocks All blocks in the layout
 * @param options Push options (including allowShrink for Alt+Drag mode)
 */
export function pushBlocksForMove(
  source: LayoutBlock,
  originalPosition: GridPosition,
  blocks: LayoutBlock[],
  options: Omit<MovePushOptions, "allowShrink"> & { allowShrink?: boolean }
): PushResult {
  const dx = source.position.x - originalPosition.x;
  const dy = source.position.y - originalPosition.y;

  // No movement
  if (dx === 0 && dy === 0) {
    return {
      blocks,
      success: true,
      pushedIds: new Set(),
      shrunkIds: new Set(),
    };
  }

  const fullOptions: MovePushOptions = {
    ...options,
    allowShrink: options.allowShrink ?? true,
  };

  // Step 1: Process X axis first (B1 decision)
  let result = blocks;
  let allPushedIds = new Set<string>();
  let allShrunkIds = new Set<string>();

  if (dx !== 0) {
    const xResult = resolveAxisCollisions(source, originalPosition, result, "horizontal", fullOptions);
    result = xResult.blocks;
    allPushedIds = new Set([...allPushedIds, ...xResult.pushedIds]);
    allShrunkIds = new Set([...allShrunkIds, ...xResult.shrunkIds]);
  }

  // Step 2: Process Y axis
  if (dy !== 0) {
    // Use the result from X axis processing
    const yResult = resolveAxisCollisions(source, originalPosition, result, "vertical", fullOptions);
    result = yResult.blocks;
    allPushedIds = new Set([...allPushedIds, ...yResult.pushedIds]);
    allShrunkIds = new Set([...allShrunkIds, ...yResult.shrunkIds]);
  }

  // Step 3: Final collision check and cleanup
  // Ensure the source is in the result at its new position
  result = replaceBlock(result, source);

  // Final pass: resolve ALL remaining collisions iteratively
  // This handles cascade effects where pushing one block causes new collisions
  // 
  // Key principle: blocks that were already pushed should push static blocks,
  // not the other way around. This prevents pushed blocks from being pushed
  // further away by stationary blocks they collide with.
  // 
  // When both blocks are moved, the one that was moved earlier pushes the later one.
  const finalPassData: Array<{ id: string; position: { x: number; y: number; w: number; h: number }; pushDistance: number }> = [];
  const maxIterations = result.length * 2; // Safety limit
  let iteration = 0;

  // Track which blocks have been moved (source + all pushed blocks) and their order
  // Lower number = moved earlier = has push priority
  const moveOrder = new Map<string, number>();
  moveOrder.set(source.id, 0);
  let orderCounter = 1;
  for (const id of allPushedIds) {
    if (!moveOrder.has(id)) {
      moveOrder.set(id, orderCounter++);
    }
  }

  while (iteration < maxIterations) {
    iteration++;
    
    // Find all collisions in the layout
    let hasCollisions = false;
    
    for (const blockA of result) {
      const collisions = findCollisions(blockA, result);
      
      if (collisions.length > 0) {
        hasCollisions = true;
        
        // Determine which block should be pushed based on movement status:
        // - If blockA was moved and collision wasn't → push collision
        // - If collision was moved and blockA wasn't → push blockA
        // - If both were moved → earlier mover pushes later mover
        // - If neither was moved → push the one that's lower (larger y)
        for (const collision of collisions) {
          const blockAOrder = moveOrder.get(blockA.id);
          const collisionOrder = moveOrder.get(collision.id);
          const blockAMoved = blockAOrder !== undefined;
          const collisionMoved = collisionOrder !== undefined;
          
          let blockToPush: LayoutBlock;
          let pusher: LayoutBlock;
          
          if (blockAMoved && !collisionMoved) {
            // blockA was moved, push the static collision block
            blockToPush = collision;
            pusher = blockA;
          } else if (!blockAMoved && collisionMoved) {
            // collision was moved, push the static blockA
            blockToPush = blockA;
            pusher = collision;
          } else if (blockAMoved && collisionMoved) {
            // Both moved: earlier mover pushes later mover
            if (blockAOrder! < collisionOrder!) {
              blockToPush = collision;
              pusher = blockA;
            } else {
              blockToPush = blockA;
              pusher = collision;
            }
          } else {
            // Neither moved: push the one that's lower (or rightmost if same y)
            if (blockA.position.y < collision.position.y || 
                (blockA.position.y === collision.position.y && blockA.position.x < collision.position.x)) {
              blockToPush = collision;
              pusher = blockA;
            } else {
              blockToPush = blockA;
              pusher = collision;
            }
          }
          
          const pushDistance = bottom(pusher.position) - blockToPush.position.y;
          
          if (pushDistance > 0) {
            finalPassData.push({
              id: blockToPush.id,
              position: { ...blockToPush.position },
              pushDistance,
            });
            
            const pushed = applyPush(blockToPush, "south", pushDistance);
            result = replaceBlock(result, pushed);
            allPushedIds.add(pushed.id);
            
            // Add to move order if not already there
            if (!moveOrder.has(pushed.id)) {
              moveOrder.set(pushed.id, orderCounter++);
            }
          }
        }
        
        // Restart collision detection after modifications
        break;
      }
    }
    
    if (!hasCollisions) break;
  }

  // Record final pass event
  if (finalPassData.length > 0) {
    debugRecorder.recordFinalPass({
      sourceId: source.id,
      finalCollisions: finalPassData,
    });
  }

  return {
    blocks: result,
    success: true,
    pushedIds: allPushedIds,
    shrunkIds: allShrunkIds,
  };
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
