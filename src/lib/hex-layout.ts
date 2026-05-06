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

export function buildHexRows<T>(items: T[], columns: number): HexRows<T> {
  const evenCount = Math.max(1, columns);
  const oddCount = Math.max(1, columns - 1);
  const rows: HexRows<T> = [];

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

export function getHexRowWidth(columnCount: number, hexWidth: number): number {
  const { cardInset, hexCardWidth, horizontalStep } = getHexMetrics(hexWidth);
  return cardInset + hexCardWidth + Math.max(0, columnCount - 1) * horizontalStep;
}

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

export function getMaxColumnsForWidth(width: number, hexWidth: number): number {
  let maxColumns = 1;

  while (getHexRowWidth(maxColumns + 1, hexWidth) <= width) {
    maxColumns += 1;
  }

  return maxColumns;
}

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

    /* v8 ignore next -- defensive: fallback to first item when column out of bounds */
    return nextRow[colIndex] ?? nextRow[0] ?? null;
  }

  return null;
}

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

  for (const nextRowIndex of [preferredRowIndex]) {
    const nextRow = rows[nextRowIndex];
    if (!nextRow || targetCol < 0 || targetCol >= nextRow.length) {
      continue;
    }

    /* v8 ignore next -- defensive: null coalescing for sparse rows */
    return nextRow[targetCol] ?? null;
  }

  /* v8 ignore start -- defensive: fallback when preferred row unavailable */
  if (sameRowCol >= 0 && sameRowCol < currentRow.length) {
    return currentRow[sameRowCol] ?? null;
  }

  for (const nextRowIndex of [fallbackRowIndex]) {
    const nextRow = rows[nextRowIndex];
    if (!nextRow || targetCol < 0 || targetCol >= nextRow.length) {
      continue;
    }

    return nextRow[targetCol] ?? null;
  }
  /* v8 ignore stop */

  return null;
}
