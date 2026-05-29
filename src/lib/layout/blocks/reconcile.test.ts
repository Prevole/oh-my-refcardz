import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { reconcileBlockLayouts } from "./reconcile";
// Side-effect: register heading and card so the registry is populated.
import "./index";

/**
 * Heading constraints (from heading.ts): colSpan in [12, 64], rowSpan = 3.
 * Card constraints (from card.ts): colSpan in [6, 64], rowSpan in [4, 72].
 * Grid: 64 columns. Row count is unconstrained.
 */

describe("reconcileBlockLayouts", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  describe("input handling", () => {
    it("returns an empty result when input is not an array", () => {
      const result = reconcileBlockLayouts(null);
      expect(result).toEqual({ blocks: [], modified: false, drifted: [], dropped: [] });
    });

    it("returns an empty result for an empty array", () => {
      const result = reconcileBlockLayouts([]);
      expect(result).toEqual({ blocks: [], modified: false, drifted: [], dropped: [] });
    });
  });

  describe("no-drift case", () => {
    it("passes through a valid heading block unchanged", () => {
      const block = { id: "h1", kind: "heading", colStart: 1, rowStart: 1, colSpan: 64, rowSpan: 3 };
      const result = reconcileBlockLayouts([block]);
      expect(result.modified).toBe(false);
      expect(result.blocks).toEqual([block]);
      expect(result.drifted).toEqual([]);
      expect(result.dropped).toEqual([]);
    });

    it("passes through a valid card block unchanged", () => {
      const block = { id: "c1", kind: "card", colStart: 1, rowStart: 3, colSpan: 12, rowSpan: 6 };
      const result = reconcileBlockLayouts([block]);
      expect(result.modified).toBe(false);
      expect(result.blocks).toEqual([block]);
    });

    it("preserves rowStart even when large (no constraint on row position)", () => {
      const block = { id: "c1", kind: "card", colStart: 1, rowStart: 999, colSpan: 12, rowSpan: 6 };
      const result = reconcileBlockLayouts([block]);
      expect(result.modified).toBe(false);
      expect(result.blocks[0].rowStart).toBe(999);
    });
  });

  describe("colSpan clamping", () => {
    it("clamps colSpan above max (heading)", () => {
      const result = reconcileBlockLayouts([
        { id: "h1", kind: "heading", colStart: 1, rowStart: 1, colSpan: 100, rowSpan: 3 },
      ]);
      expect(result.modified).toBe(true);
      expect(result.blocks[0].colSpan).toBe(64);
      expect(result.drifted).toContainEqual({ id: "h1", field: "colSpan", from: 100, to: 64 });
    });

    it("clamps colSpan below min (heading)", () => {
      const result = reconcileBlockLayouts([
        { id: "h1", kind: "heading", colStart: 1, rowStart: 1, colSpan: 4, rowSpan: 3 },
      ]);
      expect(result.modified).toBe(true);
      expect(result.blocks[0].colSpan).toBe(12);
      expect(result.drifted).toContainEqual({ id: "h1", field: "colSpan", from: 4, to: 12 });
    });

    it("clamps colSpan below min (card)", () => {
      const result = reconcileBlockLayouts([
        { id: "c1", kind: "card", colStart: 1, rowStart: 1, colSpan: 2, rowSpan: 6 },
      ]);
      expect(result.modified).toBe(true);
      expect(result.blocks[0].colSpan).toBe(6);
    });

    it("handles the legacy 36-column heading (cheatsheet migration leftover)", () => {
      // Old layouts had heading.colSpan = 36 on a 36-column grid. They are
      // still valid (36 in [12, 64]) so no drift expected.
      const result = reconcileBlockLayouts([
        { id: "h1", kind: "heading", colStart: 1, rowStart: 1, colSpan: 36, rowSpan: 3 },
      ]);
      expect(result.modified).toBe(false);
      expect(result.blocks[0].colSpan).toBe(36);
    });
  });

  describe("rowSpan clamping", () => {
    it("clamps rowSpan above max (heading fixed at 3)", () => {
      const result = reconcileBlockLayouts([
        { id: "h1", kind: "heading", colStart: 1, rowStart: 1, colSpan: 64, rowSpan: 8 },
      ]);
      expect(result.modified).toBe(true);
      expect(result.blocks[0].rowSpan).toBe(3);
      expect(result.drifted).toContainEqual({ id: "h1", field: "rowSpan", from: 8, to: 3 });
    });

    it("clamps rowSpan below min (heading fixed at 3)", () => {
      const result = reconcileBlockLayouts([
        { id: "h1", kind: "heading", colStart: 1, rowStart: 1, colSpan: 64, rowSpan: 1 },
      ]);
      expect(result.modified).toBe(true);
      expect(result.blocks[0].rowSpan).toBe(3);
    });

    it("clamps rowSpan above max (card MAX_ROW_SPAN=72)", () => {
      const result = reconcileBlockLayouts([
        { id: "c1", kind: "card", colStart: 1, rowStart: 1, colSpan: 12, rowSpan: 100 },
      ]);
      expect(result.modified).toBe(true);
      expect(result.blocks[0].rowSpan).toBe(72);
    });

    it("clamps rowSpan below min (card)", () => {
      const result = reconcileBlockLayouts([
        { id: "c1", kind: "card", colStart: 1, rowStart: 1, colSpan: 12, rowSpan: 1 },
      ]);
      expect(result.modified).toBe(true);
      expect(result.blocks[0].rowSpan).toBe(4);
    });
  });

  describe("colStart clamping", () => {
    it("clamps colStart below 1", () => {
      const result = reconcileBlockLayouts([
        { id: "c1", kind: "card", colStart: -5, rowStart: 1, colSpan: 12, rowSpan: 6 },
      ]);
      expect(result.modified).toBe(true);
      expect(result.blocks[0].colStart).toBe(1);
      expect(result.drifted).toContainEqual({ id: "c1", field: "colStart", from: -5, to: 1 });
    });

    it("clamps colStart above GRID_COLUMNS", () => {
      const result = reconcileBlockLayouts([
        { id: "c1", kind: "card", colStart: 100, rowStart: 1, colSpan: 12, rowSpan: 6 },
      ]);
      expect(result.modified).toBe(true);
      // After clamp to 64, the block overflows; it is shifted left so it fits.
      // colStart = 64, colSpan = 12, overflow = 64 + 12 - 1 - 64 = 11 → colStart = 53.
      expect(result.blocks[0].colStart).toBe(53);
      expect(result.blocks[0].colSpan).toBe(12);
    });
  });

  describe("right-edge overflow", () => {
    it("shifts the block left when it overflows after colStart clamp", () => {
      // colStart = 60, colSpan = 12 → ends at column 71 > 64. Shift left by 7.
      const result = reconcileBlockLayouts([
        { id: "c1", kind: "card", colStart: 60, rowStart: 1, colSpan: 12, rowSpan: 6 },
      ]);
      expect(result.modified).toBe(true);
      expect(result.blocks[0].colStart).toBe(53);
      expect(result.blocks[0].colSpan).toBe(12);
    });

    it("keeps the block at the left edge when it spans the full grid width", () => {
      const result = reconcileBlockLayouts([
        { id: "h1", kind: "heading", colStart: 1, rowStart: 1, colSpan: 64, rowSpan: 3 },
      ]);
      expect(result.modified).toBe(false);
      expect(result.blocks[0].colStart).toBe(1);
    });
  });

  describe("drop: unknown kind", () => {
    it("drops a block with an unregistered kind", () => {
      const result = reconcileBlockLayouts([
        { id: "h1", kind: "heading", colStart: 1, rowStart: 1, colSpan: 64, rowSpan: 3 },
        { id: "x1", kind: "widget", colStart: 1, rowStart: 5, colSpan: 12, rowSpan: 6 },
      ]);
      expect(result.modified).toBe(true);
      expect(result.blocks).toHaveLength(1);
      expect(result.blocks[0].id).toBe("h1");
      expect(result.dropped).toEqual([{ id: "x1", reason: "unknown-kind" }]);
    });
  });

  describe("drop: malformed", () => {
    it("drops a non-object entry", () => {
      const result = reconcileBlockLayouts(["not-an-object"]);
      expect(result.modified).toBe(true);
      expect(result.blocks).toEqual([]);
      expect(result.dropped).toEqual([{ id: undefined, reason: "malformed" }]);
    });

    it("drops an entry missing required fields", () => {
      const result = reconcileBlockLayouts([{ id: "h1", kind: "heading" }]);
      expect(result.modified).toBe(true);
      expect(result.blocks).toEqual([]);
      expect(result.dropped).toEqual([{ id: "h1", reason: "malformed" }]);
    });

    it("drops an entry with non-numeric position", () => {
      const result = reconcileBlockLayouts([
        { id: "h1", kind: "heading", colStart: "1", rowStart: 1, colSpan: 64, rowSpan: 2 },
      ]);
      expect(result.modified).toBe(true);
      expect(result.dropped).toEqual([{ id: "h1", reason: "malformed" }]);
    });

    it("drops an entry with non-integer position", () => {
      const result = reconcileBlockLayouts([
        { id: "h1", kind: "heading", colStart: 1.5, rowStart: 1, colSpan: 64, rowSpan: 2 },
      ]);
      expect(result.modified).toBe(true);
      expect(result.dropped).toEqual([{ id: "h1", reason: "malformed" }]);
    });

    it("drops an entry with empty id", () => {
      const result = reconcileBlockLayouts([
        { id: "", kind: "heading", colStart: 1, rowStart: 1, colSpan: 64, rowSpan: 3 },
      ]);
      expect(result.modified).toBe(true);
      expect(result.dropped).toEqual([{ id: undefined, reason: "malformed" }]);
    });
  });

  describe("console warnings", () => {
    it("warns once per drift", () => {
      reconcileBlockLayouts([
        { id: "h1", kind: "heading", colStart: 1, rowStart: 1, colSpan: 100, rowSpan: 8 },
      ]);
      expect(warnSpy).toHaveBeenCalledTimes(2);
    });

    it("warns once per drop", () => {
      reconcileBlockLayouts([
        { id: "x1", kind: "unknown", colStart: 1, rowStart: 1, colSpan: 12, rowSpan: 4 },
      ]);
      expect(warnSpy).toHaveBeenCalledTimes(1);
    });

    it("does not warn when there is no drift or drop", () => {
      reconcileBlockLayouts([
        { id: "h1", kind: "heading", colStart: 1, rowStart: 1, colSpan: 64, rowSpan: 3 },
      ]);
      expect(warnSpy).not.toHaveBeenCalled();
    });
  });

  describe("mixed input", () => {
    it("processes valid, drifted, malformed, and unknown entries in one batch", () => {
      const result = reconcileBlockLayouts([
        { id: "h1", kind: "heading", colStart: 1, rowStart: 1, colSpan: 64, rowSpan: 3 },
        { id: "c1", kind: "card", colStart: 1, rowStart: 3, colSpan: 100, rowSpan: 6 },
        { id: "c2", kind: "card" },
        { id: "x1", kind: "widget", colStart: 1, rowStart: 9, colSpan: 12, rowSpan: 4 },
      ]);
      expect(result.modified).toBe(true);
      expect(result.blocks).toHaveLength(2);
      expect(result.blocks.map((b) => b.id)).toEqual(["h1", "c1"]);
      expect(result.blocks[1].colSpan).toBe(64);
      expect(result.dropped).toEqual([
        { id: "c2", reason: "malformed" },
        { id: "x1", reason: "unknown-kind" },
      ]);
    });
  });
});
