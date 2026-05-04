import type { YamlCheatSheet } from "@/lib/yaml-cheatsheets";
import { GRID_COLUMNS } from "../sheet-grid";
import { MAX_ROW_SPAN, type SectionLayoutState } from "./layout-types";

export function buildStorageKey(sheetSlug: string): string {
  return `sheet-layout:${sheetSlug}`;
}

export function areLayoutsEqual(left: SectionLayoutState[], right: SectionLayoutState[]): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

/**
 * Validates that a parsed value from storage matches the expected structure
 * for the given sheet (correct number of sections and cards).
 */
export function isValidStoredLayout(value: unknown, sheet: YamlCheatSheet): value is SectionLayoutState[] {
  if (!Array.isArray(value) || value.length !== sheet.sections.length) return false;

  return value.every((sectionLayout: unknown, sectionIndex) => {
    if (!sectionLayout || typeof sectionLayout !== "object") return false;
    if (!("cards" in sectionLayout) || !Array.isArray(sectionLayout.cards)) return false;
    if (sectionLayout.cards.length !== sheet.sections[sectionIndex].cards.length) return false;

    return sectionLayout.cards.every((cardLayout: unknown) => {
      if (!cardLayout || typeof cardLayout !== "object") return false;
      if (
        !("colStart" in cardLayout) ||
        !("rowStart" in cardLayout) ||
        !("colSpan" in cardLayout) ||
        !("rowSpan" in cardLayout)
      ) {
        return false;
      }

      return (
        typeof cardLayout.colStart === "number" &&
        typeof cardLayout.rowStart === "number" &&
        typeof cardLayout.colSpan === "number" &&
        typeof cardLayout.rowSpan === "number" &&
        Number.isInteger(cardLayout.colStart) &&
        Number.isInteger(cardLayout.rowStart) &&
        Number.isInteger(cardLayout.colSpan) &&
        Number.isInteger(cardLayout.rowSpan) &&
        cardLayout.colStart >= 1 &&
        cardLayout.rowStart >= 1 &&
        cardLayout.colSpan >= 1 &&
        cardLayout.colSpan <= GRID_COLUMNS &&
        cardLayout.rowSpan >= 1 &&
        cardLayout.rowSpan <= MAX_ROW_SPAN
      );
    });
  });
}

export function mergeStoredLayouts(
  storedLayouts: SectionLayoutState[],
  defaultLayouts: SectionLayoutState[]
): SectionLayoutState[] {
  return defaultLayouts.map((defaultSection, sectionIndex) => ({
    cards: defaultSection.cards.map((defaultCard, cardIndex) => ({
      colStart: storedLayouts[sectionIndex].cards[cardIndex]?.colStart ?? defaultCard.colStart,
      rowStart: storedLayouts[sectionIndex].cards[cardIndex]?.rowStart ?? defaultCard.rowStart,
      colSpan: storedLayouts[sectionIndex].cards[cardIndex]?.colSpan ?? defaultCard.colSpan,
      rowSpan: storedLayouts[sectionIndex].cards[cardIndex]?.rowSpan ?? defaultCard.rowSpan,
    })),
  }));
}

export function parseStoredLayouts(
  raw: string | null,
  sheet: YamlCheatSheet,
  defaultSectionLayouts: SectionLayoutState[]
): SectionLayoutState[] | null {
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    return isValidStoredLayout(parsed, sheet) ? mergeStoredLayouts(parsed, defaultSectionLayouts) : null;
  } catch {
    return null;
  }
}
