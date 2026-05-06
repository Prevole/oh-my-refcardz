import type { CheatSheetCard, CheatSheetItem, YamlCheatSheet } from "@/lib/yaml-cheatsheets";
import { resolveSectionLayout } from "./layout-algorithms";
import type { SectionLayoutState } from "./layout-types";

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

  if (hasStructuredBlock) return 8;
  if (itemCount >= 5) return 8;
  if (itemCount >= 3) return 6;
  return 4;
}

export function inferCardRowSpan(card: CheatSheetCard): number {
  const itemCount = card.items.length;
  const hasStructuredBlock = card.items.some((item) =>
    hasEntryType(item, ["settings", "content"])
  );
  const hasCommand = card.items.some((item) =>
    hasEntryType(item, ["command"])
  );

  if (hasStructuredBlock) return 8;
  if (itemCount >= 5) return 8;
  if (hasCommand && itemCount >= 3) return 6;
  if (itemCount >= 3) return 5;
  return 4;
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
