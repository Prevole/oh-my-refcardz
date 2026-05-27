import { getRenderableBlocks, type CheatSheetCard, type CheatSheetItem, type YamlCheatSheet } from "@/lib/cheatsheet-shared";
import { getBlockConstraints } from "@/lib/layout/blocks";
import { resolveBlockLayout } from "./layout-algorithms";
import type { BlockLayoutState } from "./layout-types";
import { GRID_COLUMNS } from "../sheet-grid";

const fractionOfGrid = (numerator: number, denominator: number) =>
  Math.round((GRID_COLUMNS * numerator) / denominator);

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

  if (hasStructuredBlock) return fractionOfGrid(8, 12);
  if (itemCount >= 5) return fractionOfGrid(8, 12);
  if (itemCount >= 3) return fractionOfGrid(6, 12);
  return fractionOfGrid(4, 12);
}

export function inferCardRowSpan(card: CheatSheetCard): number {
  const itemCount = card.items.length;
  const hasStructuredBlock = card.items.some((item) =>
    hasEntryType(item, ["settings", "content"])
  );
  const hasCommand = card.items.some((item) =>
    hasEntryType(item, ["command"])
  );

  if (hasStructuredBlock) return fractionOfGrid(8, 12);
  if (itemCount >= 5) return fractionOfGrid(8, 12);
  if (hasCommand && itemCount >= 3) return fractionOfGrid(6, 12);
  if (itemCount >= 3) return fractionOfGrid(5, 12);
  return fractionOfGrid(4, 12);
}

export function buildDefaultBlockLayouts(sheet: YamlCheatSheet): BlockLayoutState[] {
  const headingRowSpan = getBlockConstraints("heading").minRowSpan;
  const blocks = getRenderableBlocks(sheet).map<BlockLayoutState>((block) => {
    if (block.kind === "heading") {
      return {
        id: block.id,
        kind: "heading",
        colStart: 1,
        rowStart: 1,
        colSpan: GRID_COLUMNS,
        rowSpan: headingRowSpan,
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
