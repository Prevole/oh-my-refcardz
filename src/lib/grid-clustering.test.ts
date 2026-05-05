import { describe, it, expect } from "vitest";
import { cluster, computeGridPositions, type RectLike } from "./grid-clustering";

describe("grid-clustering", () => {
  describe("cluster", () => {
    it("returns empty array for empty input", () => {
      expect(cluster([], 10)).toEqual([]);
    });

    it("returns single bucket for single value", () => {
      expect(cluster([50], 10)).toEqual([50]);
    });

    it("clusters values within threshold together", () => {
      expect(cluster([10, 15, 12], 10)).toEqual([10]);
    });

    it("creates separate buckets for distant values", () => {
      expect(cluster([10, 50, 100], 10)).toEqual([10, 50, 100]);
    });

    it("uses first value in sorted order as bucket representative", () => {
      const result = cluster([30, 10, 20], 5);
      expect(result).toEqual([10, 20, 30]);
    });

    it("clusters adjacent values but separates distant ones", () => {
      const result = cluster([10, 12, 50, 52, 100], 5);
      expect(result).toEqual([10, 50, 100]);
    });

    it("handles negative values", () => {
      const result = cluster([-50, -45, 0, 5], 10);
      expect(result).toEqual([-50, 0]);
    });

    it("handles decimal values", () => {
      const result = cluster([10.5, 11.2, 50.8], 5);
      expect(result).toEqual([10.5, 50.8]);
    });

    it("handles exact threshold boundary", () => {
      const result = cluster([10, 20], 10);
      expect(result).toEqual([10]);
    });

    it("creates new bucket when just over threshold", () => {
      const result = cluster([10, 21], 10);
      expect(result).toEqual([10, 21]);
    });

    it("handles large datasets", () => {
      const values = Array.from({ length: 100 }, (_, i) => i * 5);
      const result = cluster(values, 10);
      expect(result.length).toBeLessThan(values.length);
      expect(result.length).toBeGreaterThan(0);
    });

    it("preserves order in output", () => {
      const result = cluster([100, 10, 50], 5);
      expect(result).toEqual([10, 50, 100]);
    });
  });

  describe("computeGridPositions", () => {
    function rect(left: number, top: number, width = 100, height = 50): RectLike {
      return { left, top, width, height };
    }

    it("returns empty array for empty input", () => {
      expect(computeGridPositions([])).toEqual([]);
    });

    it("assigns single rect to position (0, 0)", () => {
      const result = computeGridPositions([rect(0, 0)]);
      expect(result).toEqual([{ gridCol: 0, gridRow: 0 }]);
    });

    it("assigns same column to vertically aligned rects", () => {
      const rects = [
        rect(0, 0),
        rect(0, 100),
        rect(0, 200),
      ];
      const result = computeGridPositions(rects);
      expect(result.map((p) => p.gridCol)).toEqual([0, 0, 0]);
      expect(result.map((p) => p.gridRow)).toEqual([0, 1, 2]);
    });

    it("assigns same row to horizontally aligned rects", () => {
      const rects = [
        rect(0, 0),
        rect(150, 0),
        rect(300, 0),
      ];
      const result = computeGridPositions(rects);
      expect(result.map((p) => p.gridRow)).toEqual([0, 0, 0]);
      expect(result.map((p) => p.gridCol)).toEqual([0, 1, 2]);
    });

    it("handles 2x2 grid layout", () => {
      const rects = [
        rect(0, 0),     // (0, 0)
        rect(150, 0),   // (1, 0)
        rect(0, 100),   // (0, 1)
        rect(150, 100), // (1, 1)
      ];
      const result = computeGridPositions(rects);
      expect(result).toEqual([
        { gridCol: 0, gridRow: 0 },
        { gridCol: 1, gridRow: 0 },
        { gridCol: 0, gridRow: 1 },
        { gridCol: 1, gridRow: 1 },
      ]);
    });

    it("uses center-X for column clustering", () => {
      const rects = [
        rect(0, 0, 100),   // center-X = 50
        rect(10, 100, 100), // center-X = 60, within threshold of 50
      ];
      const result = computeGridPositions(rects);
      expect(result[0].gridCol).toBe(result[1].gridCol);
    });

    it("handles different rect widths", () => {
      const rects = [
        rect(0, 0, 100),   // center-X = 50
        rect(0, 100, 200), // center-X = 100, different column
      ];
      const result = computeGridPositions(rects);
      expect(result[0].gridCol).not.toBe(result[1].gridCol);
    });

    it("respects custom threshold", () => {
      const rects = [
        rect(0, 0),
        rect(30, 0), // center-X difference = 30
      ];
      
      const resultLowThreshold = computeGridPositions(rects, 20);
      expect(resultLowThreshold[0].gridCol).not.toBe(resultLowThreshold[1].gridCol);
      
      const resultHighThreshold = computeGridPositions(rects, 50);
      expect(resultHighThreshold[0].gridCol).toBe(resultHighThreshold[1].gridCol);
    });

    it("handles sparse grid with gaps", () => {
      const rects = [
        rect(0, 0),     // (0, 0)
        rect(300, 0),   // (1, 0) - no rect at (0, 1)
        rect(300, 200), // (1, 1)
      ];
      const result = computeGridPositions(rects);
      expect(result).toEqual([
        { gridCol: 0, gridRow: 0 },
        { gridCol: 1, gridRow: 0 },
        { gridCol: 1, gridRow: 1 },
      ]);
    });

    it("handles negative coordinates", () => {
      const rects = [
        rect(-100, -100),
        rect(0, 0),
      ];
      const result = computeGridPositions(rects);
      expect(result[0].gridCol).toBeLessThanOrEqual(result[1].gridCol);
      expect(result[0].gridRow).toBeLessThanOrEqual(result[1].gridRow);
    });

    it("preserves input order in output", () => {
      const rects = [
        rect(300, 0),   // rightmost
        rect(0, 0),     // leftmost
        rect(150, 0),   // middle
      ];
      const result = computeGridPositions(rects);
      expect(result[0].gridCol).toBe(2); // rightmost -> col 2
      expect(result[1].gridCol).toBe(0); // leftmost -> col 0
      expect(result[2].gridCol).toBe(1); // middle -> col 1
    });

    it("handles very close rects as same position", () => {
      const rects = [
        rect(0, 0),
        rect(5, 5), // very close
      ];
      const result = computeGridPositions(rects);
      expect(result[0]).toEqual(result[1]);
    });

    it("handles tall narrow cards in column layout", () => {
      const rects = [
        { left: 0, top: 0, width: 50, height: 200 },
        { left: 100, top: 0, width: 50, height: 200 },
        { left: 200, top: 0, width: 50, height: 200 },
      ];
      const result = computeGridPositions(rects);
      expect(result.map((p) => p.gridCol)).toEqual([0, 1, 2]);
      expect(result.map((p) => p.gridRow)).toEqual([0, 0, 0]);
    });
  });
});
