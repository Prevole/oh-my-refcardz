import type { CheatSheetMeta } from "@/lib/yaml-cheatsheets";
import {
  HEX_CARD_RATIO,
  HEX_SHAPE_HEIGHT_RATIO,
  HEX_VERTICAL_GAP_RATIO,
} from "@/lib/constants";

export type HexRows<T = CheatSheetMeta> = T[][];

export type HexMetrics = {
  hexCardWidth: number;
  hexCardHeight: number;
  hexShapeHeight: number;
  cardInset: number;
  horizontalStep: number;
  oddRowOffset: number;
  verticalStep: number;
};

export type HexBoardDimensions = {
  width: number;
  height: number;
};

/**
 * Calculate hex grid metrics based on cell width.
 * All dimensions are derived from the base hexWidth to maintain proportions.
 */
export function getHexMetrics(hexWidth: number): HexMetrics {
  const hexCardWidth = hexWidth * HEX_CARD_RATIO;
  const hexCardHeight = hexWidth * HEX_CARD_RATIO;
  const hexShapeHeight = hexCardHeight * HEX_SHAPE_HEIGHT_RATIO;
  const hexGap = hexWidth - hexCardWidth;
  const cardInset = hexGap / 2;
  const horizontalStep = hexCardWidth * 1.5 + hexGap;

  return {
    hexCardWidth,
    hexCardHeight,
    hexShapeHeight,
    cardInset,
    horizontalStep,
    oddRowOffset: horizontalStep / 2,
    verticalStep: hexShapeHeight / 2 + hexGap * HEX_VERTICAL_GAP_RATIO,
  };
}

/**
 * Build honeycomb rows from a flat list of items.
 * Even rows have `columns` items, odd rows have `columns - 1` items.
 * Special case: if items fit in 2 rows, distribute them evenly.
 */
export function buildHexRows<T>(items: T[], columns: number): HexRows<T> {
  const evenCount = Math.max(1, columns);
  const oddCount = Math.max(1, columns - 1);
  const rows: HexRows<T> = [];

  // Special case: distribute items across 2 rows if they fit
  if (items.length > 1 && items.length <= evenCount) {
    const firstRowCount = Math.min(evenCount, Math.ceil(items.length / 2));
    return [items.slice(0, firstRowCount), items.slice(firstRowCount)].filter(
      (row) => row.length > 0
    );
  }

  let cursor = 0;
  let rowIndex = 0;

  while (cursor < items.length) {
    const targetCount = rowIndex % 2 === 0 ? evenCount : oddCount;
    const count = Math.min(targetCount, items.length - cursor);
    rows.push(items.slice(cursor, cursor + count));
    cursor += count;
    rowIndex += 1;
  }

  return rows;
}

/**
 * Calculate the width of a single hex row.
 */
export function getHexRowWidth(columnCount: number, hexWidth: number): number {
  const { cardInset, hexCardWidth, horizontalStep } = getHexMetrics(hexWidth);
  return cardInset + hexCardWidth + Math.max(0, columnCount - 1) * horizontalStep;
}

/**
 * Calculate the dimensions of the entire hex board.
 */
export function getHexBoardDimensions<T>(
  rows: HexRows<T>,
  hexWidth: number
): HexBoardDimensions {
  const { oddRowOffset, verticalStep } = getHexMetrics(hexWidth);

  const width = rows.reduce((maxWidth, row, rowIndex) => {
    const rowWidth =
      getHexRowWidth(row.length, hexWidth) +
      (rowIndex % 2 === 1 ? oddRowOffset : 0);
    return Math.max(maxWidth, rowWidth);
  }, 0);

  const height =
    rows.length > 0 ? (rows.length - 1) * verticalStep + hexWidth : hexWidth;

  return { width, height };
}

/**
 * Calculate the maximum number of columns that fit in a given width.
 */
export function getMaxColumnsForWidth(width: number, hexWidth: number): number {
  let maxColumns = 1;

  while (getHexRowWidth(maxColumns + 1, hexWidth) <= width) {
    maxColumns += 1;
  }

  return maxColumns;
}

/**
 * Calculate position for each item in the hex grid.
 * Returns colIndex (position in row) and visualColIndex (interleaved position for color assignment).
 * visualColIndex uses interleaving: even rows get 0, 2, 4... and odd rows get 1, 3, 5...
 */
export function getPositionedItems<T>(
  rows: HexRows<T>,
  hexWidth: number
): Array<{ item: T; left: number; top: number; colIndex: number; visualColIndex: number }> {
  const { horizontalStep, oddRowOffset, verticalStep } = getHexMetrics(hexWidth);

  return rows.flatMap((row, rowIndex) =>
    row.map((item, colIndex) => ({
      item,
      left: colIndex * horizontalStep + (rowIndex % 2 === 1 ? oddRowOffset : 0),
      top: rowIndex * verticalStep,
      colIndex,
      visualColIndex: colIndex * 2 + (rowIndex % 2),
    }))
  );
}

// ---------------------------------------------------------------------------
// Navigation helpers for honeycomb grid
// ---------------------------------------------------------------------------

/**
 * Find the target item when moving vertically (up/down).
 * Navigates to the same parity row (even→even, odd→odd).
 */
export function getVerticalTarget<T>(
  rows: HexRows<T>,
  rowParityByIndex: number[],
  rowIndex: number,
  colIndex: number,
  direction: "up" | "down"
): T | null {
  const rowStep = direction === "down" ? 1 : -1;
  const currentParity = rowParityByIndex[rowIndex];

  for (
    let nextRowIndex = rowIndex + rowStep;
    nextRowIndex >= 0 && nextRowIndex < rows.length;
    nextRowIndex += rowStep
  ) {
    const nextRow = rows[nextRowIndex];
    if (nextRow.length === 0 || rowParityByIndex[nextRowIndex] !== currentParity) {
      continue;
    }

    return nextRow[colIndex] ?? nextRow[0] ?? null;
  }

  return null;
}

/**
 * Find the target item when moving horizontally (left/right).
 * In a honeycomb, left/right movement often means moving diagonally to adjacent rows.
 */
export function getHorizontalTarget<T>(
  rows: HexRows<T>,
  isOddRow: boolean,
  rowIndex: number,
  colIndex: number,
  direction: "left" | "right"
): T | null {
  const targetCol =
    direction === "right"
      ? isOddRow
        ? colIndex + 1
        : colIndex
      : isOddRow
        ? colIndex
        : colIndex - 1;

  const preferredRowIndex = isOddRow ? rowIndex - 1 : rowIndex + 1;
  const fallbackRowIndex = isOddRow ? rowIndex + 1 : rowIndex - 1;
  const currentRow = rows[rowIndex];
  const sameRowCol = direction === "right" ? colIndex + 1 : colIndex - 1;

  // Try preferred adjacent row first
  for (const nextRowIndex of [preferredRowIndex]) {
    const nextRow = rows[nextRowIndex];
    if (!nextRow || targetCol < 0 || targetCol >= nextRow.length) {
      continue;
    }

    return nextRow[targetCol] ?? null;
  }

  // Try same row
  if (sameRowCol >= 0 && sameRowCol < currentRow.length) {
    return currentRow[sameRowCol] ?? null;
  }

  // Try fallback adjacent row
  for (const nextRowIndex of [fallbackRowIndex]) {
    const nextRow = rows[nextRowIndex];
    if (!nextRow || targetCol < 0 || targetCol >= nextRow.length) {
      continue;
    }

    return nextRow[targetCol] ?? null;
  }

  return null;
}
