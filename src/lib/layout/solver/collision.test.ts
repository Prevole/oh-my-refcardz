import { describe, expect, it } from "vitest";
import {
  findCollisions,
  findCollisionsAtPosition,
  hasCollision,
  hasAnyCollision,
  findAllCollisions,
  excludeBlock,
  getBlockById,
  replaceBlock,
  replaceBlocks,
} from "./collision";
import type { LayoutBlock } from "./types";

// Helper to create a block
function block(id: string, x: number, y: number, w: number, h: number): LayoutBlock {
  return { id, kind: "card", position: { x, y, w, h } };
}

describe("collision", () => {
  describe("findCollisions", () => {
    it("finds blocks that overlap", () => {
      const target = block("target", 5, 5, 10, 10);
      const others = [
        block("a", 0, 0, 10, 10), // overlaps
        block("b", 20, 0, 10, 10), // no overlap
        block("c", 10, 10, 10, 10), // overlaps
      ];

      const collisions = findCollisions(target, others);
      expect(collisions.map((b) => b.id)).toEqual(["a", "c"]);
    });

    it("returns empty array when no collisions", () => {
      const target = block("target", 0, 0, 5, 5);
      const others = [
        block("a", 10, 0, 5, 5),
        block("b", 0, 10, 5, 5),
      ];

      expect(findCollisions(target, others)).toEqual([]);
    });

    it("excludes the target block itself", () => {
      const target = block("target", 0, 0, 10, 10);
      const others = [target, block("a", 5, 5, 10, 10)];

      const collisions = findCollisions(target, others);
      expect(collisions.map((b) => b.id)).toEqual(["a"]);
    });
  });

  describe("findCollisionsAtPosition", () => {
    it("finds blocks at the given position", () => {
      const position = { x: 5, y: 5, w: 10, h: 10 };
      const blocks = [
        block("a", 0, 0, 10, 10), // overlaps
        block("b", 20, 0, 10, 10), // no overlap
      ];

      const collisions = findCollisionsAtPosition(position, blocks);
      expect(collisions.map((b) => b.id)).toEqual(["a"]);
    });

    it("excludes the specified block ID", () => {
      const position = { x: 0, y: 0, w: 10, h: 10 };
      const blocks = [
        block("a", 0, 0, 10, 10),
        block("b", 5, 5, 10, 10),
      ];

      const collisions = findCollisionsAtPosition(position, blocks, "a");
      expect(collisions.map((b) => b.id)).toEqual(["b"]);
    });
  });

  describe("hasCollision", () => {
    it("returns true when collision exists", () => {
      const target = block("target", 5, 5, 10, 10);
      const others = [block("a", 0, 0, 10, 10)];

      expect(hasCollision(target, others)).toBe(true);
    });

    it("returns false when no collision", () => {
      const target = block("target", 0, 0, 5, 5);
      const others = [block("a", 10, 10, 5, 5)];

      expect(hasCollision(target, others)).toBe(false);
    });
  });

  describe("hasAnyCollision", () => {
    it("returns true when any blocks overlap", () => {
      const blocks = [
        block("a", 0, 0, 10, 10),
        block("b", 5, 5, 10, 10), // overlaps with a
        block("c", 30, 30, 5, 5),
      ];

      expect(hasAnyCollision(blocks)).toBe(true);
    });

    it("returns false when no blocks overlap", () => {
      const blocks = [
        block("a", 0, 0, 5, 5),
        block("b", 10, 0, 5, 5),
        block("c", 0, 10, 5, 5),
      ];

      expect(hasAnyCollision(blocks)).toBe(false);
    });

    it("returns false for empty array", () => {
      expect(hasAnyCollision([])).toBe(false);
    });

    it("returns false for single block", () => {
      expect(hasAnyCollision([block("a", 0, 0, 10, 10)])).toBe(false);
    });
  });

  describe("findAllCollisions", () => {
    it("finds all collision pairs", () => {
      const blocks = [
        block("a", 0, 0, 10, 10),
        block("b", 5, 5, 10, 10), // overlaps with a
        block("c", 8, 8, 10, 10), // overlaps with a and b
      ];

      const collisions = findAllCollisions(blocks);

      expect(collisions).toHaveLength(3);
      expect(collisions.map(([x, y]) => [x.id, y.id])).toContainEqual(["a", "b"]);
      expect(collisions.map(([x, y]) => [x.id, y.id])).toContainEqual(["a", "c"]);
      expect(collisions.map(([x, y]) => [x.id, y.id])).toContainEqual(["b", "c"]);
    });

    it("returns empty array when no collisions", () => {
      const blocks = [
        block("a", 0, 0, 5, 5),
        block("b", 10, 0, 5, 5),
      ];

      expect(findAllCollisions(blocks)).toEqual([]);
    });
  });

  describe("excludeBlock", () => {
    it("returns array without the specified block", () => {
      const blocks = [
        block("a", 0, 0, 5, 5),
        block("b", 10, 0, 5, 5),
        block("c", 20, 0, 5, 5),
      ];

      const result = excludeBlock(blocks, "b");
      expect(result.map((b) => b.id)).toEqual(["a", "c"]);
    });

    it("returns copy if block not found", () => {
      const blocks = [block("a", 0, 0, 5, 5)];
      const result = excludeBlock(blocks, "nonexistent");

      expect(result).toEqual(blocks);
      expect(result).not.toBe(blocks); // New array
    });
  });

  describe("getBlockById", () => {
    it("returns the block with matching ID", () => {
      const blocks = [
        block("a", 0, 0, 5, 5),
        block("b", 10, 0, 5, 5),
      ];

      expect(getBlockById(blocks, "b")).toBe(blocks[1]);
    });

    it("returns undefined if not found", () => {
      const blocks = [block("a", 0, 0, 5, 5)];
      expect(getBlockById(blocks, "nonexistent")).toBeUndefined();
    });
  });

  describe("replaceBlock", () => {
    it("replaces block with matching ID", () => {
      const blocks = [
        block("a", 0, 0, 5, 5),
        block("b", 10, 0, 5, 5),
      ];
      const newB = block("b", 20, 20, 10, 10);

      const result = replaceBlock(blocks, newB);

      expect(result[0]).toBe(blocks[0]);
      expect(result[1]).toBe(newB);
      expect(blocks[1].position.x).toBe(10); // Original unchanged
    });

    it("appends if block not found", () => {
      const blocks = [block("a", 0, 0, 5, 5)];
      const newC = block("c", 20, 20, 5, 5);

      const result = replaceBlock(blocks, newC);

      expect(result).toHaveLength(2);
      expect(result[1]).toBe(newC);
    });
  });

  describe("replaceBlocks", () => {
    it("replaces multiple blocks", () => {
      const blocks = [
        block("a", 0, 0, 5, 5),
        block("b", 10, 0, 5, 5),
        block("c", 20, 0, 5, 5),
      ];
      const newBlocks = [
        block("a", 1, 1, 6, 6),
        block("c", 21, 21, 6, 6),
      ];

      const result = replaceBlocks(blocks, newBlocks);

      expect(result[0].position.x).toBe(1);
      expect(result[1].position.x).toBe(10); // unchanged
      expect(result[2].position.x).toBe(21);
    });

    it("keeps blocks not in newBlocks", () => {
      const blocks = [
        block("a", 0, 0, 5, 5),
        block("b", 10, 0, 5, 5),
      ];

      const result = replaceBlocks(blocks, []);

      expect(result).toEqual(blocks);
    });
  });
});
