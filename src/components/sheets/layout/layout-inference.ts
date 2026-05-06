import type { CheatSheetCard, YamlCheatSheet } from "@/lib/yaml-cheatsheets";
import { resolveSectionLayout } from "./layout-algorithms";
import type { SectionLayoutState } from "./layout-types";

export function inferCardColSpan(card: CheatSheetCard): number {
  const itemCount = card.items.length;
  const hasStructuredBlock = card.items.some((item) => item.type === "config" || item.type === "app settings");

  if (hasStructuredBlock) return 8;
  if (itemCount >= 5) return 8;
  if (itemCount >= 3) return 6;
  return 4;
}

export function inferCardRowSpan(card: CheatSheetCard): number {
  const itemCount = card.items.length;
  const hasStructuredBlock = card.items.some((item) => item.type === "config" || item.type === "app settings");
  const hasCommand = card.items.some((item) => item.type === "command");

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
