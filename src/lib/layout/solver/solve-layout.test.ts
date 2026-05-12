import { describe, expect, it } from "vitest";
import {
  solveLayout,
  createSolverOptions,
  createMoveIntent,
  createResizeIntent,
} from "./solve-layout";
import { DEFAULT_GRID_COLUMNS } from "./constraints";
import type { LayoutBlock } from "./types";

// Helper to create a block
function block(id: string, x: number, y: number, w: number, h: number): LayoutBlock {
  return { id, kind: "card", position: { x, y, w, h } };
}

function heading(id: string, x: number, y: number, w: number, h: number): LayoutBlock {
  return { id, kind: "heading", position: { x, y, w, h } };
}

describe("solve-layout", () => {
  describe("solveLayout - move", () => {
    it("moves a block to an empty position", () => {
      const blocks = [
        block("a", 0, 0, 10, 10),
        block("b", 20, 0, 10, 10),
      ];
      const intent = createMoveIntent("a", 0, 15);
      const options = createSolverOptions(blocks);

      const result = solveLayout(blocks, intent, options);

      expect(result.accepted).toBe(true);
      const a = result.layout.find((b) => b.id === "a")!;
      expect(a.position.y).toBe(15);
    });

    it("pushes colliding blocks when moving", () => {
      const blocks = [
        block("a", 0, 0, 10, 10),
        block("b", 5, 0, 10, 10), // Overlapping with a
      ];
      // Move a to x=3, which will push b further right
      const intent = createMoveIntent("a", 3, 0);
      const options = createSolverOptions(blocks);

      const result = solveLayout(blocks, intent, options);

      expect(result.accepted).toBe(true);
      const a = result.layout.find((b) => b.id === "a")!;
      const b = result.layout.find((b) => b.id === "b")!;
      expect(a.position.x).toBe(3);
      expect(b.position.x).toBeGreaterThanOrEqual(13); // Pushed right
    });

    it("clamps to grid boundaries", () => {
      const blocks = [block("a", 0, 0, 10, 10)];
      const intent = createMoveIntent("a", 30, 0); // Would exceed right edge
      const options = createSolverOptions(blocks);

      const result = solveLayout(blocks, intent, options);

      expect(result.accepted).toBe(true);
      const a = result.layout.find((b) => b.id === "a")!;
      expect(a.position.x + a.position.w).toBeLessThanOrEqual(DEFAULT_GRID_COLUMNS);
    });

    it("clamps y to 0", () => {
      const blocks = [block("a", 0, 10, 10, 10)];
      const intent = createMoveIntent("a", 0, -5); // Negative y
      const options = createSolverOptions(blocks);

      const result = solveLayout(blocks, intent, options);

      expect(result.accepted).toBe(true);
      const a = result.layout.find((b) => b.id === "a")!;
      expect(a.position.y).toBe(0);
    });

    it("fails when block not found", () => {
      const blocks = [block("a", 0, 0, 10, 10)];
      const intent = createMoveIntent("nonexistent", 5, 5);
      const options = createSolverOptions(blocks);

      const result = solveLayout(blocks, intent, options);

      expect(result.accepted).toBe(false);
      expect(result.blockedReason).toContain("not found");
    });
  });

  describe("solveLayout - resize", () => {
    it("expands a block", () => {
      const blocks = [block("a", 0, 0, 10, 10)];
      const intent = createResizeIntent("a", "east", 5);
      const options = createSolverOptions(blocks);

      const result = solveLayout(blocks, intent, options);

      expect(result.accepted).toBe(true);
      const a = result.layout.find((b) => b.id === "a")!;
      expect(a.position.w).toBe(15);
    });

    it("shrinks a block", () => {
      const blocks = [block("a", 0, 0, 15, 10)];
      const intent = createResizeIntent("a", "east", -5);
      const options = createSolverOptions(blocks);

      const result = solveLayout(blocks, intent, options);

      expect(result.accepted).toBe(true);
      const a = result.layout.find((b) => b.id === "a")!;
      expect(a.position.w).toBe(10);
    });

    it("pushes blocks when expanding", () => {
      const blocks = [
        block("a", 0, 0, 10, 10),
        block("b", 12, 0, 10, 10), // Gap of 2 columns
      ];
      const intent = createResizeIntent("a", "east", 5); // Expand into gap and beyond
      const options = createSolverOptions(blocks);

      const result = solveLayout(blocks, intent, options);

      expect(result.accepted).toBe(true);
      const a = result.layout.find((b) => b.id === "a")!;
      const b = result.layout.find((b) => b.id === "b")!;
      expect(a.position.w).toBe(15);
      expect(b.position.x).toBeGreaterThanOrEqual(15); // Pushed right
    });

    it("clamps to minimum size", () => {
      const blocks = [block("a", 0, 0, 10, 10)];
      const intent = createResizeIntent("a", "east", -10); // Would make w=0
      const options = createSolverOptions(blocks);

      const result = solveLayout(blocks, intent, options);

      expect(result.accepted).toBe(true);
      const a = result.layout.find((b) => b.id === "a")!;
      expect(a.position.w).toBe(6); // minW for cards
    });

    it("respects heading constraints (fixed height)", () => {
      const blocks = [heading("h1", 0, 0, 36, 2)];
      const intent = createResizeIntent("h1", "south", 5); // Try to make taller
      const options = createSolverOptions(blocks);

      const result = solveLayout(blocks, intent, options);

      // Should fail because headings can only resize east/west
      expect(result.accepted).toBe(false);
      expect(result.blockedReason).toContain("not allowed");
    });

    it("compacts when shrinking with compact flag", () => {
      const blocks = [
        block("a", 0, 0, 20, 10),
        block("b", 25, 0, 10, 10), // Gap of 5 columns
      ];
      const intent = createResizeIntent("a", "east", -5, true); // Shrink with compact
      const options = createSolverOptions(blocks);

      const result = solveLayout(blocks, intent, options);

      expect(result.accepted).toBe(true);
      const a = result.layout.find((b) => b.id === "a")!;
      const b = result.layout.find((b) => b.id === "b")!;
      expect(a.position.w).toBe(15);
      expect(b.position.x).toBe(15); // Compacted to new right edge of a
    });

    it("does not compact when shrinking without compact flag", () => {
      const blocks = [
        block("a", 0, 0, 20, 10),
        block("b", 25, 0, 10, 10),
      ];
      const intent = createResizeIntent("a", "east", -5, false); // Shrink without compact
      const options = createSolverOptions(blocks);

      const result = solveLayout(blocks, intent, options);

      expect(result.accepted).toBe(true);
      const b = result.layout.find((b) => b.id === "b")!;
      expect(b.position.x).toBe(25); // Unchanged
    });

    describe("resize from different edges", () => {
      it("resizes from west edge", () => {
        const blocks = [block("a", 10, 0, 10, 10)];
        const intent = createResizeIntent("a", "west", 5); // Expand left
        const options = createSolverOptions(blocks);

        const result = solveLayout(blocks, intent, options);

        expect(result.accepted).toBe(true);
        const a = result.layout.find((b) => b.id === "a")!;
        expect(a.position.x).toBe(5); // Moved left
        expect(a.position.w).toBe(15); // Wider
      });

      it("resizes from north edge", () => {
        const blocks = [block("a", 0, 10, 10, 10)];
        const intent = createResizeIntent("a", "north", 5); // Expand up
        const options = createSolverOptions(blocks);

        const result = solveLayout(blocks, intent, options);

        expect(result.accepted).toBe(true);
        const a = result.layout.find((b) => b.id === "a")!;
        expect(a.position.y).toBe(5); // Moved up
        expect(a.position.h).toBe(15); // Taller
      });

      it("resizes from south edge", () => {
        const blocks = [block("a", 0, 0, 10, 10)];
        const intent = createResizeIntent("a", "south", 5); // Expand down
        const options = createSolverOptions(blocks);

        const result = solveLayout(blocks, intent, options);

        expect(result.accepted).toBe(true);
        const a = result.layout.find((b) => b.id === "a")!;
        expect(a.position.h).toBe(15); // Taller
        expect(a.position.y).toBe(0); // Unchanged
      });
    });
  });

  describe("createSolverOptions", () => {
    it("creates options with defaults", () => {
      const blocks = [block("a", 0, 0, 10, 10)];
      const options = createSolverOptions(blocks);

      expect(options.gridColumns).toBe(DEFAULT_GRID_COLUMNS);
      expect(options.constraints.size).toBe(1);
    });

    it("allows overrides", () => {
      const blocks = [block("a", 0, 0, 10, 10)];
      const options = createSolverOptions(blocks, { gridColumns: 24 });

      expect(options.gridColumns).toBe(24);
    });
  });

  describe("intent creators", () => {
    it("creates move intent", () => {
      const intent = createMoveIntent("a", 5, 10);
      expect(intent).toEqual({ type: "move", blockId: "a", x: 5, y: 10 });
    });

    it("creates resize intent", () => {
      const intent = createResizeIntent("a", "east", 5, true);
      expect(intent).toEqual({
        type: "resize",
        blockId: "a",
        direction: "east",
        delta: 5,
        compact: true,
      });
    });

    it("defaults compact to false", () => {
      const intent = createResizeIntent("a", "east", 5);
      expect(intent.compact).toBe(false);
    });
  });

  describe("determinism", () => {
    it("produces the same result for the same input", () => {
      const blocks = [
        block("a", 0, 0, 10, 10),
        block("b", 5, 0, 10, 10),
        block("c", 10, 0, 10, 10),
      ];
      const intent = createMoveIntent("a", 3, 0);
      const options = createSolverOptions(blocks);

      const result1 = solveLayout(blocks, intent, options);
      const result2 = solveLayout(blocks, intent, options);

      expect(result1.layout).toEqual(result2.layout);
      expect(result1.accepted).toEqual(result2.accepted);
    });
  });

  describe("immutability", () => {
    it("does not mutate the input blocks", () => {
      const blocks = [block("a", 0, 0, 10, 10)];
      const originalX = blocks[0].position.x;
      const intent = createMoveIntent("a", 5, 0);
      const options = createSolverOptions(blocks);

      solveLayout(blocks, intent, options);

      expect(blocks[0].position.x).toBe(originalX);
    });
  });
});
