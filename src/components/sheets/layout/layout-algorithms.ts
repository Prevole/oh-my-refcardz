import { GRID_COLUMNS, GRID_GAP_PX } from "../sheet-grid";
import { MAX_ROW_SPAN, type BlockLayoutState } from "./layout-types";

type GridPlacement = {
  colStart: number;
  rowStart: number;
  colSpan: number;
  rowSpan: number;
};

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

export function hasCollision(occupied: Set<string>, card: GridPlacement): boolean {
  for (let row = card.rowStart; row < card.rowStart + card.rowSpan; row++) {
    for (let col = card.colStart; col < card.colStart + card.colSpan; col++) {
      if (occupied.has(`${col}:${row}`)) {
        return true;
      }
    }
  }

  return false;
}

export function markOccupied(occupied: Set<string>, card: GridPlacement): void {
  for (let row = card.rowStart; row < card.rowStart + card.rowSpan; row++) {
    for (let col = card.colStart; col < card.colStart + card.colSpan; col++) {
      occupied.add(`${col}:${row}`);
    }
  }
}

export function clampCardLayoutToGrid(card: GridPlacement): GridPlacement {
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

export function placeCardAtNearestSlot(card: GridPlacement, occupied: Set<string>): GridPlacement {
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

export function resolveBlockLayout(
  blocks: BlockLayoutState[],
  pinnedBlockId?: string,
  pinnedLayout?: GridPlacement
): BlockLayoutState[] {
  const nextBlocks = blocks.map((block) => ({ ...block }));
  const occupied = new Set<string>();
  const pinnedBlock = pinnedBlockId ? nextBlocks.find((block) => block.id === pinnedBlockId) : null;

  // Headings keep their position during card reflow so card editing does not
  // unexpectedly rewrite the visual structure and anchor targets.
  for (let index = 0; index < nextBlocks.length; index++) {
    const block = nextBlocks[index];
    if (block.id === pinnedBlockId) continue;
    if (block.kind !== "heading") continue;

    const placedHeading = clampCardLayoutToGrid(block);
    nextBlocks[index] = { ...block, ...placedHeading };
    markOccupied(occupied, placedHeading);
  }

  if (pinnedBlockId && pinnedLayout) {
    const pinned = clampCardLayoutToGrid(pinnedLayout);
    const pinnedIndex = nextBlocks.findIndex((block) => block.id === pinnedBlockId);

    if (pinnedIndex !== -1) {
      const resolvedPinned =
        pinnedBlock?.kind === "heading" || !hasCollision(occupied, pinned)
          ? pinned
          : placeCardAtNearestSlot(pinned, occupied);

      nextBlocks[pinnedIndex] = { ...nextBlocks[pinnedIndex], ...resolvedPinned };
      markOccupied(occupied, resolvedPinned);
    }
  }

  for (let index = 0; index < nextBlocks.length; index++) {
    if (nextBlocks[index].id === pinnedBlockId) continue;
    if (nextBlocks[index].kind === "heading") continue;

    const preferred = clampCardLayoutToGrid(nextBlocks[index]);
    const placed = placeCardAtNearestSlot(preferred, occupied);
    nextBlocks[index] = { ...nextBlocks[index], ...placed };
    markOccupied(occupied, placed);
  }

  return nextBlocks;
}
