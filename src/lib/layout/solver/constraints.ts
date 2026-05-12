/**
 * Constraint validation for the layout solver.
 *
 * Handles:
 * - Grid boundary constraints (x >= 0, y >= 0, x + w <= columns)
 * - Block size constraints (min/max width and height)
 * - Clamping positions to valid ranges
 */

import type { BlockConstraints, GridPosition, LayoutBlock } from "./types";

// -----------------------------------------------------------------------------
// Grid Constants
// -----------------------------------------------------------------------------

/**
 * Default number of columns in the grid.
 * This matches GRID_COLUMNS from sheet-grid.tsx.
 */
export const DEFAULT_GRID_COLUMNS = 36;

// -----------------------------------------------------------------------------
// Validation
// -----------------------------------------------------------------------------

/**
 * Check if a position is within grid boundaries.
 */
export function isWithinGrid(
  pos: GridPosition,
  gridColumns: number = DEFAULT_GRID_COLUMNS
): boolean {
  return (
    pos.x >= 0 &&
    pos.y >= 0 &&
    pos.w > 0 &&
    pos.h > 0 &&
    pos.x + pos.w <= gridColumns
  );
}

/**
 * Check if a position satisfies block constraints.
 */
export function satisfiesConstraints(
  pos: GridPosition,
  constraints: BlockConstraints
): boolean {
  if (pos.w < constraints.minW || pos.h < constraints.minH) {
    return false;
  }

  if (constraints.maxW !== undefined && pos.w > constraints.maxW) {
    return false;
  }

  if (constraints.maxH !== undefined && pos.h > constraints.maxH) {
    return false;
  }

  return true;
}

/**
 * Check if a position is valid (within grid and satisfies constraints).
 */
export function isValidPosition(
  pos: GridPosition,
  constraints: BlockConstraints,
  gridColumns: number = DEFAULT_GRID_COLUMNS
): boolean {
  return isWithinGrid(pos, gridColumns) && satisfiesConstraints(pos, constraints);
}

// -----------------------------------------------------------------------------
// Clamping
// -----------------------------------------------------------------------------

/**
 * Clamp a position to grid boundaries.
 * Does not modify size, only position.
 */
export function clampToGrid(
  pos: GridPosition,
  gridColumns: number = DEFAULT_GRID_COLUMNS
): GridPosition {
  let x = pos.x;
  let y = pos.y;
  const { w, h } = pos;

  // Ensure minimum position
  x = Math.max(0, x);
  y = Math.max(0, y);

  // Ensure fits within grid width
  if (x + w > gridColumns) {
    x = gridColumns - w;
  }

  // If still negative (block wider than grid), clamp x to 0
  x = Math.max(0, x);

  return { x, y, w, h };
}

/**
 * Clamp a position's size to block constraints.
 * Does not modify position, only size.
 */
export function clampToConstraints(
  pos: GridPosition,
  constraints: BlockConstraints
): GridPosition {
  const { x, y } = pos;
  let { w, h } = pos;

  // Clamp size
  w = Math.max(constraints.minW, w);
  h = Math.max(constraints.minH, h);

  if (constraints.maxW !== undefined) {
    w = Math.min(constraints.maxW, w);
  }

  if (constraints.maxH !== undefined) {
    h = Math.min(constraints.maxH, h);
  }

  return { x, y, w, h };
}

/**
 * Clamp a position to both grid boundaries and block constraints.
 * Returns the most valid position possible.
 *
 * Order of operations:
 * 1. Clamp size to block constraints (min/max)
 * 2. Clamp position to grid
 * 3. If block is still wider than grid, clamp width to grid
 */
export function clampPosition(
  pos: GridPosition,
  constraints: BlockConstraints,
  gridColumns: number = DEFAULT_GRID_COLUMNS
): GridPosition {
  // First clamp size to constraints
  let result = clampToConstraints(pos, constraints);

  // Then clamp to grid (this might need to adjust x if block is too wide)
  result = clampToGrid(result, gridColumns);

  // If block is still wider than grid, clamp width to grid
  // (this can happen if maxW > gridColumns or maxW is undefined)
  if (result.w > gridColumns) {
    result = { ...result, w: gridColumns };
  }

  return result;
}

// -----------------------------------------------------------------------------
// Default Constraints
// -----------------------------------------------------------------------------

/**
 * Create default constraints for a block type.
 */
export function createDefaultConstraints(
  minW: number,
  minH: number,
  options?: {
    maxW?: number;
    maxH?: number;
    allowedResizeDirections?: BlockConstraints["allowedResizeDirections"];
  }
): BlockConstraints {
  return {
    minW,
    minH,
    maxW: options?.maxW,
    maxH: options?.maxH,
    allowedResizeDirections: options?.allowedResizeDirections ?? [
      "north",
      "south",
      "east",
      "west",
    ],
  };
}

/**
 * Default constraints for card blocks.
 * Matches the existing card-block.tsx registration.
 */
export const CARD_CONSTRAINTS: BlockConstraints = createDefaultConstraints(6, 4);

/**
 * Default constraints for heading blocks.
 * Headings have fixed height and can only resize horizontally.
 */
export const HEADING_CONSTRAINTS: BlockConstraints = createDefaultConstraints(12, 2, {
  maxH: 2,
  allowedResizeDirections: ["east", "west"],
});

/**
 * Get default constraints for a block kind.
 */
export function getDefaultConstraints(kind: "heading" | "card"): BlockConstraints {
  return kind === "heading" ? HEADING_CONSTRAINTS : CARD_CONSTRAINTS;
}

// -----------------------------------------------------------------------------
// Block Helpers
// -----------------------------------------------------------------------------

/**
 * Create a constraints map from a list of blocks using default constraints.
 */
export function buildConstraintsMap(
  blocks: LayoutBlock[]
): Map<string, BlockConstraints> {
  const map = new Map<string, BlockConstraints>();

  for (const block of blocks) {
    map.set(block.id, getDefaultConstraints(block.kind));
  }

  return map;
}

/**
 * Get constraints for a block from a map, falling back to defaults.
 */
export function getConstraints(
  block: LayoutBlock,
  constraintsMap: Map<string, BlockConstraints>
): BlockConstraints {
  return constraintsMap.get(block.id) ?? getDefaultConstraints(block.kind);
}
