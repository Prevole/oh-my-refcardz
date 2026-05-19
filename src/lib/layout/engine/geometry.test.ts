import { describe, expect, it } from "vitest";
import {
  contains,
  euclideanDistance,
  intersects,
  isContiguous,
  isWithinGridX,
  normalizeForSouthFallback,
  perpendicularOverlap,
  translate,
} from "./geometry";
import type { GridPosition } from "./types";

const pos = (x: number, y: number, w: number, h: number): GridPosition => ({ x, y, w, h });

describe("intersects", () => {
  it("returns true for overlapping rectangles", () => {
    expect(intersects(pos(0, 0, 4, 4), pos(2, 2, 4, 4))).toBe(true);
  });

  it("returns false for adjacent rectangles touching only on edges", () => {
    expect(intersects(pos(0, 0, 4, 4), pos(4, 0, 4, 4))).toBe(false);
    expect(intersects(pos(0, 0, 4, 4), pos(0, 4, 4, 4))).toBe(false);
  });

  it("returns false for disjoint rectangles", () => {
    expect(intersects(pos(0, 0, 2, 2), pos(10, 10, 2, 2))).toBe(false);
  });

  it("returns true when one rectangle contains another", () => {
    expect(intersects(pos(0, 0, 10, 10), pos(2, 2, 2, 2))).toBe(true);
  });
});

describe("contains", () => {
  it("returns true when the inner rectangle is fully inside the outer", () => {
    expect(contains(pos(0, 0, 10, 10), pos(2, 2, 4, 4))).toBe(true);
  });

  it("returns false when the inner rectangle exceeds the outer on any side", () => {
    expect(contains(pos(0, 0, 10, 10), pos(8, 8, 4, 4))).toBe(false);
    expect(contains(pos(0, 0, 10, 10), pos(-1, 0, 2, 2))).toBe(false);
  });
});

describe("isWithinGridX", () => {
  it("returns true when the rectangle fits within [0, gridColumns]", () => {
    expect(isWithinGridX(pos(0, 0, 36, 1), 36)).toBe(true);
    expect(isWithinGridX(pos(2, 99, 4, 4), 36)).toBe(true);
  });

  it("returns false when the rectangle exceeds either edge", () => {
    expect(isWithinGridX(pos(-1, 0, 4, 4), 36)).toBe(false);
    expect(isWithinGridX(pos(33, 0, 4, 4), 36)).toBe(false);
  });
});

describe("translate", () => {
  it("shifts the rectangle by dx and dy", () => {
    expect(translate(pos(2, 3, 4, 5), 1, -1)).toEqual(pos(3, 2, 4, 5));
  });
});

describe("perpendicularOverlap", () => {
  it("computes vertical overlap when direction is horizontal", () => {
    // a and b share rows 2..5 (overlap of 3 rows: 2, 3, 4)
    expect(perpendicularOverlap(pos(0, 0, 2, 5), pos(5, 2, 2, 3), "east")).toBe(3);
  });

  it("computes horizontal overlap when direction is vertical", () => {
    expect(perpendicularOverlap(pos(0, 0, 5, 2), pos(2, 4, 3, 2), "south")).toBe(3);
  });

  it("returns 0 when there is no overlap on the perpendicular axis", () => {
    expect(perpendicularOverlap(pos(0, 0, 2, 2), pos(5, 5, 2, 2), "east")).toBe(0);
  });
});

describe("isContiguous", () => {
  it("detects east contiguity when b sits immediately right of a with perpendicular overlap", () => {
    expect(isContiguous(pos(0, 0, 2, 2), pos(2, 0, 2, 2), "east")).toBe(true);
  });

  it("rejects east contiguity when b is east but vertically disjoint", () => {
    expect(isContiguous(pos(0, 0, 2, 2), pos(2, 5, 2, 2), "east")).toBe(false);
  });

  it("rejects when there is a gap between blocks in the direction", () => {
    expect(isContiguous(pos(0, 0, 2, 2), pos(3, 0, 2, 2), "east")).toBe(false);
  });

  it("works in all four directions", () => {
    expect(isContiguous(pos(0, 5, 2, 2), pos(0, 3, 2, 2), "north")).toBe(true);
    expect(isContiguous(pos(0, 0, 2, 2), pos(0, 2, 2, 2), "south")).toBe(true);
    expect(isContiguous(pos(5, 0, 2, 2), pos(3, 0, 2, 2), "west")).toBe(true);
  });
});

describe("euclideanDistance", () => {
  it("computes distance between two anchor points", () => {
    expect(euclideanDistance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
  });

  it("returns 0 for identical points", () => {
    expect(euclideanDistance({ x: 5, y: 5 }, { x: 5, y: 5 })).toBe(0);
  });
});

describe("normalizeForSouthFallback", () => {
  it("translates the group so the closest-to-primary y aligns with primary.y", () => {
    // primary at y=1, wrappable at y=8 and y=8 (same row) -> dy = -7
    const primary = pos(8, 1, 2, 1);
    const wrappable: GridPosition[] = [pos(4, 8, 2, 1), pos(10, 8, 2, 1)];

    const result = normalizeForSouthFallback(primary, wrappable);

    expect(result.dy).toBe(-7);
    expect(result.normalized).toEqual([
      { ...pos(4, 8, 2, 1), x: 4, y: 1 },
      { ...pos(10, 8, 2, 1), x: 10, y: 1 },
    ]);
  });

  it("chooses the row closest to primary.y when wrappables are on multiple rows", () => {
    const primary = pos(0, 5, 2, 1);
    // y=10 (distance 5) vs y=3 (distance 2) -> align y=3 to y=5 => dy=+2
    const wrappable: GridPosition[] = [pos(0, 10, 2, 1), pos(0, 3, 2, 1)];

    const result = normalizeForSouthFallback(primary, wrappable);

    expect(result.dy).toBe(2);
  });

  it("returns dy=0 when no wrappables are provided", () => {
    const result = normalizeForSouthFallback(pos(0, 0, 2, 1), []);
    expect(result.dy).toBe(0);
    expect(result.normalized).toEqual([]);
  });
});
