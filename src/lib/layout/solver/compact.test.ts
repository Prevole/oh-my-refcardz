import { describe, expect, it } from "vitest";
import {
  compactBlocks,
  compactLayout,
  oppositeDirection,
  createCompactOptions,
} from "./compact";
import { DEFAULT_GRID_COLUMNS } from "./constraints";
import type { LayoutBlock } from "./types";

// Helper to create a block
function block(id: string, x: number, y: number, w: number, h: number): LayoutBlock {
  return { id, kind: "card", position: { x, y, w, h } };
}

describe("compact", () => {
  describe("oppositeDirection", () => {
    it("returns correct opposites", () => {
      expect(oppositeDirection("east")).toBe("west");
      expect(oppositeDirection("west")).toBe("east");
      expect(oppositeDirection("south")).toBe("north");
      expect(oppositeDirection("north")).toBe("south");
    });
  });

  describe("compactBlocks", () => {
    const options = { gridColumns: DEFAULT_GRID_COLUMNS };

    describe("east shrink (pull from right)", () => {
      it("pulls blocks to the left", () => {
        // shrunk at x=0, w=10 (shrunk from w=15)
        // neighbor at x=20, should pull toward x=10
        const shrunk = block("shrunk", 0, 0, 10, 5);
        const blocks = [
          shrunk,
          block("neighbor", 20, 0, 6, 5),
        ];

        const result = compactBlocks(shrunk, "east", blocks, options);

        expect(result.movedIds.has("neighbor")).toBe(true);
        const neighbor = result.blocks.find((b) => b.id === "neighbor")!;
        expect(neighbor.position.x).toBe(10); // Pulled to right edge of shrunk
      });

      it("does not pull blocks that would collide", () => {
        const shrunk = block("shrunk", 0, 0, 10, 5);
        const blocks = [
          shrunk,
          block("blocker", 10, 0, 6, 5), // Right next to shrunk
          block("neighbor", 20, 0, 6, 5), // Would collide with blocker if pulled
        ];

        const result = compactBlocks(shrunk, "east", blocks, options);

        // Neighbor can only pull until it hits blocker
        const neighbor = result.blocks.find((b) => b.id === "neighbor")!;
        expect(neighbor.position.x).toBe(16); // Pulled to right edge of blocker
      });

      it("does not move blocks not in the compact direction", () => {
        const shrunk = block("shrunk", 10, 0, 10, 5);
        const blocks = [
          shrunk,
          block("left", 0, 0, 6, 5), // To the left, not affected
          block("right", 25, 0, 6, 5), // To the right, affected
        ];

        const result = compactBlocks(shrunk, "east", blocks, options);

        expect(result.movedIds.has("left")).toBe(false);
        expect(result.movedIds.has("right")).toBe(true);
      });
    });

    describe("west shrink (pull from left)", () => {
      it("pulls blocks to the right", () => {
        // shrunk at x=20, w=10 (was at x=15, w=15)
        // neighbor at x=0, should pull toward x=10
        const shrunk = block("shrunk", 20, 0, 10, 5);
        const blocks = [
          shrunk,
          block("neighbor", 0, 0, 6, 5),
        ];

        const result = compactBlocks(shrunk, "west", blocks, options);

        expect(result.movedIds.has("neighbor")).toBe(true);
        const neighbor = result.blocks.find((b) => b.id === "neighbor")!;
        expect(neighbor.position.x).toBe(14); // Pulled so right edge is at shrunk's left edge
      });
    });

    describe("south shrink (pull from below)", () => {
      it("pulls blocks up", () => {
        const shrunk = block("shrunk", 0, 0, 10, 10);
        const blocks = [
          shrunk,
          block("neighbor", 0, 20, 10, 5),
        ];

        const result = compactBlocks(shrunk, "south", blocks, options);

        expect(result.movedIds.has("neighbor")).toBe(true);
        const neighbor = result.blocks.find((b) => b.id === "neighbor")!;
        expect(neighbor.position.y).toBe(10); // Pulled to bottom edge of shrunk
      });
    });

    describe("north shrink (pull from above)", () => {
      it("pulls blocks down", () => {
        const shrunk = block("shrunk", 0, 20, 10, 10);
        const blocks = [
          shrunk,
          block("neighbor", 0, 0, 10, 5),
        ];

        const result = compactBlocks(shrunk, "north", blocks, options);

        expect(result.movedIds.has("neighbor")).toBe(true);
        const neighbor = result.blocks.find((b) => b.id === "neighbor")!;
        expect(neighbor.position.y).toBe(15); // Pulled so bottom edge is at shrunk's top edge
      });
    });
  });

  describe("compactLayout", () => {
    it("moves blocks up and left to fill gaps", () => {
      const blocks = [
        block("a", 10, 10, 10, 10), // Has gap above and to the left
      ];

      const result = compactLayout(blocks);

      const a = result.blocks.find((b) => b.id === "a")!;
      expect(a.position.x).toBe(0);
      expect(a.position.y).toBe(0);
    });

    it("respects collisions", () => {
      const blocks = [
        block("a", 0, 0, 10, 10), // At origin
        block("b", 15, 15, 10, 10), // Has gap but blocked by a
      ];

      const result = compactLayout(blocks);

      const a = result.blocks.find((b) => b.id === "a")!;
      const b = result.blocks.find((b) => b.id === "b")!;

      // a stays at origin
      expect(a.position.x).toBe(0);
      expect(a.position.y).toBe(0);

      // b moves up as far as possible (to y=10, right below a's bottom)
      // But b is at x=15, so it can move to y=0 (no horizontal collision)
      expect(b.position.y).toBe(0);
      expect(b.position.x).toBe(10); // Can also move left to x=10 (a's right edge)
    });

    it("handles cascading compaction", () => {
      // Three blocks in a diagonal line with gaps
      const blocks = [
        block("a", 20, 20, 10, 10),
        block("b", 10, 10, 10, 10),
        block("c", 0, 0, 10, 10),
      ];

      const result = compactLayout(blocks);

      // All should compact toward origin
      const c = result.blocks.find((b) => b.id === "c")!;
      const b = result.blocks.find((b) => b.id === "b")!;
      const a = result.blocks.find((b) => b.id === "a")!;

      // c stays at origin
      expect(c.position.x).toBe(0);
      expect(c.position.y).toBe(0);

      // b can move to y=0 (row 0, next to c)
      expect(b.position.y).toBe(0);
      expect(b.position.x).toBe(10);

      // a can move to y=0 (row 0, next to b)
      expect(a.position.y).toBe(0);
      expect(a.position.x).toBe(20);
    });

    it("returns empty movedIds when nothing moves", () => {
      const blocks = [
        block("a", 0, 0, 10, 10),
        block("b", 10, 0, 10, 10),
      ];

      const result = compactLayout(blocks);

      expect(result.movedIds.size).toBe(0);
    });
  });

  describe("createCompactOptions", () => {
    it("creates options with default values", () => {
      const opts = createCompactOptions();
      expect(opts.gridColumns).toBe(DEFAULT_GRID_COLUMNS);
    });

    it("allows overrides", () => {
      const opts = createCompactOptions({ gridColumns: 24 });
      expect(opts.gridColumns).toBe(24);
    });
  });
});
