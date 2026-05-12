import { describe, expect, it } from "vitest";
import {
  toGridPosition,
  toOldPosition,
  migrateBlockLayout,
  toOldBlockLayout,
  migrateBlockLayouts,
  toOldBlockLayouts,
  isOldBlockLayoutFormat,
  isNewBlockLayoutFormat,
  isOldFormatArray,
  isNewFormatArray,
  normalizeBlockLayouts,
  type OldBlockLayoutState,
} from "./migration";
import type { GridPosition, LayoutBlock } from "./solver/types";

describe("migration", () => {
  describe("toGridPosition", () => {
    it("converts 1-indexed to 0-indexed coordinates", () => {
      const old = { colStart: 1, rowStart: 1, colSpan: 18, rowSpan: 12 };
      const result = toGridPosition(old);

      expect(result).toEqual({ x: 0, y: 0, w: 18, h: 12 });
    });

    it("handles non-origin positions", () => {
      const old = { colStart: 19, rowStart: 3, colSpan: 18, rowSpan: 13 };
      const result = toGridPosition(old);

      expect(result).toEqual({ x: 18, y: 2, w: 18, h: 13 });
    });
  });

  describe("toOldPosition", () => {
    it("converts 0-indexed to 1-indexed coordinates", () => {
      const pos: GridPosition = { x: 0, y: 0, w: 18, h: 12 };
      const result = toOldPosition(pos);

      expect(result).toEqual({ colStart: 1, rowStart: 1, colSpan: 18, rowSpan: 12 });
    });

    it("handles non-origin positions", () => {
      const pos: GridPosition = { x: 18, y: 2, w: 18, h: 13 };
      const result = toOldPosition(pos);

      expect(result).toEqual({ colStart: 19, rowStart: 3, colSpan: 18, rowSpan: 13 });
    });
  });

  describe("migrateBlockLayout / toOldBlockLayout", () => {
    const oldBlock: OldBlockLayoutState = {
      id: "test-card",
      kind: "card",
      colStart: 1,
      rowStart: 3,
      colSpan: 18,
      rowSpan: 12,
    };

    const newBlock: LayoutBlock = {
      id: "test-card",
      kind: "card",
      position: { x: 0, y: 2, w: 18, h: 12 },
    };

    it("migrates old to new format", () => {
      expect(migrateBlockLayout(oldBlock)).toEqual(newBlock);
    });

    it("converts new to old format", () => {
      expect(toOldBlockLayout(newBlock)).toEqual(oldBlock);
    });

    it("round-trips correctly", () => {
      const migrated = migrateBlockLayout(oldBlock);
      const converted = toOldBlockLayout(migrated);

      expect(converted).toEqual(oldBlock);
    });
  });

  describe("migrateBlockLayouts / toOldBlockLayouts", () => {
    const oldLayouts: OldBlockLayoutState[] = [
      { id: "h1", kind: "heading", colStart: 1, rowStart: 1, colSpan: 36, rowSpan: 2 },
      { id: "c1", kind: "card", colStart: 1, rowStart: 3, colSpan: 18, rowSpan: 12 },
    ];

    it("migrates array of old layouts", () => {
      const result = migrateBlockLayouts(oldLayouts);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: "h1",
        kind: "heading",
        position: { x: 0, y: 0, w: 36, h: 2 },
      });
      expect(result[1]).toEqual({
        id: "c1",
        kind: "card",
        position: { x: 0, y: 2, w: 18, h: 12 },
      });
    });

    it("converts array of new layouts to old", () => {
      const newLayouts = migrateBlockLayouts(oldLayouts);
      const result = toOldBlockLayouts(newLayouts);

      expect(result).toEqual(oldLayouts);
    });
  });

  describe("format detection", () => {
    describe("isOldBlockLayoutFormat", () => {
      it("returns true for old format", () => {
        const old = { id: "test", kind: "card", colStart: 1, rowStart: 1, colSpan: 18, rowSpan: 12 };
        expect(isOldBlockLayoutFormat(old)).toBe(true);
      });

      it("returns false for new format", () => {
        const newBlock = { id: "test", kind: "card", position: { x: 0, y: 0, w: 18, h: 12 } };
        expect(isOldBlockLayoutFormat(newBlock)).toBe(false);
      });

      it("returns false for invalid values", () => {
        expect(isOldBlockLayoutFormat(null)).toBe(false);
        expect(isOldBlockLayoutFormat(undefined)).toBe(false);
        expect(isOldBlockLayoutFormat({})).toBe(false);
        expect(isOldBlockLayoutFormat({ id: "test" })).toBe(false);
      });
    });

    describe("isNewBlockLayoutFormat", () => {
      it("returns true for new format", () => {
        const newBlock = { id: "test", kind: "card", position: { x: 0, y: 0, w: 18, h: 12 } };
        expect(isNewBlockLayoutFormat(newBlock)).toBe(true);
      });

      it("returns false for old format", () => {
        const old = { id: "test", kind: "card", colStart: 1, rowStart: 1, colSpan: 18, rowSpan: 12 };
        expect(isNewBlockLayoutFormat(old)).toBe(false);
      });

      it("returns false for invalid values", () => {
        expect(isNewBlockLayoutFormat(null)).toBe(false);
        expect(isNewBlockLayoutFormat({ id: "test", kind: "card" })).toBe(false);
        expect(isNewBlockLayoutFormat({ id: "test", kind: "card", position: {} })).toBe(false);
      });
    });

    describe("isOldFormatArray / isNewFormatArray", () => {
      it("detects old format arrays", () => {
        const old = [{ id: "test", kind: "card", colStart: 1, rowStart: 1, colSpan: 18, rowSpan: 12 }];
        expect(isOldFormatArray(old)).toBe(true);
        expect(isNewFormatArray(old)).toBe(false);
      });

      it("detects new format arrays", () => {
        const newArr = [{ id: "test", kind: "card", position: { x: 0, y: 0, w: 18, h: 12 } }];
        expect(isNewFormatArray(newArr)).toBe(true);
        expect(isOldFormatArray(newArr)).toBe(false);
      });

      it("returns false for empty arrays", () => {
        expect(isOldFormatArray([])).toBe(false);
        expect(isNewFormatArray([])).toBe(false);
      });
    });
  });

  describe("normalizeBlockLayouts", () => {
    it("returns new format as-is", () => {
      const newArr: LayoutBlock[] = [{ id: "test", kind: "card", position: { x: 0, y: 0, w: 18, h: 12 } }];
      const result = normalizeBlockLayouts(newArr);

      expect(result).toBe(newArr);
    });

    it("migrates old format to new", () => {
      const old = [{ id: "test", kind: "card", colStart: 1, rowStart: 1, colSpan: 18, rowSpan: 12 }];
      const result = normalizeBlockLayouts(old);

      expect(result).toEqual([{ id: "test", kind: "card", position: { x: 0, y: 0, w: 18, h: 12 } }]);
    });

    it("returns null for invalid input", () => {
      expect(normalizeBlockLayouts(null)).toBe(null);
      expect(normalizeBlockLayouts({})).toBe(null);
      expect(normalizeBlockLayouts([])).toBe(null);
      expect(normalizeBlockLayouts("invalid")).toBe(null);
    });
  });
});
