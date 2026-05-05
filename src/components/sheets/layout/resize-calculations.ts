import { clamp } from "./layout-algorithms";
import { MAX_ROW_SPAN } from "./layout-types";
import type { ResizeHandleDirection } from "./layout-types";

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
 * @returns The new card bounds after resize
 */
export function calculateResizeBounds(
  origin: CardBounds,
  deltaCols: number,
  deltaRows: number,
  direction: ResizeHandleDirection,
  gridColumns: number
): ResizeResult {
  let nextColStart = origin.colStart;
  let nextRowStart = origin.rowStart;
  let nextColSpan = origin.colSpan;
  let nextRowSpan = origin.rowSpan;

  // East edge: increase width
  if (direction === "east" || direction === "north-east" || direction === "south-east") {
    nextColSpan = clamp(origin.colSpan + deltaCols, 1, gridColumns - origin.colStart + 1);
  }

  // South edge: increase height
  if (direction === "south" || direction === "south-east" || direction === "south-west") {
    nextRowSpan = clamp(origin.rowSpan + deltaRows, 1, MAX_ROW_SPAN);
  }

  // West edge: decrease colStart, adjust width
  if (direction === "west" || direction === "north-west" || direction === "south-west") {
    const maxColStart = origin.colStart + origin.colSpan - 1;
    nextColStart = clamp(origin.colStart + deltaCols, 1, maxColStart);
    nextColSpan = clamp(origin.colSpan + (origin.colStart - nextColStart), 1, gridColumns);
  }

  // North edge: decrease rowStart, adjust height
  if (direction === "north" || direction === "north-east" || direction === "north-west") {
    const maxRowStart = origin.rowStart + origin.rowSpan - 1;
    nextRowStart = clamp(origin.rowStart + deltaRows, 1, maxRowStart);
    nextRowSpan = clamp(origin.rowSpan + (origin.rowStart - nextRowStart), 1, MAX_ROW_SPAN);
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
