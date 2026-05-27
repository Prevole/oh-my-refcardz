import {
  getRenderableBlocks,
  migrateSectionLayoutsToBlockLayouts,
  type SavedSectionLayout,
  type YamlCheatSheet,
} from "@/lib/cheatsheet-shared";
import { GRID_COLUMNS } from "../sheet-grid";
import { MAX_ROW_SPAN, type BlockLayoutState, type CardLayoutState } from "./layout-types";

const STORAGE_VERSION = 3;

export function buildStorageKey(sheetSlug: string): string {
  return `sheet-layout:${sheetSlug}`;
}

export function serializeStoredLayouts(layouts: BlockLayoutState[]): string {
  return JSON.stringify({ version: STORAGE_VERSION, blocks: layouts });
}

export function areLayoutsEqual(left: BlockLayoutState[], right: BlockLayoutState[]): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function isValidLayout(
  value: unknown,
  sheet: YamlCheatSheet,
  maxColumns: number,
  maxRowSpan: number
): value is BlockLayoutState[] {
  const renderableBlocks = getRenderableBlocks(sheet);

  if (!Array.isArray(value) || value.length !== renderableBlocks.length) return false;

  const expectedById = new Map(renderableBlocks.map((block) => [block.id, block.kind]));

  return value.every((blockLayout: unknown) => {
    if (!isValidBlockLayoutValue(blockLayout, maxColumns, maxRowSpan)) {
      return false;
    }

    return expectedById.get(blockLayout.id) === blockLayout.kind;
  });
}

/**
 * Validates that a parsed value from storage matches the expected structure
 * for the given sheet (correct number of sections and cards).
 */
export function isValidStoredLayout(value: unknown, sheet: YamlCheatSheet): value is BlockLayoutState[] {
  return isValidLayout(value, sheet, GRID_COLUMNS, MAX_ROW_SPAN);
}

function isValidCardLayoutValue(
  value: unknown,
  maxColumns: number = GRID_COLUMNS,
  maxRowSpan: number = MAX_ROW_SPAN
): value is CardLayoutState {
  if (!value || typeof value !== "object") return false;
  if (
    !("colStart" in value) ||
    !("rowStart" in value) ||
    !("colSpan" in value) ||
    !("rowSpan" in value)
  ) {
    return false;
  }

  return (
    typeof value.colStart === "number" &&
    typeof value.rowStart === "number" &&
    typeof value.colSpan === "number" &&
    typeof value.rowSpan === "number" &&
    Number.isInteger(value.colStart) &&
    Number.isInteger(value.rowStart) &&
    Number.isInteger(value.colSpan) &&
    Number.isInteger(value.rowSpan) &&
    value.colStart >= 1 &&
    value.rowStart >= 1 &&
    value.colSpan >= 1 &&
    value.colSpan <= maxColumns &&
    value.rowSpan >= 1 &&
    value.rowSpan <= maxRowSpan
  );
}

function isValidBlockLayoutValue(
  value: unknown,
  maxColumns: number = GRID_COLUMNS,
  maxRowSpan: number = MAX_ROW_SPAN
): value is BlockLayoutState {
  if (!value || typeof value !== "object") return false;
  if (!("id" in value) || !("kind" in value)) return false;

  return (
    typeof value.id === "string" &&
    (value.kind === "heading" || value.kind === "card") &&
    isValidCardLayoutValue(value, maxColumns, maxRowSpan)
  );
}

export function mergeStoredLayouts(
  storedLayouts: unknown,
  defaultLayouts: BlockLayoutState[],
  maxColumns: number = GRID_COLUMNS,
  maxRowSpan: number = MAX_ROW_SPAN
): BlockLayoutState[] {
  const storedLayoutMap = new Map(
    Array.isArray(storedLayouts)
      ? (storedLayouts as unknown[])
          .filter((layout) => isValidBlockLayoutValue(layout, maxColumns, maxRowSpan))
          .map((layout) => [layout.id, layout])
      : []
  );

  return defaultLayouts.map((defaultLayout) => {
    const storedLayout = storedLayoutMap.get(defaultLayout.id);

    if (!storedLayout || storedLayout.kind !== defaultLayout.kind) {
      return defaultLayout;
    }

    return { ...defaultLayout, ...storedLayout };
  });
}

export function parseStoredLayouts(
  raw: string | null,
  sheet: YamlCheatSheet,
  defaultBlockLayouts: BlockLayoutState[]
): BlockLayoutState[] | null {
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);

    if (
      parsed &&
      typeof parsed === "object" &&
      "version" in parsed &&
      parsed.version === STORAGE_VERSION &&
      "blocks" in parsed &&
      Array.isArray(parsed.blocks)
    ) {
      return mergeStoredLayouts(parsed.blocks, defaultBlockLayouts);
    }

    if (
      parsed &&
      typeof parsed === "object" &&
      "version" in parsed &&
      parsed.version === 2 &&
      "sections" in parsed &&
      Array.isArray(parsed.sections)
    ) {
      const migratedBlocks = migrateSectionLayoutsToBlockLayouts(sheet, parsed.sections as SavedSectionLayout[]);
      return mergeStoredLayouts(migratedBlocks, defaultBlockLayouts);
    }

    return null;
  } catch {
    return null;
  }
}
