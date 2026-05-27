import {
  migrateSectionLayoutsToBlockLayouts,
  type SavedSectionLayout,
  type YamlCheatSheet,
} from "@/lib/cheatsheet-shared";
import { reconcileBlockLayouts } from "@/lib/layout/blocks";
import { type BlockLayoutState } from "./layout-types";

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

/**
 * Merges stored layouts with defaults. Stored entries are reconciled
 * against the current block-type constraints (clamp sizes, drop unknown
 * kinds, drop malformed entries). Surviving entries override the
 * matching default; missing or rejected entries fall back to the default.
 *
 * Kind mismatch between stored and default for the same id falls back
 * to the default: an id that used to be a heading and is now a card
 * cannot inherit the heading's geometry.
 */
export function mergeStoredLayouts(
  storedLayouts: unknown,
  defaultLayouts: BlockLayoutState[]
): BlockLayoutState[] {
  const reconciled = reconcileBlockLayouts(storedLayouts);
  const storedLayoutMap = new Map(reconciled.blocks.map((layout) => [layout.id, layout]));

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
