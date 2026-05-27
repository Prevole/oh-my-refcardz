import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  buildStorageKey,
  areLayoutsEqual,
  mergeStoredLayouts,
  parseStoredLayouts,
  serializeStoredLayouts,
} from "./layout-persistence";
import type { YamlCheatSheet } from "@/lib/cheatsheet-shared";
import type { BlockLayoutState } from "./layout-types";

let warnSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  warnSpy.mockRestore();
});

function createMockSheet(sectionCardCounts: number[]): YamlCheatSheet {
  return {
    title: "Test Sheet",
    summary: "Test summary",
    color: "#FF0000",
    blocks: sectionCardCounts.flatMap((cardCount, i) => [
      {
        heading: {
          id: `section-${i + 1}`,
          title: `Section ${i + 1}`,
        },
      },
      ...Array.from({ length: cardCount }, (_, j) => ({
        card: {
          id: `card-${i + 1}-${j + 1}`,
          title: `Card ${j + 1}`,
          items: [],
        },
      })),
    ]),
  };
}

function createValidLayout(sectionCardCounts: number[]): BlockLayoutState[] {
  const layouts: BlockLayoutState[] = [];
  let rowStart = 1;

  sectionCardCounts.forEach((cardCount, sectionIndex) => {
    layouts.push({
      id: `section-${sectionIndex + 1}`,
      kind: "heading",
      colStart: 1,
      rowStart,
      colSpan: 64,
      rowSpan: 2,
    });

    rowStart += 2;

    Array.from({ length: cardCount }, (_, cardIndex) => {
      layouts.push({
        id: `card-${sectionIndex + 1}-${cardIndex + 1}`,
        kind: "card",
        colStart: 1 + (cardIndex % 3) * 12,
        rowStart: rowStart + Math.floor(cardIndex / 3) * 6,
        colSpan: 12,
        rowSpan: 6,
      });
    });

    rowStart += Math.max(1, Math.ceil(cardCount / 3)) * 6;
  });

  return layouts;
}

describe("buildStorageKey", () => {
  it("creates storage key with prefix", () => {
    expect(buildStorageKey("git")).toBe("sheet-layout:git");
  });
});

describe("areLayoutsEqual", () => {
  it("returns true for identical layouts", () => {
    const layout = createValidLayout([2, 3]);
    expect(areLayoutsEqual(layout, layout)).toBe(true);
  });

  it("returns false when block position differs", () => {
    const layout1 = createValidLayout([2]);
    const layout2 = createValidLayout([2]);
    layout2[1].colStart = 5;
    expect(areLayoutsEqual(layout1, layout2)).toBe(false);
  });
});

describe("mergeStoredLayouts", () => {
  it("uses stored values when present", () => {
    const stored: BlockLayoutState[] = [
      { id: "section-1", kind: "heading", colStart: 1, rowStart: 1, colSpan: 64, rowSpan: 2 },
      { id: "card-1-1", kind: "card", colStart: 5, rowStart: 3, colSpan: 6, rowSpan: 4 },
    ];
    const defaults = createValidLayout([1]);

    const result = mergeStoredLayouts(stored, defaults);
    expect(result[1]).toMatchObject({ colStart: 5, rowStart: 3, colSpan: 6, rowSpan: 4 });
  });

  it("uses default values when stored block is missing", () => {
    const defaults = createValidLayout([1]);
    const result = mergeStoredLayouts([], defaults);
    expect(result).toEqual(defaults);
  });

  it("reconciles drifted spans from stored entries (clamps to constraints)", () => {
    const defaults = createValidLayout([1]);
    const stored: unknown[] = [
      { id: "section-1", kind: "heading", colStart: 1, rowStart: 1, colSpan: 100, rowSpan: 2 },
      { id: "card-1-1", kind: "card", colStart: 1, rowStart: 3, colSpan: 12, rowSpan: 6 },
    ];
    const result = mergeStoredLayouts(stored, defaults);
    expect(result[0].colSpan).toBe(64);
  });

  it("falls back to default when a stored entry has an unknown kind", () => {
    const defaults = createValidLayout([1]);
    const stored: unknown[] = [
      { id: "section-1", kind: "widget", colStart: 1, rowStart: 1, colSpan: 64, rowSpan: 2 },
    ];
    const result = mergeStoredLayouts(stored, defaults);
    expect(result[0]).toEqual(defaults[0]);
  });

  it("falls back to default when a stored entry is malformed", () => {
    const defaults = createValidLayout([1]);
    const stored: unknown[] = [{ id: "section-1", kind: "heading" }];
    const result = mergeStoredLayouts(stored, defaults);
    expect(result[0]).toEqual(defaults[0]);
  });

  it("falls back to default when stored kind mismatches the default", () => {
    const defaults = createValidLayout([1]);
    const stored: unknown[] = [
      { id: "section-1", kind: "card", colStart: 1, rowStart: 1, colSpan: 12, rowSpan: 6 },
    ];
    const result = mergeStoredLayouts(stored, defaults);
    expect(result[0]).toEqual(defaults[0]);
  });
});

describe("parseStoredLayouts", () => {
  it("returns null for invalid JSON", () => {
    const sheet = createMockSheet([1]);
    const defaults = createValidLayout([1]);
    expect(parseStoredLayouts("not json", sheet, defaults)).toBeNull();
  });

  it("returns merged layouts for version 3 block storage", () => {
    const sheet = createMockSheet([1]);
    const defaults = createValidLayout([1]);
    const stored: BlockLayoutState[] = [
      { id: "section-1", kind: "heading", colStart: 1, rowStart: 1, colSpan: 64, rowSpan: 2 },
      { id: "card-1-1", kind: "card", colStart: 13, rowStart: 7, colSpan: 18, rowSpan: 12 },
    ];

    const result = parseStoredLayouts(serializeStoredLayouts(stored), sheet, defaults);
    expect(result?.[1].colStart).toBe(13);
  });

  it("migrates version 2 section storage to block storage", () => {
    const sheet = createMockSheet([1]);
    const defaults = createValidLayout([1]);
    const stored = {
      version: 2,
      sections: [{ cards: [{ colStart: 13, rowStart: 7, colSpan: 18, rowSpan: 12 }] }],
    };

    const result = parseStoredLayouts(JSON.stringify(stored), sheet, defaults);
    expect(result?.find((layout) => layout.id === "card-1-1")?.colStart).toBe(13);
  });

  it("returns null for legacy array-based layouts (migration removed)", () => {
    const sheet = createMockSheet([1]);
    const defaults = createValidLayout([1]);
    const legacyStored = [{ cards: [{ colStart: 5, rowStart: 3, colSpan: 6, rowSpan: 4 }] }];

    const result = parseStoredLayouts(JSON.stringify(legacyStored), sheet, defaults);
    expect(result).toBeNull();
  });
});
