/**
 * Migration utilities for Layout V2
 *
 * Handles conversion between:
 * - Old format: { colStart, rowStart, colSpan, rowSpan } (1-indexed)
 * - New format: { x, y, w, h } (0-indexed)
 */

import type { GridPosition, LayoutBlock, LayoutBlockKind } from "./engine";

// -----------------------------------------------------------------------------
// Old Format Types (for migration)
// -----------------------------------------------------------------------------

/**
 * Old card layout format (1-indexed coordinates).
 */
type OldCardLayoutState = {
  colStart: number;
  rowStart: number;
  colSpan: number;
  rowSpan: number;
};

/**
 * Old block layout format (1-indexed coordinates).
 */
export type OldBlockLayoutState = OldCardLayoutState & {
  id: string;
  kind: LayoutBlockKind;
};

// -----------------------------------------------------------------------------
// Conversion Functions
// -----------------------------------------------------------------------------

/**
 * Convert old 1-indexed position to new 0-indexed GridPosition.
 *
 * Migration formula:
 * - x = colStart - 1
 * - y = rowStart - 1
 * - w = colSpan
 * - h = rowSpan
 */
export function toGridPosition(old: OldCardLayoutState): GridPosition {
  return {
    x: old.colStart - 1,
    y: old.rowStart - 1,
    w: old.colSpan,
    h: old.rowSpan,
  };
}

/**
 * Convert new 0-indexed GridPosition to old 1-indexed format.
 *
 * Reverse migration formula:
 * - colStart = x + 1
 * - rowStart = y + 1
 * - colSpan = w
 * - rowSpan = h
 */
export function toOldPosition(pos: GridPosition): OldCardLayoutState {
  return {
    colStart: pos.x + 1,
    rowStart: pos.y + 1,
    colSpan: pos.w,
    rowSpan: pos.h,
  };
}

/**
 * Convert old BlockLayoutState to new LayoutBlock format.
 */
export function migrateBlockLayout(old: OldBlockLayoutState): LayoutBlock {
  return {
    id: old.id,
    kind: old.kind,
    position: toGridPosition(old),
  };
}

/**
 * Convert new LayoutBlock to old BlockLayoutState format.
 */
export function toOldBlockLayout(block: LayoutBlock): OldBlockLayoutState {
  return {
    id: block.id,
    kind: block.kind,
    ...toOldPosition(block.position),
  };
}

/**
 * Migrate an array of old block layouts to new format.
 */
export function migrateBlockLayouts(oldLayouts: OldBlockLayoutState[]): LayoutBlock[] {
  return oldLayouts.map(migrateBlockLayout);
}

/**
 * Convert an array of new blocks to old format.
 */
export function toOldBlockLayouts(blocks: LayoutBlock[]): OldBlockLayoutState[] {
  return blocks.map(toOldBlockLayout);
}

// -----------------------------------------------------------------------------
// Validation
// -----------------------------------------------------------------------------

/**
 * Check if a value looks like the old block layout format.
 */
export function isOldBlockLayoutFormat(value: unknown): value is OldBlockLayoutState {
  if (!value || typeof value !== "object") return false;

  const obj = value as Record<string, unknown>;

  return (
    typeof obj.id === "string" &&
    (obj.kind === "heading" || obj.kind === "card") &&
    typeof obj.colStart === "number" &&
    typeof obj.rowStart === "number" &&
    typeof obj.colSpan === "number" &&
    typeof obj.rowSpan === "number"
  );
}

/**
 * Check if a value looks like the new LayoutBlock format.
 */
export function isNewBlockLayoutFormat(value: unknown): value is LayoutBlock {
  if (!value || typeof value !== "object") return false;

  const obj = value as Record<string, unknown>;

  if (typeof obj.id !== "string") return false;
  if (obj.kind !== "heading" && obj.kind !== "card") return false;
  if (!obj.position || typeof obj.position !== "object") return false;

  const pos = obj.position as Record<string, unknown>;

  return (
    typeof pos.x === "number" &&
    typeof pos.y === "number" &&
    typeof pos.w === "number" &&
    typeof pos.h === "number"
  );
}

/**
 * Check if an array contains old format blocks.
 */
export function isOldFormatArray(value: unknown): value is OldBlockLayoutState[] {
  if (!Array.isArray(value)) return false;
  if (value.length === 0) return false;

  return value.every(isOldBlockLayoutFormat);
}

/**
 * Check if an array contains new format blocks.
 */
export function isNewFormatArray(value: unknown): value is LayoutBlock[] {
  if (!Array.isArray(value)) return false;
  if (value.length === 0) return false;

  return value.every(isNewBlockLayoutFormat);
}

// -----------------------------------------------------------------------------
// Auto-Migration
// -----------------------------------------------------------------------------

/**
 * Normalize any block layout format to new LayoutBlock[].
 * Accepts either old or new format and returns new format.
 * Returns null if the format is unrecognized.
 */
export function normalizeBlockLayouts(value: unknown): LayoutBlock[] | null {
  if (isNewFormatArray(value)) {
    return value;
  }

  if (isOldFormatArray(value)) {
    return migrateBlockLayouts(value);
  }

  return null;
}
