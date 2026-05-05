import { describe, it, expect } from "vitest";
import { calculateResizeBounds, boundsEqual, type CardBounds } from "./resize-calculations";

describe("resize-calculations", () => {
  const defaultOrigin: CardBounds = {
    colStart: 3,
    rowStart: 2,
    colSpan: 4,
    rowSpan: 3,
  };
  const gridColumns = 12;

  describe("calculateResizeBounds", () => {
    describe("east direction", () => {
      it("increases colSpan when moving right", () => {
        const result = calculateResizeBounds(defaultOrigin, 2, 0, "east", gridColumns);
        expect(result.colSpan).toBe(6);
        expect(result.colStart).toBe(3);
      });

      it("decreases colSpan when moving left", () => {
        const result = calculateResizeBounds(defaultOrigin, -2, 0, "east", gridColumns);
        expect(result.colSpan).toBe(2);
      });

      it("clamps colSpan to minimum 1", () => {
        const result = calculateResizeBounds(defaultOrigin, -10, 0, "east", gridColumns);
        expect(result.colSpan).toBe(1);
      });

      it("clamps colSpan to grid boundary", () => {
        const result = calculateResizeBounds(defaultOrigin, 20, 0, "east", gridColumns);
        expect(result.colSpan).toBe(10); // 12 - 3 + 1 = 10
      });
    });

    describe("west direction", () => {
      it("decreases colStart and increases colSpan when moving left", () => {
        const result = calculateResizeBounds(defaultOrigin, -2, 0, "west", gridColumns);
        expect(result.colStart).toBe(1);
        expect(result.colSpan).toBe(6);
      });

      it("increases colStart and decreases colSpan when moving right", () => {
        const result = calculateResizeBounds(defaultOrigin, 2, 0, "west", gridColumns);
        expect(result.colStart).toBe(5);
        expect(result.colSpan).toBe(2);
      });

      it("clamps colStart to minimum 1", () => {
        const result = calculateResizeBounds(defaultOrigin, -10, 0, "west", gridColumns);
        expect(result.colStart).toBe(1);
      });

      it("clamps colStart so card does not collapse", () => {
        const result = calculateResizeBounds(defaultOrigin, 10, 0, "west", gridColumns);
        // maxColStart = 3 + 4 - 1 = 6
        expect(result.colStart).toBe(6);
        expect(result.colSpan).toBe(1);
      });
    });

    describe("south direction", () => {
      it("increases rowSpan when moving down", () => {
        const result = calculateResizeBounds(defaultOrigin, 0, 2, "south", gridColumns);
        expect(result.rowSpan).toBe(5);
        expect(result.rowStart).toBe(2);
      });

      it("decreases rowSpan when moving up", () => {
        const result = calculateResizeBounds(defaultOrigin, 0, -1, "south", gridColumns);
        expect(result.rowSpan).toBe(2);
      });

      it("clamps rowSpan to minimum 1", () => {
        const result = calculateResizeBounds(defaultOrigin, 0, -10, "south", gridColumns);
        expect(result.rowSpan).toBe(1);
      });

      it("clamps rowSpan to MAX_ROW_SPAN", () => {
        const result = calculateResizeBounds(defaultOrigin, 0, 100, "south", gridColumns);
        expect(result.rowSpan).toBe(24); // MAX_ROW_SPAN
      });
    });

    describe("north direction", () => {
      it("decreases rowStart and increases rowSpan when moving up", () => {
        const origin: CardBounds = { ...defaultOrigin, rowStart: 3, rowSpan: 2 };
        const result = calculateResizeBounds(origin, 0, -2, "north", gridColumns);
        expect(result.rowStart).toBe(1);
        expect(result.rowSpan).toBe(4);
      });

      it("increases rowStart and decreases rowSpan when moving down", () => {
        const result = calculateResizeBounds(defaultOrigin, 0, 1, "north", gridColumns);
        expect(result.rowStart).toBe(3);
        expect(result.rowSpan).toBe(2);
      });

      it("clamps rowStart to minimum 1", () => {
        const result = calculateResizeBounds(defaultOrigin, 0, -10, "north", gridColumns);
        expect(result.rowStart).toBe(1);
      });

      it("clamps rowStart so card does not collapse", () => {
        const result = calculateResizeBounds(defaultOrigin, 0, 10, "north", gridColumns);
        // maxRowStart = 2 + 3 - 1 = 4
        expect(result.rowStart).toBe(4);
        expect(result.rowSpan).toBe(1);
      });
    });

    describe("corner directions", () => {
      it("north-east handles both north and east", () => {
        const result = calculateResizeBounds(defaultOrigin, 2, -1, "north-east", gridColumns);
        expect(result.colSpan).toBe(6); // east
        expect(result.rowStart).toBe(1); // north
        expect(result.rowSpan).toBe(4); // north
      });

      it("south-east handles both south and east", () => {
        const result = calculateResizeBounds(defaultOrigin, 2, 2, "south-east", gridColumns);
        expect(result.colSpan).toBe(6); // east
        expect(result.rowSpan).toBe(5); // south
      });

      it("south-west handles both south and west", () => {
        const result = calculateResizeBounds(defaultOrigin, -1, 2, "south-west", gridColumns);
        expect(result.colStart).toBe(2); // west
        expect(result.colSpan).toBe(5); // west
        expect(result.rowSpan).toBe(5); // south
      });

      it("north-west handles both north and west", () => {
        const result = calculateResizeBounds(defaultOrigin, -1, -1, "north-west", gridColumns);
        expect(result.colStart).toBe(2); // west
        expect(result.colSpan).toBe(5); // west
        expect(result.rowStart).toBe(1); // north
        expect(result.rowSpan).toBe(4); // north
      });
    });

    describe("no change", () => {
      it("returns same values with zero delta", () => {
        const result = calculateResizeBounds(defaultOrigin, 0, 0, "east", gridColumns);
        expect(result).toEqual(defaultOrigin);
      });
    });

    describe("edge cases", () => {
      it("handles card at column 1", () => {
        const origin: CardBounds = { colStart: 1, rowStart: 1, colSpan: 2, rowSpan: 2 };
        const result = calculateResizeBounds(origin, -1, 0, "west", gridColumns);
        expect(result.colStart).toBe(1); // Cannot go below 1
      });

      it("handles card at row 1", () => {
        const origin: CardBounds = { colStart: 1, rowStart: 1, colSpan: 2, rowSpan: 2 };
        const result = calculateResizeBounds(origin, 0, -1, "north", gridColumns);
        expect(result.rowStart).toBe(1); // Cannot go below 1
      });

      it("handles single-cell card", () => {
        const origin: CardBounds = { colStart: 5, rowStart: 5, colSpan: 1, rowSpan: 1 };
        
        // Cannot shrink further
        const shrinkResult = calculateResizeBounds(origin, -1, -1, "south-east", gridColumns);
        expect(shrinkResult.colSpan).toBe(1);
        expect(shrinkResult.rowSpan).toBe(1);
        
        // Can expand
        const expandResult = calculateResizeBounds(origin, 1, 1, "south-east", gridColumns);
        expect(expandResult.colSpan).toBe(2);
        expect(expandResult.rowSpan).toBe(2);
      });

      it("handles card spanning full grid width", () => {
        const origin: CardBounds = { colStart: 1, rowStart: 1, colSpan: 12, rowSpan: 2 };
        const result = calculateResizeBounds(origin, 5, 0, "east", gridColumns);
        expect(result.colSpan).toBe(12); // Already at max
      });
    });
  });

  describe("boundsEqual", () => {
    it("returns true for identical bounds", () => {
      const a: CardBounds = { colStart: 1, rowStart: 2, colSpan: 3, rowSpan: 4 };
      const b: CardBounds = { colStart: 1, rowStart: 2, colSpan: 3, rowSpan: 4 };
      expect(boundsEqual(a, b)).toBe(true);
    });

    it("returns false when colStart differs", () => {
      const a: CardBounds = { colStart: 1, rowStart: 2, colSpan: 3, rowSpan: 4 };
      const b: CardBounds = { colStart: 2, rowStart: 2, colSpan: 3, rowSpan: 4 };
      expect(boundsEqual(a, b)).toBe(false);
    });

    it("returns false when rowStart differs", () => {
      const a: CardBounds = { colStart: 1, rowStart: 2, colSpan: 3, rowSpan: 4 };
      const b: CardBounds = { colStart: 1, rowStart: 3, colSpan: 3, rowSpan: 4 };
      expect(boundsEqual(a, b)).toBe(false);
    });

    it("returns false when colSpan differs", () => {
      const a: CardBounds = { colStart: 1, rowStart: 2, colSpan: 3, rowSpan: 4 };
      const b: CardBounds = { colStart: 1, rowStart: 2, colSpan: 4, rowSpan: 4 };
      expect(boundsEqual(a, b)).toBe(false);
    });

    it("returns false when rowSpan differs", () => {
      const a: CardBounds = { colStart: 1, rowStart: 2, colSpan: 3, rowSpan: 4 };
      const b: CardBounds = { colStart: 1, rowStart: 2, colSpan: 3, rowSpan: 5 };
      expect(boundsEqual(a, b)).toBe(false);
    });
  });
});
