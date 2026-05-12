/**
 * Geometry utilities for the layout solver.
 *
 * All operations work with 0-indexed, half-open coordinates:
 * - A block at (x, y) with size (w, h) occupies [x, x+w) × [y, y+h)
 * - Two blocks intersect if their ranges overlap in both dimensions
 */

import type { GridPosition, LayoutBlock, ResizeDirection } from "./types";

// -----------------------------------------------------------------------------
// Intersection
// -----------------------------------------------------------------------------

/**
 * Check if two grid positions intersect.
 *
 * Uses half-open interval logic:
 * - Horizontal overlap: a.x < b.x + b.w && a.x + a.w > b.x
 * - Vertical overlap: a.y < b.y + b.h && a.y + a.h > b.y
 */
export function intersects(a: GridPosition, b: GridPosition): boolean {
  return (
    a.x < b.x + b.w &&
    a.x + a.w > b.x &&
    a.y < b.y + b.h &&
    a.y + a.h > b.y
  );
}

/**
 * Check if two blocks intersect (convenience wrapper).
 */
export function blocksIntersect(a: LayoutBlock, b: LayoutBlock): boolean {
  return intersects(a.position, b.position);
}

// -----------------------------------------------------------------------------
// Edges
// -----------------------------------------------------------------------------

/**
 * Get the right edge (exclusive) of a position.
 */
export function right(pos: GridPosition): number {
  return pos.x + pos.w;
}

/**
 * Get the bottom edge (exclusive) of a position.
 */
export function bottom(pos: GridPosition): number {
  return pos.y + pos.h;
}

// -----------------------------------------------------------------------------
// Bounding Box
// -----------------------------------------------------------------------------

/**
 * Compute the bounding box that contains all blocks.
 * Returns null if the array is empty.
 */
export function getBounds(blocks: LayoutBlock[]): GridPosition | null {
  if (blocks.length === 0) return null;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const block of blocks) {
    const { x, y, w, h } = block.position;
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x + w);
    maxY = Math.max(maxY, y + h);
  }

  return {
    x: minX,
    y: minY,
    w: maxX - minX,
    h: maxY - minY,
  };
}

/**
 * Get the maximum row used by any block (0-indexed, exclusive).
 */
export function getMaxRow(blocks: LayoutBlock[]): number {
  if (blocks.length === 0) return 0;

  let max = 0;
  for (const block of blocks) {
    max = Math.max(max, bottom(block.position));
  }
  return max;
}

// -----------------------------------------------------------------------------
// Sorting
// -----------------------------------------------------------------------------

/**
 * Compare two blocks by reading order (top-to-bottom, left-to-right).
 * Tie-breaker: id (for determinism).
 */
function compareReadingOrder(a: LayoutBlock, b: LayoutBlock): number {
  // Primary: y ascending
  if (a.position.y !== b.position.y) {
    return a.position.y - b.position.y;
  }
  // Secondary: x ascending
  if (a.position.x !== b.position.x) {
    return a.position.x - b.position.x;
  }
  // Tie-breaker: id
  return a.id.localeCompare(b.id);
}

/**
 * Sort blocks by visual reading order (top → bottom, left → right).
 * Returns a new sorted array.
 */
export function sortByReadingOrder(blocks: LayoutBlock[]): LayoutBlock[] {
  return [...blocks].sort(compareReadingOrder);
}

/**
 * Sort blocks by their position relative to a resize/push direction.
 *
 * Processing order for directional operations:
 * - Push right  → process right-most first (x descending)
 * - Push left   → process left-most first (x ascending)
 * - Push down   → process bottom-most first (y descending)
 * - Push up     → process top-most first (y ascending)
 *
 * Returns a new sorted array.
 */
export function sortByDirection(
  blocks: LayoutBlock[],
  direction: ResizeDirection
): LayoutBlock[] {
  return [...blocks].sort((a, b) => {
    let result: number;

    switch (direction) {
      case "east":
        // Right-most first (descending x)
        result = right(b.position) - right(a.position);
        break;
      case "west":
        // Left-most first (ascending x)
        result = a.position.x - b.position.x;
        break;
      case "south":
        // Bottom-most first (descending y)
        result = bottom(b.position) - bottom(a.position);
        break;
      case "north":
        // Top-most first (ascending y)
        result = a.position.y - b.position.y;
        break;
    }

    // Tie-breaker: reading order then id
    if (result !== 0) return result;

    if (a.position.y !== b.position.y) {
      return a.position.y - b.position.y;
    }
    if (a.position.x !== b.position.x) {
      return a.position.x - b.position.x;
    }
    return a.id.localeCompare(b.id);
  });
}

// -----------------------------------------------------------------------------
// Row/Column Sharing
// -----------------------------------------------------------------------------

/**
 * Check if two positions share any rows (vertical overlap).
 */
export function sharesRows(a: GridPosition, b: GridPosition): boolean {
  return a.y < b.y + b.h && a.y + a.h > b.y;
}

/**
 * Check if two positions share any columns (horizontal overlap).
 */
export function sharesColumns(a: GridPosition, b: GridPosition): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x;
}

// -----------------------------------------------------------------------------
// Position Manipulation
// -----------------------------------------------------------------------------

/**
 * Create a copy of a position with modifications.
 */
export function withPosition(
  pos: GridPosition,
  changes: Partial<GridPosition>
): GridPosition {
  return { ...pos, ...changes };
}

/**
 * Create a copy of a block with a modified position.
 */
export function withBlockPosition(
  block: LayoutBlock,
  changes: Partial<GridPosition>
): LayoutBlock {
  return {
    ...block,
    position: withPosition(block.position, changes),
  };
}

/**
 * Move a position by a delta.
 */
export function translate(
  pos: GridPosition,
  dx: number,
  dy: number
): GridPosition {
  return {
    ...pos,
    x: pos.x + dx,
    y: pos.y + dy,
  };
}

/**
 * Move a block by a delta.
 */
export function translateBlock(
  block: LayoutBlock,
  dx: number,
  dy: number
): LayoutBlock {
  return {
    ...block,
    position: translate(block.position, dx, dy),
  };
}
