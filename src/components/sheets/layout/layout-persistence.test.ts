import { describe, it, expect } from "vitest";
import {
  buildStorageKey,
  areLayoutsEqual,
  isValidStoredLayout,
  mergeStoredLayouts,
  parseStoredLayouts,
  serializeStoredLayouts,
} from "./layout-persistence";
import type { YamlCheatSheet } from "@/lib/cheatsheet-shared";
import type { BlockLayoutState } from "./layout-types";

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
      colSpan: 36,
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

describe("isValidStoredLayout", () => {
  it("returns true for valid layout matching sheet blocks", () => {
    const sheet = createMockSheet([2, 1]);
    const layout = createValidLayout([2, 1]);
    expect(isValidStoredLayout(layout, sheet)).toBe(true);
  });

  it("returns false when block count mismatches", () => {
    const sheet = createMockSheet([2]);
    const layout = createValidLayout([1]);
    expect(isValidStoredLayout(layout, sheet)).toBe(false);
  });

  it("returns false for wrong block kind", () => {
    const sheet = createMockSheet([1]);
    const layout = createValidLayout([1]);
    layout[0].kind = "card";
    expect(isValidStoredLayout(layout, sheet)).toBe(false);
  });
});

describe("mergeStoredLayouts", () => {
  it("uses stored values when present", () => {
    const stored: BlockLayoutState[] = [
      { id: "section-1", kind: "heading", colStart: 1, rowStart: 1, colSpan: 36, rowSpan: 2 },
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
    const stored = [
      { id: "section-1", kind: "heading", colStart: 1, rowStart: 1, colSpan: 36, rowSpan: 2 },
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

  it("migrates legacy array-based layouts to the finer grid", () => {
    const sheet = createMockSheet([1]);
    const defaults = createValidLayout([1]);
    const legacyStored = [{ cards: [{ colStart: 5, rowStart: 3, colSpan: 6, rowSpan: 4 }] }];

    const result = parseStoredLayouts(JSON.stringify(legacyStored), sheet, defaults);
    expect(result?.find((layout) => layout.id === "card-1-1")).toMatchObject({
      colStart: 13,
      rowStart: 9,
      colSpan: 18,
      rowSpan: 12,
    });
  });
});
