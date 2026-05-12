import { describe, expect, it } from "vitest";
import {
  pushBlocks,
  pushBlocksForMove,
  createPushOptions,
  type PushOptions,
} from "./push";
import { buildConstraintsMap, DEFAULT_GRID_COLUMNS } from "./constraints";
import type { LayoutBlock } from "./types";

// Helper to create a block
function block(id: string, x: number, y: number, w: number, h: number): LayoutBlock {
  return { id, kind: "card", position: { x, y, w, h } };
}

// Helper to create options
function options(blocks: LayoutBlock[], overrides?: Partial<PushOptions>): PushOptions {
  return {
    gridColumns: DEFAULT_GRID_COLUMNS,
    constraints: buildConstraintsMap(blocks),
    allowShrink: true,
    ...overrides,
  };
}

describe("push", () => {
  describe("pushBlocks", () => {
    describe("east direction", () => {
      it("pushes a single block to the right", () => {
        const blocks = [
          block("source", 0, 0, 10, 10),
          block("target", 5, 0, 10, 10), // Overlaps with source
        ];
        const source = block("source", 0, 0, 10, 10);

        const result = pushBlocks(source, "east", blocks, options(blocks));

        expect(result.success).toBe(true);
        const target = result.blocks.find((b) => b.id === "target")!;
        expect(target.position.x).toBe(10); // Pushed to right edge of source
      });

      it("pushes multiple blocks transitively", () => {
        const blocks = [
          block("source", 0, 0, 10, 5),
          block("a", 5, 0, 10, 5), // Overlaps with source
          block("b", 12, 0, 10, 5), // Overlaps with a after push
        ];
        const source = block("source", 0, 0, 10, 5);

        const result = pushBlocks(source, "east", blocks, options(blocks));

        expect(result.success).toBe(true);
        expect(result.pushedIds.has("a")).toBe(true);
        expect(result.pushedIds.has("b")).toBe(true);

        const a = result.blocks.find((b) => b.id === "a")!;
        const b = result.blocks.find((b) => b.id === "b")!;
        expect(a.position.x).toBe(10);
        expect(b.position.x).toBe(20); // Pushed by a
      });

      it("shrinks block at right boundary", () => {
        // source at x=26, w=10 → right=36 (at grid edge)
        // target at x=30, w=10 → right=40 (4 past grid)
        // Push distance: 36 - 30 = 6
        // Target pushed to x=36, w=10 → right=46
        // Shrink needed: 46 - 36 = 10
        // But minW is 6, so can only shrink by 4
        // This won't work - let's use smaller blocks

        // source at x=28, w=6 → right=34
        // target at x=32, w=8 → right=40 (4 past grid)
        // Push distance: 34 - 32 = 2
        // Target pushed to x=34, w=8 → right=42
        // Shrink needed: 42 - 36 = 6
        // Can shrink from w=8 to w=6 (minW=6), shrink by 2
        // Still not enough!

        // Let's try:
        // source at x=28, w=4 → right=32 (but minW is 6, so we need w=6)
        // Actually, for cards minW=6

        // source at x=26, w=6 → right=32
        // target at x=30, w=8 → right=38 (2 past grid)
        // Push distance: 32 - 30 = 2
        // Target pushed to x=32, w=8 → right=40
        // Shrink needed: 40 - 36 = 4
        // Can shrink from w=8 to w=6, shrink by 2
        // Still not enough!

        // Simpler: just need a small overlap that results in small shrink
        // source at x=28, w=6 → right=34
        // target at x=33, w=6 → right=39 (3 past grid)
        // Push distance: 34 - 33 = 1
        // Target pushed to x=34, w=6 → right=40
        // Shrink needed: 40 - 36 = 4, but w is already minW=6
        // Can't shrink!

        // We need a block that can actually be shrunk.
        // target with w > minW, and the shrink amount <= w - minW
        // source at x=28, w=6 → right=34
        // target at x=32, w=10 → right=42 (6 past grid)
        // Push distance: 34 - 32 = 2
        // Target pushed to x=34, w=10 → right=44
        // Shrink needed: 44 - 36 = 8
        // Can shrink from w=10 to w=6 (minW), shrink by 4
        // Still not enough! (need 8, can only do 4)

        // The math is hard. Let's make it simpler:
        // We need shrink_amount <= original_w - minW
        // And shrink_amount = (pushed_x + w) - gridColumns
        // pushed_x = original_x + push_distance
        // push_distance = right(source) - original_x

        // For it to work:
        // (original_x + push_distance + w) - 36 <= w - 6
        // original_x + push_distance <= 30

        // Let's try:
        // source at x=20, w=6 → right=26
        // target at x=24, w=10 → right=34 (within grid)
        // Push distance: 26 - 24 = 2
        // Target pushed to x=26, w=10 → right=36 (exactly at edge)
        // No shrink needed!

        // For shrink, we need to exceed:
        // source at x=24, w=6 → right=30
        // target at x=28, w=10 → right=38 (2 past grid)
        // Push distance: 30 - 28 = 2
        // Target pushed to x=30, w=10 → right=40
        // Shrink needed: 40 - 36 = 4
        // Can shrink from 10 to 6, i.e. by 4. Exactly!

        const blocks = [
          block("source", 24, 0, 6, 5),
          block("target", 28, 0, 10, 5),
        ];
        const source = blocks[0];

        const result = pushBlocks(source, "east", blocks, options(blocks));

        expect(result.success).toBe(true);
        expect(result.shrunkIds.has("target")).toBe(true);

        const target = result.blocks.find((b) => b.id === "target")!;
        expect(target.position.x + target.position.w).toBeLessThanOrEqual(36);
        expect(target.position.w).toBe(6); // Shrunk to minW
      });

      it("fails when shrinking is not allowed and boundary exceeded", () => {
        const blocks = [
          block("source", 26, 0, 10, 5),
          block("target", 28, 0, 10, 5),
        ];
        const source = blocks[0];

        const result = pushBlocks(source, "east", blocks, options(blocks, { allowShrink: false }));

        expect(result.success).toBe(false);
        expect(result.blockedReason).toContain("exceed grid boundary");
      });

      it("fails when block cannot be shrunk enough", () => {
        // Target is at minW already
        const blocks = [
          block("source", 28, 0, 10, 5),
          block("target", 30, 0, 6, 5), // minW is 6
        ];
        const source = blocks[0];

        const result = pushBlocks(source, "east", blocks, options(blocks));

        expect(result.success).toBe(false);
        expect(result.blockedReason).toContain("cannot be shrunk");
      });
    });

    describe("west direction", () => {
      it("pushes a single block to the left", () => {
        const blocks = [
          block("source", 10, 0, 10, 10),
          block("target", 5, 0, 10, 10), // Overlaps with source
        ];
        const source = block("source", 10, 0, 10, 10);

        const result = pushBlocks(source, "west", blocks, options(blocks));

        expect(result.success).toBe(true);
        const target = result.blocks.find((b) => b.id === "target")!;
        expect(target.position.x + target.position.w).toBe(10); // Right edge at source's left
      });

      it("fails at left boundary when shrinking not possible", () => {
        const blocks = [
          block("source", 4, 0, 10, 5),
          block("target", 0, 0, 6, 5), // At left edge, can't shrink more
        ];
        const source = blocks[0];

        const result = pushBlocks(source, "west", blocks, options(blocks));

        expect(result.success).toBe(false);
      });
    });

    describe("south direction", () => {
      it("pushes blocks down without shrinking", () => {
        const blocks = [
          block("source", 0, 0, 10, 10),
          block("target", 0, 5, 10, 10), // Overlaps with source
        ];
        const source = block("source", 0, 0, 10, 10);

        const result = pushBlocks(source, "south", blocks, options(blocks));

        expect(result.success).toBe(true);
        const target = result.blocks.find((b) => b.id === "target")!;
        expect(target.position.y).toBe(10); // Pushed below source
      });

      it("always succeeds going down (no boundary)", () => {
        const blocks = [
          block("source", 0, 100, 10, 10),
          block("target", 0, 105, 10, 10),
        ];
        const source = blocks[0];

        const result = pushBlocks(source, "south", blocks, options(blocks, { allowShrink: false }));

        expect(result.success).toBe(true);
      });
    });

    describe("north direction", () => {
      it("pushes blocks up", () => {
        const blocks = [
          block("source", 0, 10, 10, 10),
          block("target", 0, 5, 10, 10), // Overlaps with source
        ];
        const source = block("source", 0, 10, 10, 10);

        const result = pushBlocks(source, "north", blocks, options(blocks));

        expect(result.success).toBe(true);
        const target = result.blocks.find((b) => b.id === "target")!;
        expect(target.position.y + target.position.h).toBe(10); // Bottom at source's top
      });

      it("fails at top boundary", () => {
        const blocks = [
          block("source", 0, 2, 10, 10),
          block("target", 0, 0, 10, 4), // At top, can't shrink below minH=4
        ];
        const source = blocks[0];

        const result = pushBlocks(source, "north", blocks, options(blocks));

        expect(result.success).toBe(false);
      });
    });

    it("tracks pushed block IDs", () => {
      const blocks = [
        block("source", 0, 0, 10, 5),
        block("a", 5, 0, 5, 5),
        block("b", 8, 0, 5, 5),
        block("c", 20, 0, 5, 5), // Not affected
      ];
      const source = blocks[0];

      const result = pushBlocks(source, "east", blocks, options(blocks));

      expect(result.pushedIds.has("a")).toBe(true);
      expect(result.pushedIds.has("b")).toBe(true);
      expect(result.pushedIds.has("c")).toBe(false);
    });
  });

  describe("pushBlocksForMove", () => {
    it("prefers pushing right", () => {
      const blocks = [
        block("source", 5, 0, 10, 10),
        block("target", 10, 0, 10, 10),
      ];
      const source = block("source", 5, 0, 10, 10);

      const result = pushBlocksForMove(source, blocks, {
        gridColumns: DEFAULT_GRID_COLUMNS,
        constraints: buildConstraintsMap(blocks),
      });

      expect(result.success).toBe(true);
      const target = result.blocks.find((b) => b.id === "target")!;
      expect(target.position.x).toBe(15); // Pushed right
    });

    it("falls back to pushing down when right fails", () => {
      // Create a situation where right push fails
      const blocks = [
        block("source", 24, 0, 10, 5),
        block("target", 30, 0, 6, 5), // At right edge, minW
      ];
      const source = blocks[0];

      // This first call may or may not succeed depending on the geometry
      pushBlocksForMove(source, blocks, {
        gridColumns: DEFAULT_GRID_COLUMNS,
        constraints: buildConstraintsMap(blocks),
      });

      // Should try down, which always succeeds
      // Note: in this case down might not help if they don't overlap vertically
      // Let's make them overlap more clearly
      const blocks2 = [
        block("source", 0, 0, 36, 5), // Full width
        block("target", 0, 2, 36, 5), // Overlaps vertically
      ];
      const source2 = blocks2[0];

      const result2 = pushBlocksForMove(source2, blocks2, {
        gridColumns: DEFAULT_GRID_COLUMNS,
        constraints: buildConstraintsMap(blocks2),
      });

      expect(result2.success).toBe(true);
    });
  });

  describe("createPushOptions", () => {
    it("creates options with default values", () => {
      const blocks = [block("a", 0, 0, 10, 10)];
      const opts = createPushOptions(blocks);

      expect(opts.gridColumns).toBe(DEFAULT_GRID_COLUMNS);
      expect(opts.allowShrink).toBe(true);
      expect(opts.constraints.size).toBe(1);
    });

    it("allows overrides", () => {
      const blocks = [block("a", 0, 0, 10, 10)];
      const opts = createPushOptions(blocks, { gridColumns: 24, allowShrink: false });

      expect(opts.gridColumns).toBe(24);
      expect(opts.allowShrink).toBe(false);
    });
  });
});
