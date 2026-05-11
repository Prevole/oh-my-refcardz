import { clamp } from "./layout-algorithms";
import type { BlockConstraints, ResizeHandleDirection } from "./block-types";

export type CardBounds = {
  colStart: number;
  rowStart: number;
  colSpan: number;
  rowSpan: number;
};

export type ResizeResult = CardBounds;

/**
 * Calculate the new card bounds after resizing in a given direction.
 *
 * @param origin - The original card bounds before resize started
 * @param deltaCols - The number of columns to move (positive = right, negative = left)
 * @param deltaRows - The number of rows to move (positive = down, negative = up)
 * @param direction - The resize handle direction
 * @param gridColumns - Total columns in the grid
 * @param constraints - Block-specific resize constraints
 * @returns The new card bounds after resize
 */
export function calculateResizeBounds(
  origin: CardBounds,
  deltaCols: number,
  deltaRows: number,
  direction: ResizeHandleDirection,
  gridColumns: number,
  constraints: BlockConstraints
): ResizeResult {
  let nextColStart = origin.colStart;
  let nextRowStart = origin.rowStart;
  let nextColSpan = origin.colSpan;
  let nextRowSpan = origin.rowSpan;

  const { minColSpan, maxColSpan, minRowSpan, maxRowSpan } = constraints;

  // East edge: increase width
  if (direction === "east" || direction === "north-east" || direction === "south-east") {
    const maxWidth = Math.min(maxColSpan, gridColumns - origin.colStart + 1);
    nextColSpan = clamp(origin.colSpan + deltaCols, minColSpan, maxWidth);
  }

  // South edge: increase height
  if (direction === "south" || direction === "south-east" || direction === "south-west") {
    nextRowSpan = clamp(origin.rowSpan + deltaRows, minRowSpan, maxRowSpan);
  }

  // West edge: decrease colStart, adjust width
  if (direction === "west" || direction === "north-west" || direction === "south-west") {
    const maxColStart = origin.colStart + origin.colSpan - minColSpan;
    nextColStart = clamp(origin.colStart + deltaCols, 1, maxColStart);
    const rawColSpan = origin.colSpan + (origin.colStart - nextColStart);
    nextColSpan = clamp(rawColSpan, minColSpan, Math.min(maxColSpan, gridColumns));
  }

  // North edge: decrease rowStart, adjust height
  if (direction === "north" || direction === "north-east" || direction === "north-west") {
    const maxRowStart = origin.rowStart + origin.rowSpan - minRowSpan;
    nextRowStart = clamp(origin.rowStart + deltaRows, 1, maxRowStart);
    const rawRowSpan = origin.rowSpan + (origin.rowStart - nextRowStart);
    nextRowSpan = clamp(rawRowSpan, minRowSpan, maxRowSpan);
  }

  return {
    colStart: nextColStart,
    rowStart: nextRowStart,
    colSpan: nextColSpan,
    rowSpan: nextRowSpan,
  };
}

/**
 * Check if bounds have changed.
 */
export function boundsEqual(a: CardBounds, b: CardBounds): boolean {
  return (
    a.colStart === b.colStart &&
    a.rowStart === b.rowStart &&
    a.colSpan === b.colSpan &&
    a.rowSpan === b.rowSpan
  );
}
