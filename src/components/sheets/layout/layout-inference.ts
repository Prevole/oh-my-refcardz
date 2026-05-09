import { getRenderableBlocks, type CheatSheetCard, type CheatSheetItem, type YamlCheatSheet } from "@/lib/cheatsheet-shared";
import { resolveBlockLayout } from "./layout-algorithms";
import type { BlockLayoutState } from "./layout-types";

const GRID_SCALE_FACTOR = 3;
const HEADING_ROW_SPAN = 2;

function hasEntryType(item: CheatSheetItem, types: string[]): boolean {
  return item.entries.some((entry) =>
    types.some((type) => type in entry)
  );
}

export function inferCardColSpan(card: CheatSheetCard): number {
  const itemCount = card.items.length;
  const hasStructuredBlock = card.items.some((item) =>
    hasEntryType(item, ["settings", "content"])
  );

  if (hasStructuredBlock) return 8 * GRID_SCALE_FACTOR;
  if (itemCount >= 5) return 8 * GRID_SCALE_FACTOR;
  if (itemCount >= 3) return 6 * GRID_SCALE_FACTOR;
  return 4 * GRID_SCALE_FACTOR;
}

export function inferCardRowSpan(card: CheatSheetCard): number {
  const itemCount = card.items.length;
  const hasStructuredBlock = card.items.some((item) =>
    hasEntryType(item, ["settings", "content"])
  );
  const hasCommand = card.items.some((item) =>
    hasEntryType(item, ["command"])
  );

  if (hasStructuredBlock) return 8 * GRID_SCALE_FACTOR;
  if (itemCount >= 5) return 8 * GRID_SCALE_FACTOR;
  if (hasCommand && itemCount >= 3) return 6 * GRID_SCALE_FACTOR;
  if (itemCount >= 3) return 5 * GRID_SCALE_FACTOR;
  return 4 * GRID_SCALE_FACTOR;
}

export function buildDefaultBlockLayouts(sheet: YamlCheatSheet): BlockLayoutState[] {
  const blocks = getRenderableBlocks(sheet).map<BlockLayoutState>((block) => {
    if (block.kind === "heading") {
      return {
        id: block.id,
        kind: "heading",
        colStart: 1,
        rowStart: 1,
        colSpan: 36,
        rowSpan: HEADING_ROW_SPAN,
      };
    }

    return {
      id: block.id,
      kind: "card",
      colStart: 1,
      rowStart: 1,
      colSpan: inferCardColSpan(block),
      rowSpan: inferCardRowSpan(block),
    };
  });

  return resolveBlockLayout(blocks);
}
