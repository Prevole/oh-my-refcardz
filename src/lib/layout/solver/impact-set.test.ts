import { describe, expect, it } from "vitest";
import {
  findPotentiallyImpacted,
  findDirectCollisions,
  computeImpactSet,
  computeFullImpactSet,
  getImpactedBlocks,
} from "./impact-set";
import type { LayoutBlock } from "./types";

// Helper to create a block
function block(id: string, x: number, y: number, w: number, h: number): LayoutBlock {
  return { id, kind: "card", position: { x, y, w, h } };
}

describe("impact-set", () => {
  describe("findPotentiallyImpacted", () => {
    const blocks = [
      block("a", 0, 0, 5, 5),
      block("b", 10, 0, 5, 5), // Same row as a
      block("c", 0, 10, 5, 5), // Same column as a
      block("d", 10, 10, 5, 5), // Different row and column
    ];

    describe("east direction", () => {
      it("finds blocks to the right that share rows", () => {
        const source = { x: 0, y: 0, w: 5, h: 5 };
        const result = findPotentiallyImpacted(source, "east", blocks);
        expect(result.map((b) => b.id)).toContain("b");
        expect(result.map((b) => b.id)).not.toContain("c");
        expect(result.map((b) => b.id)).not.toContain("d");
      });
    });

    describe("west direction", () => {
      it("finds blocks to the left that share rows", () => {
        const source = { x: 10, y: 0, w: 5, h: 5 };
        const result = findPotentiallyImpacted(source, "west", blocks);
        expect(result.map((b) => b.id)).toContain("a");
      });
    });

    describe("south direction", () => {
      it("finds blocks below that share columns", () => {
        const source = { x: 0, y: 0, w: 5, h: 5 };
        const result = findPotentiallyImpacted(source, "south", blocks);
        expect(result.map((b) => b.id)).toContain("c");
        expect(result.map((b) => b.id)).not.toContain("b");
      });
    });

    describe("north direction", () => {
      it("finds blocks above that share columns", () => {
        const source = { x: 0, y: 10, w: 5, h: 5 };
        const result = findPotentiallyImpacted(source, "north", blocks);
        expect(result.map((b) => b.id)).toContain("a");
      });
    });

    describe("move direction", () => {
      it("finds blocks that intersect with source", () => {
        const source = { x: 2, y: 2, w: 10, h: 10 };
        const result = findPotentiallyImpacted(source, "move", blocks);
        expect(result.map((b) => b.id)).toContain("a");
        expect(result.map((b) => b.id)).toContain("b");
        expect(result.map((b) => b.id)).toContain("c");
      });
    });

    it("excludes block by ID", () => {
      const source = { x: 0, y: 0, w: 20, h: 20 };
      const result = findPotentiallyImpacted(source, "move", blocks, "a");
      expect(result.map((b) => b.id)).not.toContain("a");
    });
  });

  describe("findDirectCollisions", () => {
    it("finds blocks that intersect with the new position", () => {
      const blocks = [
        block("a", 0, 0, 10, 10),
        block("b", 15, 0, 10, 10),
        block("c", 30, 0, 10, 10),
      ];
      const newPosition = { x: 5, y: 0, w: 15, h: 10 };

      const collisions = findDirectCollisions(newPosition, blocks, "source");
      expect(collisions.map((b) => b.id)).toEqual(["a", "b"]);
    });

    it("excludes the source block", () => {
      const blocks = [
        block("source", 0, 0, 10, 10),
        block("other", 5, 0, 10, 10),
      ];
      const newPosition = { x: 0, y: 0, w: 10, h: 10 };

      const collisions = findDirectCollisions(newPosition, blocks, "source");
      expect(collisions.map((b) => b.id)).toEqual(["other"]);
    });
  });

  describe("computeImpactSet", () => {
    it("returns empty set for no initial impacts", () => {
      const blocks = [block("a", 0, 0, 5, 5)];
      const result = computeImpactSet([], "east", blocks, "source");
      expect(result.size).toBe(0);
    });

    it("includes initial impacted blocks", () => {
      const blocks = [
        block("a", 0, 0, 5, 5),
        block("b", 10, 0, 5, 5),
      ];
      const result = computeImpactSet([blocks[0]], "east", blocks, "source");
      expect(result.has("a")).toBe(true);
    });

    it("computes transitive closure", () => {
      // Layout: [source] [a] [b] [c]
      // Pushing source east should impact a, which impacts b, which impacts c
      const blocks = [
        block("a", 5, 0, 5, 5),
        block("b", 10, 0, 5, 5),
        block("c", 15, 0, 5, 5),
      ];

      const result = computeImpactSet([blocks[0]], "east", blocks, "source");

      expect(result.has("a")).toBe(true);
      expect(result.has("b")).toBe(true);
      expect(result.has("c")).toBe(true);
    });

    it("handles wider blocks causing cascading impacts", () => {
      // Block a is narrow, block b is wide
      // [source] [a] [b (wide)]
      //               [c]
      // Pushing a east hits b, which is wide enough to also hit c
      const blocks = [
        block("a", 5, 0, 5, 5),
        block("b", 10, 0, 10, 5), // Wide block
        block("c", 15, 0, 5, 5), // Would be hit if b is pushed
      ];

      const result = computeImpactSet([blocks[0]], "east", blocks, "source");

      expect(result.has("a")).toBe(true);
      expect(result.has("b")).toBe(true);
      expect(result.has("c")).toBe(true);
    });

    it("does not include source block", () => {
      const blocks = [
        block("source", 0, 0, 5, 5),
        block("a", 5, 0, 5, 5),
      ];

      const result = computeImpactSet([blocks[1]], "east", blocks, "source");

      expect(result.has("source")).toBe(false);
    });
  });

  describe("computeFullImpactSet", () => {
    it("returns empty set when no collisions", () => {
      const blocks = [
        block("source", 0, 0, 5, 5),
        block("a", 20, 0, 5, 5),
      ];
      const newPosition = { x: 5, y: 0, w: 5, h: 5 };

      const result = computeFullImpactSet("source", newPosition, "east", blocks);
      expect(result.size).toBe(0);
    });

    it("computes full impact set including transitive impacts", () => {
      // [source moving here] [a] [b]
      const blocks = [
        block("source", 0, 0, 5, 5),
        block("a", 5, 0, 5, 5),
        block("b", 10, 0, 5, 5),
      ];
      const newPosition = { x: 3, y: 0, w: 5, h: 5 }; // Overlaps with a

      const result = computeFullImpactSet("source", newPosition, "east", blocks);

      expect(result.has("a")).toBe(true);
      expect(result.has("b")).toBe(true);
    });
  });

  describe("getImpactedBlocks", () => {
    it("returns blocks in the impact set", () => {
      const blocks = [
        block("a", 0, 0, 5, 5),
        block("b", 10, 0, 5, 5),
        block("c", 20, 0, 5, 5),
      ];
      const impactSet = new Set(["a", "c"]);

      const result = getImpactedBlocks(impactSet, blocks);

      expect(result.map((b) => b.id)).toEqual(["a", "c"]);
    });
  });
});
