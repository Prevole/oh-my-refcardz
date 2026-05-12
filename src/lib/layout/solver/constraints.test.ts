import { describe, expect, it } from "vitest";
import {
  DEFAULT_GRID_COLUMNS,
  isWithinGrid,
  satisfiesConstraints,
  isValidPosition,
  clampToGrid,
  clampToConstraints,
  clampPosition,
  CARD_CONSTRAINTS,
  HEADING_CONSTRAINTS,
  getDefaultConstraints,
  buildConstraintsMap,
  getConstraints,
} from "./constraints";
import type { BlockConstraints, GridPosition, LayoutBlock } from "./types";

describe("constraints", () => {
  describe("isWithinGrid", () => {
    it("returns true for valid position", () => {
      const pos: GridPosition = { x: 0, y: 0, w: 18, h: 10 };
      expect(isWithinGrid(pos)).toBe(true);
    });

    it("returns true for position at right edge", () => {
      const pos: GridPosition = { x: 18, y: 0, w: 18, h: 10 };
      expect(isWithinGrid(pos)).toBe(true);
    });

    it("returns false for negative x", () => {
      const pos: GridPosition = { x: -1, y: 0, w: 10, h: 10 };
      expect(isWithinGrid(pos)).toBe(false);
    });

    it("returns false for negative y", () => {
      const pos: GridPosition = { x: 0, y: -1, w: 10, h: 10 };
      expect(isWithinGrid(pos)).toBe(false);
    });

    it("returns false for position exceeding grid width", () => {
      const pos: GridPosition = { x: 30, y: 0, w: 10, h: 10 };
      expect(isWithinGrid(pos)).toBe(false);
    });

    it("returns false for zero width", () => {
      const pos: GridPosition = { x: 0, y: 0, w: 0, h: 10 };
      expect(isWithinGrid(pos)).toBe(false);
    });

    it("returns false for zero height", () => {
      const pos: GridPosition = { x: 0, y: 0, w: 10, h: 0 };
      expect(isWithinGrid(pos)).toBe(false);
    });

    it("uses custom grid columns", () => {
      const pos: GridPosition = { x: 10, y: 0, w: 10, h: 10 };
      expect(isWithinGrid(pos, 12)).toBe(false);
      expect(isWithinGrid(pos, 20)).toBe(true);
    });
  });

  describe("satisfiesConstraints", () => {
    const constraints: BlockConstraints = {
      minW: 6,
      minH: 4,
      maxW: 24,
      maxH: 20,
      allowedResizeDirections: ["north", "south", "east", "west"],
    };

    it("returns true for valid size", () => {
      const pos: GridPosition = { x: 0, y: 0, w: 12, h: 10 };
      expect(satisfiesConstraints(pos, constraints)).toBe(true);
    });

    it("returns true for minimum size", () => {
      const pos: GridPosition = { x: 0, y: 0, w: 6, h: 4 };
      expect(satisfiesConstraints(pos, constraints)).toBe(true);
    });

    it("returns true for maximum size", () => {
      const pos: GridPosition = { x: 0, y: 0, w: 24, h: 20 };
      expect(satisfiesConstraints(pos, constraints)).toBe(true);
    });

    it("returns false for width below minimum", () => {
      const pos: GridPosition = { x: 0, y: 0, w: 5, h: 10 };
      expect(satisfiesConstraints(pos, constraints)).toBe(false);
    });

    it("returns false for height below minimum", () => {
      const pos: GridPosition = { x: 0, y: 0, w: 10, h: 3 };
      expect(satisfiesConstraints(pos, constraints)).toBe(false);
    });

    it("returns false for width above maximum", () => {
      const pos: GridPosition = { x: 0, y: 0, w: 25, h: 10 };
      expect(satisfiesConstraints(pos, constraints)).toBe(false);
    });

    it("returns false for height above maximum", () => {
      const pos: GridPosition = { x: 0, y: 0, w: 10, h: 21 };
      expect(satisfiesConstraints(pos, constraints)).toBe(false);
    });

    it("ignores undefined maxW", () => {
      const noMaxW: BlockConstraints = { ...constraints, maxW: undefined };
      const pos: GridPosition = { x: 0, y: 0, w: 100, h: 10 };
      expect(satisfiesConstraints(pos, noMaxW)).toBe(true);
    });

    it("ignores undefined maxH", () => {
      const noMaxH: BlockConstraints = { ...constraints, maxH: undefined };
      const pos: GridPosition = { x: 0, y: 0, w: 10, h: 100 };
      expect(satisfiesConstraints(pos, noMaxH)).toBe(true);
    });
  });

  describe("isValidPosition", () => {
    const constraints: BlockConstraints = {
      minW: 6,
      minH: 4,
      allowedResizeDirections: ["north", "south", "east", "west"],
    };

    it("returns true for fully valid position", () => {
      const pos: GridPosition = { x: 0, y: 0, w: 18, h: 10 };
      expect(isValidPosition(pos, constraints)).toBe(true);
    });

    it("returns false for out-of-grid position", () => {
      const pos: GridPosition = { x: 30, y: 0, w: 18, h: 10 };
      expect(isValidPosition(pos, constraints)).toBe(false);
    });

    it("returns false for constraint violation", () => {
      const pos: GridPosition = { x: 0, y: 0, w: 3, h: 10 };
      expect(isValidPosition(pos, constraints)).toBe(false);
    });
  });

  describe("clampToGrid", () => {
    it("returns same position if already valid", () => {
      const pos: GridPosition = { x: 10, y: 5, w: 10, h: 10 };
      expect(clampToGrid(pos)).toEqual(pos);
    });

    it("clamps negative x to 0", () => {
      const pos: GridPosition = { x: -5, y: 0, w: 10, h: 10 };
      expect(clampToGrid(pos)).toEqual({ x: 0, y: 0, w: 10, h: 10 });
    });

    it("clamps negative y to 0", () => {
      const pos: GridPosition = { x: 0, y: -5, w: 10, h: 10 };
      expect(clampToGrid(pos)).toEqual({ x: 0, y: 0, w: 10, h: 10 });
    });

    it("clamps position exceeding right edge", () => {
      const pos: GridPosition = { x: 30, y: 0, w: 10, h: 10 };
      expect(clampToGrid(pos)).toEqual({ x: 26, y: 0, w: 10, h: 10 });
    });

    it("clamps oversized block to x=0", () => {
      const pos: GridPosition = { x: 10, y: 0, w: 40, h: 10 };
      expect(clampToGrid(pos)).toEqual({ x: 0, y: 0, w: 40, h: 10 });
    });
  });

  describe("clampToConstraints", () => {
    const constraints: BlockConstraints = {
      minW: 6,
      minH: 4,
      maxW: 24,
      maxH: 20,
      allowedResizeDirections: [],
    };

    it("returns same size if already valid", () => {
      const pos: GridPosition = { x: 5, y: 5, w: 12, h: 10 };
      expect(clampToConstraints(pos, constraints)).toEqual(pos);
    });

    it("clamps width up to minimum", () => {
      const pos: GridPosition = { x: 0, y: 0, w: 3, h: 10 };
      expect(clampToConstraints(pos, constraints)).toEqual({ x: 0, y: 0, w: 6, h: 10 });
    });

    it("clamps height up to minimum", () => {
      const pos: GridPosition = { x: 0, y: 0, w: 10, h: 2 };
      expect(clampToConstraints(pos, constraints)).toEqual({ x: 0, y: 0, w: 10, h: 4 });
    });

    it("clamps width down to maximum", () => {
      const pos: GridPosition = { x: 0, y: 0, w: 30, h: 10 };
      expect(clampToConstraints(pos, constraints)).toEqual({ x: 0, y: 0, w: 24, h: 10 });
    });

    it("clamps height down to maximum", () => {
      const pos: GridPosition = { x: 0, y: 0, w: 10, h: 25 };
      expect(clampToConstraints(pos, constraints)).toEqual({ x: 0, y: 0, w: 10, h: 20 });
    });

    it("preserves position", () => {
      const pos: GridPosition = { x: 10, y: 15, w: 3, h: 2 };
      const result = clampToConstraints(pos, constraints);
      expect(result.x).toBe(10);
      expect(result.y).toBe(15);
    });
  });

  describe("clampPosition", () => {
    const constraints: BlockConstraints = {
      minW: 6,
      minH: 4,
      maxW: 24,
      allowedResizeDirections: [],
    };

    it("clamps both size and position", () => {
      const pos: GridPosition = { x: 35, y: -5, w: 3, h: 2 };
      const result = clampPosition(pos, constraints);
      expect(result).toEqual({ x: 30, y: 0, w: 6, h: 4 });
    });

    it("clamps oversized block to grid width when no maxW", () => {
      const noMaxW: BlockConstraints = {
        minW: 6,
        minH: 4,
        allowedResizeDirections: [],
      };
      const pos: GridPosition = { x: 0, y: 0, w: 50, h: 10 };
      const result = clampPosition(pos, noMaxW, 36);
      expect(result.w).toBe(36);
    });
  });

  describe("default constraints", () => {
    it("CARD_CONSTRAINTS has correct values", () => {
      expect(CARD_CONSTRAINTS.minW).toBe(6);
      expect(CARD_CONSTRAINTS.minH).toBe(4);
      expect(CARD_CONSTRAINTS.maxW).toBeUndefined();
      expect(CARD_CONSTRAINTS.maxH).toBeUndefined();
    });

    it("HEADING_CONSTRAINTS has correct values", () => {
      expect(HEADING_CONSTRAINTS.minW).toBe(12);
      expect(HEADING_CONSTRAINTS.minH).toBe(2);
      expect(HEADING_CONSTRAINTS.maxH).toBe(2);
      expect(HEADING_CONSTRAINTS.allowedResizeDirections).toEqual(["east", "west"]);
    });

    it("getDefaultConstraints returns correct type", () => {
      expect(getDefaultConstraints("card")).toBe(CARD_CONSTRAINTS);
      expect(getDefaultConstraints("heading")).toBe(HEADING_CONSTRAINTS);
    });
  });

  describe("buildConstraintsMap", () => {
    it("creates map with default constraints", () => {
      const blocks: LayoutBlock[] = [
        { id: "h1", kind: "heading", position: { x: 0, y: 0, w: 36, h: 2 } },
        { id: "c1", kind: "card", position: { x: 0, y: 2, w: 18, h: 10 } },
      ];
      const map = buildConstraintsMap(blocks);

      expect(map.get("h1")).toBe(HEADING_CONSTRAINTS);
      expect(map.get("c1")).toBe(CARD_CONSTRAINTS);
    });
  });

  describe("getConstraints", () => {
    it("returns constraint from map if exists", () => {
      const custom: BlockConstraints = {
        minW: 10,
        minH: 10,
        allowedResizeDirections: [],
      };
      const map = new Map([["c1", custom]]);
      const block: LayoutBlock = { id: "c1", kind: "card", position: { x: 0, y: 0, w: 18, h: 10 } };

      expect(getConstraints(block, map)).toBe(custom);
    });

    it("returns default if not in map", () => {
      const map = new Map<string, BlockConstraints>();
      const block: LayoutBlock = { id: "c1", kind: "card", position: { x: 0, y: 0, w: 18, h: 10 } };

      expect(getConstraints(block, map)).toBe(CARD_CONSTRAINTS);
    });
  });

  describe("DEFAULT_GRID_COLUMNS", () => {
    it("is 36", () => {
      expect(DEFAULT_GRID_COLUMNS).toBe(36);
    });
  });
});
