import { describe, it, expect } from "vitest";
import {
  buildStorageKey,
  areLayoutsEqual,
  isValidStoredLayout,
  mergeStoredLayouts,
  parseStoredLayouts,
} from "./layout-persistence";
import type { SectionLayoutState } from "./layout-types";
import type { YamlCheatSheet } from "@/lib/yaml-cheatsheets";

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

function createMockSheet(sectionCardCounts: number[]): YamlCheatSheet {
  return {
    slug: "test-sheet",
    title: "Test Sheet",
    summary: "Test summary",
    color: "#FF0000",
    sections: sectionCardCounts.map((cardCount, i) => ({
      title: `Section ${i + 1}`,
      cards: Array.from({ length: cardCount }, (_, j) => ({
        title: `Card ${j + 1}`,
        commands: [],
      })),
    })),
  };
}

function createValidLayout(sectionCardCounts: number[]): SectionLayoutState[] {
  return sectionCardCounts.map((cardCount) => ({
    cards: Array.from({ length: cardCount }, (_, i) => ({
      colStart: 1 + (i % 3) * 4,
      rowStart: 1 + Math.floor(i / 3) * 2,
      colSpan: 4,
      rowSpan: 2,
    })),
  }));
}

// ---------------------------------------------------------------------------
// buildStorageKey
// ---------------------------------------------------------------------------

describe("buildStorageKey", () => {
  it("creates storage key with prefix", () => {
    expect(buildStorageKey("git")).toBe("sheet-layout:git");
  });

  it("handles slugs with hyphens", () => {
    expect(buildStorageKey("vim-motions")).toBe("sheet-layout:vim-motions");
  });

  it("handles empty slug", () => {
    expect(buildStorageKey("")).toBe("sheet-layout:");
  });
});

// ---------------------------------------------------------------------------
// areLayoutsEqual
// ---------------------------------------------------------------------------

