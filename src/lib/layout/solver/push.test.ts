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
    it("pushes in the direction of movement (right)", () => {
      const blocks = [
        block("source", 5, 0, 10, 10),
        block("target", 10, 0, 10, 10),
      ];
      // Source moved from x=0 to x=5 (moving right)
      const source = block("source", 5, 0, 10, 10);
      const originalPosition = { x: 0, y: 0, w: 10, h: 10 };

      const result = pushBlocksForMove(source, originalPosition, blocks, {
        gridColumns: DEFAULT_GRID_COLUMNS,
        constraints: buildConstraintsMap(blocks),
      });

      expect(result.success).toBe(true);
      const target = result.blocks.find((b) => b.id === "target")!;
      expect(target.position.x).toBe(15); // Pushed right
    });

    it("pushes in the direction of movement (up)", () => {
      const blocks = [
        block("source", 0, 5, 10, 10),
        block("target", 0, 0, 10, 10),
      ];
      // Source moved from y=10 to y=5 (moving up)
      const source = block("source", 0, 5, 10, 10);
      const originalPosition = { x: 0, y: 10, w: 10, h: 10 };

      const result = pushBlocksForMove(source, originalPosition, blocks, {
        gridColumns: DEFAULT_GRID_COLUMNS,
        constraints: buildConstraintsMap(blocks),
      });

      expect(result.success).toBe(true);
      const target = result.blocks.find((b) => b.id === "target")!;
      // Target should be pushed up, but may be shrunk if at boundary
      expect(target.position.y + target.position.h).toBeLessThanOrEqual(5);
    });

    it("pushes in the direction of movement (down)", () => {
      const blocks = [
        block("source", 0, 5, 10, 10),
        block("target", 0, 10, 10, 10),
      ];
      // Source moved from y=0 to y=5 (moving down)
      const source = block("source", 0, 5, 10, 10);
      const originalPosition = { x: 0, y: 0, w: 10, h: 10 };

      const result = pushBlocksForMove(source, originalPosition, blocks, {
        gridColumns: DEFAULT_GRID_COLUMNS,
        constraints: buildConstraintsMap(blocks),
      });

      expect(result.success).toBe(true);
      const target = result.blocks.find((b) => b.id === "target")!;
      expect(target.position.y).toBe(15); // Pushed down
    });

    it("handles no movement", () => {
      const blocks = [
        block("source", 0, 0, 10, 10),
        block("target", 15, 0, 10, 10),
      ];
      const source = blocks[0];
      const originalPosition = source.position;

      const result = pushBlocksForMove(source, originalPosition, blocks, {
        gridColumns: DEFAULT_GRID_COLUMNS,
        constraints: buildConstraintsMap(blocks),
      });

      expect(result.success).toBe(true);
      expect(result.pushedIds.size).toBe(0);
    });

    it("wraps block that cannot be pushed further (horizontal)", () => {
      // Heading at x=0, full width, can't be shrunk horizontally
      // Card moves left into heading - heading should wrap below
      const heading = { id: "heading", kind: "heading" as const, position: { x: 0, y: 0, w: 36, h: 2 } };
      const card = { id: "card", kind: "card" as const, position: { x: 10, y: 0, w: 18, h: 8 } };
      const blocks = [heading, card];

      // Card moves to x=0 (moving left)
      const movedCard = { ...card, position: { ...card.position, x: 0 } };
      const originalPosition = card.position;

      const result = pushBlocksForMove(movedCard, originalPosition, blocks, {
        gridColumns: DEFAULT_GRID_COLUMNS,
        constraints: buildConstraintsMap(blocks),
      });

      expect(result.success).toBe(true);
      const resultHeading = result.blocks.find((b) => b.id === "heading")!;
      // Heading should be wrapped to below the card (not pushed left, not shrunk)
      expect(resultHeading.position.y).toBeGreaterThanOrEqual(8);
    });

    it("wraps block that cannot be pushed up (vertical)", () => {
      // Heading at y=0, can't go up
      const heading = { id: "heading", kind: "heading" as const, position: { x: 0, y: 0, w: 36, h: 2 } };
      const card = { id: "card", kind: "card" as const, position: { x: 0, y: 10, w: 18, h: 8 } };
      const blocks = [heading, card];

      // Card moves up to y=0 (collides with heading)
      const movedCard = { ...card, position: { ...card.position, y: 0 } };
      const originalPosition = card.position;

      const result = pushBlocksForMove(movedCard, originalPosition, blocks, {
        gridColumns: DEFAULT_GRID_COLUMNS,
        constraints: buildConstraintsMap(blocks),
      });

      expect(result.success).toBe(true);
      const resultHeading = result.blocks.find((b) => b.id === "heading")!;
      const resultCard = result.blocks.find((b) => b.id === "card")!;
      // Heading should be wrapped below the card
      expect(resultHeading.position.y).toBeGreaterThanOrEqual(resultCard.position.h);
    });

    it("handles diagonal movement (both axes)", () => {
      // Block in the way of diagonal movement
      const blocks = [
        block("source", 0, 0, 10, 10),
        block("target", 8, 8, 10, 10), // Overlaps diagonally
      ];

      // Source moves to (5, 5) - diagonal movement
      const source = block("source", 5, 5, 10, 10);
      const originalPosition = { x: 0, y: 0, w: 10, h: 10 };

      const result = pushBlocksForMove(source, originalPosition, blocks, {
        gridColumns: DEFAULT_GRID_COLUMNS,
        constraints: buildConstraintsMap(blocks),
      });

      expect(result.success).toBe(true);
      const target = result.blocks.find((b) => b.id === "target")!;
      // Target should be pushed away (either right or down or both)
      const noCollision = 
        target.position.x >= 15 || // Pushed right
        target.position.y >= 15;   // Pushed down
      expect(noCollision).toBe(true);
    });

    it("respects allowShrink=false option", () => {
      const blocks = [
        block("source", 0, 0, 10, 10),
        block("target", 28, 0, 10, 10), // Near right edge
      ];

      // Source moves right, would push target past boundary
      const source = block("source", 25, 0, 10, 10);
      const originalPosition = { x: 0, y: 0, w: 10, h: 10 };

      const result = pushBlocksForMove(source, originalPosition, blocks, {
        gridColumns: DEFAULT_GRID_COLUMNS,
        constraints: buildConstraintsMap(blocks),
        allowShrink: false,
      });

      expect(result.success).toBe(true);
      const target = result.blocks.find((b) => b.id === "target")!;
      // Target should be wrapped (pushed down) instead of shrunk
      // since allowShrink=false
      expect(target.position.y).toBeGreaterThan(0);
    });

    describe("regression tests", () => {
      it("wrapping should not cause collisions with other blocks", () => {
        // Heading A at 0,0 (36x2), card B at 1,3 (18x22), card C at 1,24 (18x8)
        // Moving B up by 1 to 1,2 should:
        // - Push heading A (can't go up, so wrap below B)
        // - Heading should go below B at y=24, but C is there at 1,24
        // - So heading should go below C or C should be pushed
        const headingA = { id: "A", kind: "heading" as const, position: { x: 0, y: 0, w: 36, h: 2 } };
        const cardB = { id: "B", kind: "card" as const, position: { x: 1, y: 3, w: 18, h: 22 } };
        const cardC = { id: "C", kind: "card" as const, position: { x: 1, y: 24, w: 18, h: 8 } };
        const blocks = [headingA, cardB, cardC];

        // B moves from (1,3) to (1,2)
        const movedB = { ...cardB, position: { ...cardB.position, y: 2 } };
        const originalPosition = cardB.position;

        const result = pushBlocksForMove(movedB, originalPosition, blocks, {
          gridColumns: DEFAULT_GRID_COLUMNS,
          constraints: buildConstraintsMap(blocks),
        });

        expect(result.success).toBe(true);

        // Log positions for debugging
        console.log("After move B from y=3 to y=2:");
        for (const b of result.blocks) {
          console.log(`  ${b.id}: x=${b.position.x}, y=${b.position.y}, w=${b.position.w}, h=${b.position.h}`);
        }

        // Check no collisions in result
        const resultBlocks = result.blocks;
        for (let i = 0; i < resultBlocks.length; i++) {
          for (let j = i + 1; j < resultBlocks.length; j++) {
            const a = resultBlocks[i].position;
            const b = resultBlocks[j].position;
            const intersects = 
              a.x < b.x + b.w && a.x + a.w > b.x &&
              a.y < b.y + b.h && a.y + a.h > b.y;
            expect(intersects).toBe(false);
          }
        }
      });

      it("exact scenario: heading 0,0, card 1,3, card 1,24 - move card up to y=1", () => {
        // Moving cardA to y=1 will collide with heading (heading occupies y=[0,2))
        const heading = { id: "heading", kind: "heading" as const, position: { x: 0, y: 0, w: 36, h: 2 } };
        const cardA = { id: "cardA", kind: "card" as const, position: { x: 1, y: 3, w: 18, h: 22 } };
        const cardB = { id: "cardB", kind: "card" as const, position: { x: 1, y: 25, w: 18, h: 8 } };
        // Note: cardA ends at y=25, cardB starts at y=25, so NO overlap initially
        
        const blocks = [heading, cardA, cardB];

        // Move cardA from (1,3) to (1,1) - into the heading
        const movedCardA = { ...cardA, position: { ...cardA.position, y: 1 } };
        const originalPosition = cardA.position;

        const result = pushBlocksForMove(movedCardA, originalPosition, blocks, {
          gridColumns: DEFAULT_GRID_COLUMNS,
          constraints: buildConstraintsMap(blocks),
        });

        expect(result.success).toBe(true);

        console.log("\nMove cardA to y=1 (collides with heading):");
        for (const b of result.blocks) {
          console.log(`  ${b.id}: x=${b.position.x}, y=${b.position.y}, w=${b.position.w}, h=${b.position.h}`);
        }

        // The heading should be wrapped below cardA (which now ends at y=23)
        const resultHeading = result.blocks.find(b => b.id === "heading")!;
        const resultCardA = result.blocks.find(b => b.id === "cardA")!;
        
        // Heading should be at or below cardA's bottom
        expect(resultHeading.position.y).toBeGreaterThanOrEqual(resultCardA.position.y + resultCardA.position.h);
        
        // And there should be no collisions
        const resultBlocks = result.blocks;
        for (let i = 0; i < resultBlocks.length; i++) {
          for (let j = i + 1; j < resultBlocks.length; j++) {
            const a = resultBlocks[i].position;
            const bPos = resultBlocks[j].position;
            const intersects = 
              a.x < bPos.x + bPos.w && a.x + a.w > bPos.x &&
              a.y < bPos.y + bPos.h && a.y + a.h > bPos.y;
            if (intersects) {
              console.log(`COLLISION: ${resultBlocks[i].id} and ${resultBlocks[j].id}`);
            }
            expect(intersects).toBe(false);
          }
        }
      });

      it("BUG: moving card to y=2 should NOT affect heading at y=0", () => {
        // This is the actual bug: when card moves to y=2, it does NOT collide
        // with heading (which occupies y=[0,2)). The heading should NOT move!
        const heading = { id: "heading", kind: "heading" as const, position: { x: 0, y: 0, w: 36, h: 2 } };
        const cardA = { id: "cardA", kind: "card" as const, position: { x: 1, y: 3, w: 18, h: 22 } };
        const cardB = { id: "cardB", kind: "card" as const, position: { x: 1, y: 25, w: 18, h: 8 } };
        
        const blocks = [heading, cardA, cardB];

        // Move cardA from (1,3) to (1,2) - does NOT collide with heading
        const movedCardA = { ...cardA, position: { ...cardA.position, y: 2 } };
        const originalPosition = cardA.position;

        const result = pushBlocksForMove(movedCardA, originalPosition, blocks, {
          gridColumns: DEFAULT_GRID_COLUMNS,
          constraints: buildConstraintsMap(blocks),
        });

        expect(result.success).toBe(true);

        console.log("\nMove cardA to y=2 (NO collision with heading):");
        for (const b of result.blocks) {
          console.log(`  ${b.id}: x=${b.position.x}, y=${b.position.y}, w=${b.position.w}, h=${b.position.h}`);
        }

        // The heading should NOT have moved!
        const resultHeading = result.blocks.find(b => b.id === "heading")!;
        expect(resultHeading.position.y).toBe(0); // Should still be at y=0
        expect(resultHeading.position.x).toBe(0); // Should still be at x=0
      });

      it("moving card up should not affect unrelated cards on same row", () => {
        // Heading A at 1,1 (36x2), card B at 19,3 (18x11), card C at 19,14 (18x11)
        // Card D at 1,3 (18x22), card E at 1,25 (18x8)
        // Moving C up by 1 to 19,13 should NOT move A to overlap with D or E
        const headingA = { id: "A", kind: "heading" as const, position: { x: 1, y: 1, w: 36, h: 2 } };
        const cardB = { id: "B", kind: "card" as const, position: { x: 19, y: 3, w: 18, h: 11 } };
        const cardC = { id: "C", kind: "card" as const, position: { x: 19, y: 14, w: 18, h: 11 } };
        const cardD = { id: "D", kind: "card" as const, position: { x: 1, y: 3, w: 18, h: 22 } };
        const cardE = { id: "E", kind: "card" as const, position: { x: 1, y: 25, w: 18, h: 8 } };
        const blocks = [headingA, cardB, cardC, cardD, cardE];

        // C moves from (19,14) to (19,13)
        const movedC = { ...cardC, position: { ...cardC.position, y: 13 } };
        const originalPosition = cardC.position;

        const result = pushBlocksForMove(movedC, originalPosition, blocks, {
          gridColumns: DEFAULT_GRID_COLUMNS,
          constraints: buildConstraintsMap(blocks),
        });

        expect(result.success).toBe(true);

        // C should NOT collide with B (B ends at y=14, C starts at y=13)
        // Actually C moving to y=13 DOES collide with B (y=3, h=11, so bottom=14)
        // So B should be pushed or wrapped
        
        // Most importantly: no collisions in final layout
        const resultBlocks = result.blocks;
        for (let i = 0; i < resultBlocks.length; i++) {
          for (let j = i + 1; j < resultBlocks.length; j++) {
            const a = resultBlocks[i].position;
            const b = resultBlocks[j].position;
            const intersects = 
              a.x < b.x + b.w && a.x + a.w > b.x &&
              a.y < b.y + b.h && a.y + a.h > b.y;
            if (intersects) {
              console.log(`Collision between ${resultBlocks[i].id} and ${resultBlocks[j].id}`);
              console.log(`  ${resultBlocks[i].id}: x=${a.x}, y=${a.y}, w=${a.w}, h=${a.h}`);
              console.log(`  ${resultBlocks[j].id}: x=${b.x}, y=${b.y}, w=${b.w}, h=${b.h}`);
            }
            expect(intersects).toBe(false);
          }
        }
      });
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
