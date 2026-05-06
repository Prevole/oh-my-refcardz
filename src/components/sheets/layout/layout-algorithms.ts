import { GRID_COLUMNS, GRID_GAP_PX } from "../sheet-grid";
import { MAX_ROW_SPAN, type CardLayoutState } from "./layout-types";

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function pointerToGridPosition(
  clientX: number,
  clientY: number,
  gridRect: DOMRect,
  unitSize: number,
  colSpan: number
): { colStart: number; rowStart: number } {
  const pitch = unitSize + GRID_GAP_PX;
  const rawCol = 1 + Math.floor((clientX - gridRect.left) / pitch);
  const rawRow = 1 + Math.floor((clientY - gridRect.top) / pitch);

  return {
    colStart: clamp(rawCol, 1, GRID_COLUMNS - colSpan + 1),
    rowStart: Math.max(1, rawRow),
  };
}

export function hasCollision(occupied: Set<string>, card: CardLayoutState): boolean {
  for (let row = card.rowStart; row < card.rowStart + card.rowSpan; row++) {
    for (let col = card.colStart; col < card.colStart + card.colSpan; col++) {
      if (occupied.has(`${col}:${row}`)) {
        return true;
      }
    }
  }

  return false;
}

export function markOccupied(occupied: Set<string>, card: CardLayoutState): void {
  for (let row = card.rowStart; row < card.rowStart + card.rowSpan; row++) {
    for (let col = card.colStart; col < card.colStart + card.colSpan; col++) {
      occupied.add(`${col}:${row}`);
    }
  }
}

export function clampCardLayoutToGrid(card: CardLayoutState): CardLayoutState {
  const colSpan = clamp(card.colSpan, 1, GRID_COLUMNS);
  const rowSpan = clamp(card.rowSpan, 1, MAX_ROW_SPAN);

  return {
    colSpan,
    rowSpan,
    colStart: clamp(card.colStart, 1, GRID_COLUMNS - colSpan + 1),
    rowStart: Math.max(1, card.rowStart),
  };
}

const MAX_SEARCH_ROWS = 200;

export function placeCardAtNearestSlot(card: CardLayoutState, occupied: Set<string>): CardLayoutState {
  const startCol = clamp(card.colStart, 1, GRID_COLUMNS - card.colSpan + 1);
  const startRow = Math.max(1, card.rowStart);

  for (let row = startRow; row < startRow + MAX_SEARCH_ROWS; row++) {
    for (let col = row === startRow ? startCol : 1; col <= GRID_COLUMNS - card.colSpan + 1; col++) {
      const candidate = { ...card, colStart: col, rowStart: row };
      if (!hasCollision(occupied, candidate)) {
        return candidate;
      }
    }
  }

  /* v8 ignore next -- fallback: no free position found within MAX_SEARCH_ROWS, place at origin */
  return { ...card, colStart: 1, rowStart: startRow };
}

export function resolveSectionLayout(
  cards: CardLayoutState[],
  pinnedIndex?: number,
  pinnedLayout?: CardLayoutState
): CardLayoutState[] {
  const nextCards = cards.map((card) => ({ ...card }));
  const occupied = new Set<string>();

  if (pinnedIndex !== undefined && pinnedLayout) {
    const pinned = clampCardLayoutToGrid(pinnedLayout);
    nextCards[pinnedIndex] = pinned;
    markOccupied(occupied, pinned);
  }

  for (let index = 0; index < nextCards.length; index++) {
    if (index === pinnedIndex) continue;

    const preferred = clampCardLayoutToGrid(nextCards[index]);
    const placed = placeCardAtNearestSlot(preferred, occupied);
    nextCards[index] = placed;
    markOccupied(occupied, placed);
  }

  return nextCards;
}