describe("areLayoutsEqual", () => {
  it("returns true for identical layouts", () => {
    const layout = createValidLayout([2, 3]);

    expect(areLayoutsEqual(layout, layout)).toBe(true);
  });

  it("returns true for structurally equal layouts", () => {
    const layout1 = createValidLayout([2, 3]);
    const layout2 = createValidLayout([2, 3]);

    expect(areLayoutsEqual(layout1, layout2)).toBe(true);
  });

  it("returns false when card position differs", () => {
    const layout1 = createValidLayout([2]);
    const layout2 = createValidLayout([2]);
    layout2[0].cards[0].colStart = 5;

    expect(areLayoutsEqual(layout1, layout2)).toBe(false);
  });

  it("returns false when section count differs", () => {
    const layout1 = createValidLayout([2]);
    const layout2 = createValidLayout([2, 1]);

    expect(areLayoutsEqual(layout1, layout2)).toBe(false);
  });

  it("returns false when card count differs", () => {
    const layout1 = createValidLayout([2]);
    const layout2 = createValidLayout([3]);

    expect(areLayoutsEqual(layout1, layout2)).toBe(false);
  });

  it("returns true for empty layouts", () => {
    expect(areLayoutsEqual([], [])).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// isValidStoredLayout
// ---------------------------------------------------------------------------

describe("isValidStoredLayout", () => {
  describe("structure validation", () => {
    it("returns true for valid layout matching sheet structure", () => {
      const sheet = createMockSheet([2, 3]);
      const layout = createValidLayout([2, 3]);

      expect(isValidStoredLayout(layout, sheet)).toBe(true);
    });

    it("returns false for non-array", () => {
      const sheet = createMockSheet([2]);

      expect(isValidStoredLayout({}, sheet)).toBe(false);
      expect(isValidStoredLayout("string", sheet)).toBe(false);
      expect(isValidStoredLayout(null, sheet)).toBe(false);
      expect(isValidStoredLayout(undefined, sheet)).toBe(false);
    });

    it("returns false when section count mismatches", () => {
      const sheet = createMockSheet([2, 3]);
      const layout = createValidLayout([2]); // Missing one section

      expect(isValidStoredLayout(layout, sheet)).toBe(false);
    });

    it("returns false when card count mismatches", () => {
      const sheet = createMockSheet([2, 3]);
      const layout = createValidLayout([2, 2]); // Second section has 2 instead of 3

      expect(isValidStoredLayout(layout, sheet)).toBe(false);
    });

    it("returns false for section without cards property", () => {
      const sheet = createMockSheet([2]);
      const layout = [{ notCards: [] }];

      expect(isValidStoredLayout(layout, sheet)).toBe(false);
    });

    it("returns false for section with non-array cards", () => {
      const sheet = createMockSheet([2]);
      const layout = [{ cards: "not-array" }];

      expect(isValidStoredLayout(layout, sheet)).toBe(false);
    });

    it("returns false for null section", () => {
      const sheet = createMockSheet([2]);
      const layout = [null];

      expect(isValidStoredLayout(layout, sheet)).toBe(false);
    });
  });

  describe("card property validation", () => {
    it("returns false when card is missing colStart", () => {
      const sheet = createMockSheet([1]);
      const layout = [{ cards: [{ rowStart: 1, colSpan: 4, rowSpan: 2 }] }];

      expect(isValidStoredLayout(layout, sheet)).toBe(false);
    });

    it("returns false when card is missing rowStart", () => {
      const sheet = createMockSheet([1]);
      const layout = [{ cards: [{ colStart: 1, colSpan: 4, rowSpan: 2 }] }];

      expect(isValidStoredLayout(layout, sheet)).toBe(false);
    });

    it("returns false when card is missing colSpan", () => {
      const sheet = createMockSheet([1]);
      const layout = [{ cards: [{ colStart: 1, rowStart: 1, rowSpan: 2 }] }];

      expect(isValidStoredLayout(layout, sheet)).toBe(false);
    });

    it("returns false when card is missing rowSpan", () => {
      const sheet = createMockSheet([1]);
      const layout = [{ cards: [{ colStart: 1, rowStart: 1, colSpan: 4 }] }];

      expect(isValidStoredLayout(layout, sheet)).toBe(false);
    });

    it("returns false for non-numeric values", () => {
      const sheet = createMockSheet([1]);
      const layout = [{ cards: [{ colStart: "1", rowStart: 1, colSpan: 4, rowSpan: 2 }] }];

      expect(isValidStoredLayout(layout, sheet)).toBe(false);
    });

    it("returns false for non-integer values", () => {
      const sheet = createMockSheet([1]);
      const layout = [{ cards: [{ colStart: 1.5, rowStart: 1, colSpan: 4, rowSpan: 2 }] }];

      expect(isValidStoredLayout(layout, sheet)).toBe(false);
    });

    it("returns false for null card", () => {
      const sheet = createMockSheet([1]);
      const layout = [{ cards: [null] }];

      expect(isValidStoredLayout(layout, sheet)).toBe(false);
    });
  });

  describe("value range validation", () => {
    it("returns false for colStart < 1", () => {
      const sheet = createMockSheet([1]);
      const layout = [{ cards: [{ colStart: 0, rowStart: 1, colSpan: 4, rowSpan: 2 }] }];

      expect(isValidStoredLayout(layout, sheet)).toBe(false);
    });

    it("returns false for rowStart < 1", () => {
      const sheet = createMockSheet([1]);
      const layout = [{ cards: [{ colStart: 1, rowStart: 0, colSpan: 4, rowSpan: 2 }] }];

      expect(isValidStoredLayout(layout, sheet)).toBe(false);
    });

    it("returns false for colSpan < 1", () => {
      const sheet = createMockSheet([1]);
      const layout = [{ cards: [{ colStart: 1, rowStart: 1, colSpan: 0, rowSpan: 2 }] }];

      expect(isValidStoredLayout(layout, sheet)).toBe(false);
    });

    it("returns false for colSpan > GRID_COLUMNS (12)", () => {
      const sheet = createMockSheet([1]);
      const layout = [{ cards: [{ colStart: 1, rowStart: 1, colSpan: 13, rowSpan: 2 }] }];

      expect(isValidStoredLayout(layout, sheet)).toBe(false);
    });

    it("returns false for rowSpan < 1", () => {
      const sheet = createMockSheet([1]);
      const layout = [{ cards: [{ colStart: 1, rowStart: 1, colSpan: 4, rowSpan: 0 }] }];

      expect(isValidStoredLayout(layout, sheet)).toBe(false);
    });

    it("returns false for rowSpan > MAX_ROW_SPAN (24)", () => {
      const sheet = createMockSheet([1]);
      const layout = [{ cards: [{ colStart: 1, rowStart: 1, colSpan: 4, rowSpan: 25 }] }];

      expect(isValidStoredLayout(layout, sheet)).toBe(false);
    });

    it("accepts maximum valid colSpan (12)", () => {
      const sheet = createMockSheet([1]);
      const layout = [{ cards: [{ colStart: 1, rowStart: 1, colSpan: 12, rowSpan: 2 }] }];

      expect(isValidStoredLayout(layout, sheet)).toBe(true);
    });

    it("accepts maximum valid rowSpan (24)", () => {
      const sheet = createMockSheet([1]);
      const layout = [{ cards: [{ colStart: 1, rowStart: 1, colSpan: 4, rowSpan: 24 }] }];

      expect(isValidStoredLayout(layout, sheet)).toBe(true);
    });
  });
});

// ---------------------------------------------------------------------------
// mergeStoredLayouts
// ---------------------------------------------------------------------------

describe("mergeStoredLayouts", () => {
  it("uses stored values when present", () => {
    const stored: SectionLayoutState[] = [
      { cards: [{ colStart: 5, rowStart: 3, colSpan: 6, rowSpan: 4 }] },
    ];
    const defaults: SectionLayoutState[] = [
      { cards: [{ colStart: 1, rowStart: 1, colSpan: 4, rowSpan: 2 }] },
    ];

    const result = mergeStoredLayouts(stored, defaults);

    expect(result[0].cards[0]).toEqual({ colStart: 5, rowStart: 3, colSpan: 6, rowSpan: 4 });
  });

  it("uses default values when stored card is missing", () => {
    const stored: SectionLayoutState[] = [
      { cards: [] }, // Empty cards array
    ];
    const defaults: SectionLayoutState[] = [
      { cards: [{ colStart: 1, rowStart: 1, colSpan: 4, rowSpan: 2 }] },
    ];

    const result = mergeStoredLayouts(stored, defaults);

    expect(result[0].cards[0]).toEqual({ colStart: 1, rowStart: 1, colSpan: 4, rowSpan: 2 });
  });

  it("preserves structure from defaults", () => {
    const stored: SectionLayoutState[] = [
      { cards: [{ colStart: 5, rowStart: 3, colSpan: 6, rowSpan: 4 }] },
    ];
    const defaults: SectionLayoutState[] = [
      {
        cards: [
          { colStart: 1, rowStart: 1, colSpan: 4, rowSpan: 2 },
          { colStart: 5, rowStart: 1, colSpan: 4, rowSpan: 2 },
        ],
      },
    ];

    const result = mergeStoredLayouts(stored, defaults);

    // First card uses stored, second uses default
    expect(result[0].cards[0]).toEqual({ colStart: 5, rowStart: 3, colSpan: 6, rowSpan: 4 });
    expect(result[0].cards[1]).toEqual({ colStart: 5, rowStart: 1, colSpan: 4, rowSpan: 2 });
  });

  it("handles multiple sections", () => {
    const stored: SectionLayoutState[] = [
      { cards: [{ colStart: 2, rowStart: 2, colSpan: 3, rowSpan: 3 }] },
      { cards: [{ colStart: 6, rowStart: 6, colSpan: 6, rowSpan: 6 }] },
    ];
    const defaults: SectionLayoutState[] = [
      { cards: [{ colStart: 1, rowStart: 1, colSpan: 4, rowSpan: 2 }] },
      { cards: [{ colStart: 1, rowStart: 1, colSpan: 4, rowSpan: 2 }] },
    ];

    const result = mergeStoredLayouts(stored, defaults);

    expect(result[0].cards[0].colStart).toBe(2);
    expect(result[1].cards[0].colStart).toBe(6);
  });
});

// ---------------------------------------------------------------------------
// parseStoredLayouts
// ---------------------------------------------------------------------------

describe("parseStoredLayouts", () => {
  it("returns null for null input", () => {
    const sheet = createMockSheet([2]);
    const defaults = createValidLayout([2]);

    expect(parseStoredLayouts(null, sheet, defaults)).toBeNull();
  });

  it("returns null for empty string", () => {
    const sheet = createMockSheet([2]);
    const defaults = createValidLayout([2]);

    expect(parseStoredLayouts("", sheet, defaults)).toBeNull();
  });

  it("returns null for invalid JSON", () => {
    const sheet = createMockSheet([2]);
    const defaults = createValidLayout([2]);

    expect(parseStoredLayouts("not json", sheet, defaults)).toBeNull();
    expect(parseStoredLayouts("{invalid}", sheet, defaults)).toBeNull();
  });

  it("returns null for valid JSON but invalid layout structure", () => {
    const sheet = createMockSheet([2]);
    const defaults = createValidLayout([2]);

    expect(parseStoredLayouts('{"foo": "bar"}', sheet, defaults)).toBeNull();
    expect(parseStoredLayouts("[]", sheet, defaults)).toBeNull();
  });

  it("returns merged layouts for valid stored data", () => {
    const sheet = createMockSheet([1]);
    const defaults = createValidLayout([1]);
    const stored = [{ cards: [{ colStart: 5, rowStart: 3, colSpan: 6, rowSpan: 4 }] }];

    const result = parseStoredLayouts(JSON.stringify(stored), sheet, defaults);

    expect(result).not.toBeNull();
    expect(result![0].cards[0].colStart).toBe(5);
  });

  it("returns null when section count mismatches", () => {
    const sheet = createMockSheet([2, 3]);
    const defaults = createValidLayout([2, 3]);
    const stored = createValidLayout([2]); // Missing second section

    expect(parseStoredLayouts(JSON.stringify(stored), sheet, defaults)).toBeNull();
  });

  it("returns null when card values are out of range", () => {
    const sheet = createMockSheet([1]);
    const defaults = createValidLayout([1]);
    const stored = [{ cards: [{ colStart: 1, rowStart: 1, colSpan: 99, rowSpan: 2 }] }];

    expect(parseStoredLayouts(JSON.stringify(stored), sheet, defaults)).toBeNull();
  });
});
