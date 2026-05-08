import type { CheatSheetCard, CheatSheetItem, YamlCheatSheet } from "@/lib/yaml-cheatsheets";
import { resolveSectionLayout } from "./layout-algorithms";
import type { SectionLayoutState } from "./layout-types";

const GRID_SCALE_FACTOR = 3;

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

export function buildDefaultSectionLayouts(sheet: YamlCheatSheet): SectionLayoutState[] {
  return sheet.sections.map((section) => {
    const cards = section.cards.map((card) => ({
      colStart: 1,
      rowStart: 1,
      colSpan: inferCardColSpan(card),
      rowSpan: inferCardRowSpan(card),
    }));

    return {
      cards: resolveSectionLayout(cards),
    };
  });
}
