import { describe, expect, it } from "vitest";
import {
  intersects,
  blocksIntersect,
  right,
  bottom,
  getBounds,
  getMaxRow,
  sortByReadingOrder,
  sortByDirection,
  sharesRows,
  sharesColumns,
  withPosition,
  withBlockPosition,
  translate,
  translateBlock,
} from "./geometry";
import type { GridPosition, LayoutBlock } from "./types";

// Helper to create a block
function block(id: string, x: number, y: number, w: number, h: number): LayoutBlock {
  return { id, kind: "card", position: { x, y, w, h } };
}

describe("geometry", () => {
  describe("intersects", () => {
    it("returns true for overlapping positions", () => {
      const a: GridPosition = { x: 0, y: 0, w: 10, h: 10 };
      const b: GridPosition = { x: 5, y: 5, w: 10, h: 10 };
      expect(intersects(a, b)).toBe(true);
    });

    it("returns false for adjacent positions (no overlap)", () => {
      const a: GridPosition = { x: 0, y: 0, w: 10, h: 10 };
      const b: GridPosition = { x: 10, y: 0, w: 10, h: 10 };
      expect(intersects(a, b)).toBe(false);
    });

    it("returns false for vertically adjacent positions", () => {
      const a: GridPosition = { x: 0, y: 0, w: 10, h: 10 };
      const b: GridPosition = { x: 0, y: 10, w: 10, h: 10 };
      expect(intersects(a, b)).toBe(false);
    });

    it("returns false for completely separate positions", () => {
      const a: GridPosition = { x: 0, y: 0, w: 5, h: 5 };
      const b: GridPosition = { x: 20, y: 20, w: 5, h: 5 };
      expect(intersects(a, b)).toBe(false);
    });

    it("returns true for contained position", () => {
      const outer: GridPosition = { x: 0, y: 0, w: 20, h: 20 };
      const inner: GridPosition = { x: 5, y: 5, w: 5, h: 5 };
      expect(intersects(outer, inner)).toBe(true);
      expect(intersects(inner, outer)).toBe(true);
    });

    it("returns true for identical positions", () => {
      const a: GridPosition = { x: 5, y: 5, w: 10, h: 10 };
      const b: GridPosition = { x: 5, y: 5, w: 10, h: 10 };
      expect(intersects(a, b)).toBe(true);
    });
  });

  describe("blocksIntersect", () => {
    it("delegates to intersects", () => {
      const a = block("a", 0, 0, 10, 10);
      const b = block("b", 5, 5, 10, 10);
      expect(blocksIntersect(a, b)).toBe(true);
    });
  });

  describe("right / bottom", () => {
    it("returns exclusive right edge", () => {
      expect(right({ x: 5, y: 0, w: 10, h: 5 })).toBe(15);
    });

    it("returns exclusive bottom edge", () => {
      expect(bottom({ x: 0, y: 3, w: 5, h: 7 })).toBe(10);
    });
  });

  describe("getBounds", () => {
    it("returns null for empty array", () => {
      expect(getBounds([])).toBe(null);
    });

    it("returns the position for a single block", () => {
      const blocks = [block("a", 5, 10, 15, 20)];
      expect(getBounds(blocks)).toEqual({ x: 5, y: 10, w: 15, h: 20 });
    });

    it("computes bounding box for multiple blocks", () => {
      const blocks = [
        block("a", 0, 0, 10, 10),
        block("b", 20, 5, 10, 10),
        block("c", 5, 25, 5, 5),
      ];
      expect(getBounds(blocks)).toEqual({ x: 0, y: 0, w: 30, h: 30 });
    });
  });

  describe("getMaxRow", () => {
    it("returns 0 for empty array", () => {
      expect(getMaxRow([])).toBe(0);
    });

    it("returns the bottom of the lowest block", () => {
      const blocks = [
        block("a", 0, 0, 10, 5),
        block("b", 0, 10, 10, 8),
        block("c", 0, 5, 10, 3),
      ];
      expect(getMaxRow(blocks)).toBe(18); // block b: 10 + 8
    });
  });

  describe("sortByReadingOrder", () => {
    it("sorts by y first, then x", () => {
      const blocks = [
        block("c", 20, 0, 5, 5),
        block("a", 0, 0, 5, 5),
        block("d", 0, 10, 5, 5),
        block("b", 10, 0, 5, 5),
      ];
      const sorted = sortByReadingOrder(blocks);
      expect(sorted.map((b) => b.id)).toEqual(["a", "b", "c", "d"]);
    });

    it("uses id as tie-breaker", () => {
      const blocks = [
        block("z", 0, 0, 5, 5),
        block("a", 0, 0, 5, 5),
        block("m", 0, 0, 5, 5),
      ];
      const sorted = sortByReadingOrder(blocks);
      expect(sorted.map((b) => b.id)).toEqual(["a", "m", "z"]);
    });

    it("does not mutate original array", () => {
      const blocks = [block("b", 10, 0, 5, 5), block("a", 0, 0, 5, 5)];
      const original = [...blocks];
      sortByReadingOrder(blocks);
      expect(blocks).toEqual(original);
    });
  });

  describe("sortByDirection", () => {
    const blocks = [
      block("a", 0, 0, 5, 5),
      block("b", 10, 0, 5, 5),
      block("c", 20, 0, 5, 5),
      block("d", 0, 10, 5, 5),
    ];

    it("east: sorts by right edge descending", () => {
      const sorted = sortByDirection(blocks, "east");
      // c (right=25), b (right=15), a (right=5, y=0), d (right=5, y=10)
      expect(sorted.map((b) => b.id)).toEqual(["c", "b", "a", "d"]);
    });

    it("west: sorts by left edge ascending", () => {
      const sorted = sortByDirection(blocks, "west");
      expect(sorted.map((b) => b.id)).toEqual(["a", "d", "b", "c"]);
    });

    it("south: sorts by bottom edge descending", () => {
      const sorted = sortByDirection(blocks, "south");
      expect(sorted.map((b) => b.id)).toEqual(["d", "a", "b", "c"]);
    });

    it("north: sorts by top edge ascending", () => {
      const sorted = sortByDirection(blocks, "north");
      expect(sorted.map((b) => b.id)).toEqual(["a", "b", "c", "d"]);
    });
  });

  describe("sharesRows", () => {
    it("returns true for vertically overlapping positions", () => {
      const a: GridPosition = { x: 0, y: 0, w: 5, h: 10 };
      const b: GridPosition = { x: 10, y: 5, w: 5, h: 10 };
      expect(sharesRows(a, b)).toBe(true);
    });

    it("returns false for vertically separate positions", () => {
      const a: GridPosition = { x: 0, y: 0, w: 5, h: 5 };
      const b: GridPosition = { x: 0, y: 10, w: 5, h: 5 };
      expect(sharesRows(a, b)).toBe(false);
    });

    it("returns false for adjacent positions", () => {
      const a: GridPosition = { x: 0, y: 0, w: 5, h: 5 };
      const b: GridPosition = { x: 0, y: 5, w: 5, h: 5 };
      expect(sharesRows(a, b)).toBe(false);
    });
  });

  describe("sharesColumns", () => {
    it("returns true for horizontally overlapping positions", () => {
      const a: GridPosition = { x: 0, y: 0, w: 10, h: 5 };
      const b: GridPosition = { x: 5, y: 10, w: 10, h: 5 };
      expect(sharesColumns(a, b)).toBe(true);
    });

    it("returns false for horizontally separate positions", () => {
      const a: GridPosition = { x: 0, y: 0, w: 5, h: 5 };
      const b: GridPosition = { x: 10, y: 0, w: 5, h: 5 };
      expect(sharesColumns(a, b)).toBe(false);
    });

    it("returns false for adjacent positions", () => {
      const a: GridPosition = { x: 0, y: 0, w: 5, h: 5 };
      const b: GridPosition = { x: 5, y: 0, w: 5, h: 5 };
      expect(sharesColumns(a, b)).toBe(false);
    });
  });

  describe("withPosition", () => {
    it("creates a new position with changes", () => {
      const pos: GridPosition = { x: 0, y: 0, w: 10, h: 10 };
      const result = withPosition(pos, { x: 5 });
      expect(result).toEqual({ x: 5, y: 0, w: 10, h: 10 });
      expect(pos.x).toBe(0); // Original unchanged
    });
  });

  describe("withBlockPosition", () => {
    it("creates a new block with position changes", () => {
      const b = block("a", 0, 0, 10, 10);
      const result = withBlockPosition(b, { x: 5, w: 15 });
      expect(result.position).toEqual({ x: 5, y: 0, w: 15, h: 10 });
      expect(b.position.x).toBe(0); // Original unchanged
    });
  });

  describe("translate", () => {
    it("moves position by delta", () => {
      const pos: GridPosition = { x: 5, y: 10, w: 15, h: 20 };
      const result = translate(pos, 3, -2);
      expect(result).toEqual({ x: 8, y: 8, w: 15, h: 20 });
    });
  });

  describe("translateBlock", () => {
    it("moves block by delta", () => {
      const b = block("a", 5, 10, 15, 20);
      const result = translateBlock(b, -5, 5);
      expect(result.position).toEqual({ x: 0, y: 15, w: 15, h: 20 });
      expect(result.id).toBe("a");
    });
  });
});
