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

/**
 * Resolves block layouts by placing blocks without collisions.
 *
 * Two modes:
 * - Initial layout (no pinnedBlockId): All blocks are placed sequentially in
 *   document order. Headings define section boundaries - cards are placed after
 *   their preceding heading, respecting document structure.
 * - Reflow (pinnedBlockId provided): Headings keep their position to preserve
 *   visual structure; only cards are reflowed around the pinned block.
 */
export function resolveBlockLayout(
  blocks: BlockLayoutState[],
  pinnedBlockId?: string,
  pinnedLayout?: GridPlacement
): BlockLayoutState[] {
  const nextBlocks = blocks.map((block) => ({ ...block }));
  const occupied = new Set<string>();
  const isInitialLayout = !pinnedBlockId;

  // Initial layout mode: place all blocks sequentially in document order
  // respecting section structure (cards stay under their heading)
  if (isInitialLayout) {
    // sectionFloor: the row where the current section starts (cards search from here)
    // sectionCeiling: the highest row reached in the current section (next heading starts here)
    let sectionFloor = 1;
    let sectionCeiling = 1;

    for (let index = 0; index < nextBlocks.length; index++) {
      const block = nextBlocks[index];
      const preferred = clampCardLayoutToGrid(block);

      if (block.kind === "heading") {
        // Headings start a new section at the current ceiling
        const headingWithRow = { ...preferred, colStart: 1, rowStart: sectionCeiling };
        const placed = placeCardAtNearestSlot(headingWithRow, occupied);
        nextBlocks[index] = { ...block, ...placed };
        markOccupied(occupied, placed);
        // New section starts after this heading
        sectionFloor = placed.rowStart + placed.rowSpan;
        sectionCeiling = sectionFloor;
      } else {
        // Cards are placed starting from the section floor
        const cardWithSectionStart = { ...preferred, rowStart: sectionFloor };
        const placed = placeCardAtNearestSlot(cardWithSectionStart, occupied);
        nextBlocks[index] = { ...block, ...placed };
        markOccupied(occupied, placed);
        // Update section ceiling if this card extends beyond it
        const cardEndRow = placed.rowStart + placed.rowSpan;
        if (cardEndRow > sectionCeiling) {
          sectionCeiling = cardEndRow;
        }
      }
    }
    return nextBlocks;
  }

  // Reflow mode: headings keep their position, cards are reflowed
  const pinnedBlock = nextBlocks.find((block) => block.id === pinnedBlockId);

  // First pass: place headings (they keep their position during reflow)
  for (let index = 0; index < nextBlocks.length; index++) {
    const block = nextBlocks[index];
    if (block.id === pinnedBlockId) continue;
    if (block.kind !== "heading") continue;

    const placedHeading = clampCardLayoutToGrid(block);
    nextBlocks[index] = { ...block, ...placedHeading };
    markOccupied(occupied, placedHeading);
  }

  // Second pass: place the pinned block
  if (pinnedLayout) {
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

  // Third pass: place remaining cards
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
