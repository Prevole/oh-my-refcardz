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

  describe("regression", () => {
    it("moving card to y=2 should NOT affect heading at y=0", () => {
      // Bug: when card moves to y=2, heading at y=0 was being moved
      const h = heading("heading", 0, 0, 36, 2);
      const cardA = block("cardA", 1, 3, 18, 22);
      const cardB = block("cardB", 1, 25, 18, 8);
      const blocks = [h, cardA, cardB];

      // Move cardA from (1,3) to (1,2) - does NOT collide with heading
      const intent = createMoveIntent("cardA", 1, 2);
      const options = createSolverOptions(blocks);

      const result = solveLayout(blocks, intent, options);

      expect(result.accepted).toBe(true);

      // The heading should NOT have moved!
      const resultHeading = result.layout.find(b => b.id === "heading")!;
      expect(resultHeading.position.y).toBe(0);
      expect(resultHeading.position.x).toBe(0);
      expect(resultHeading.position.w).toBe(36);
      expect(resultHeading.position.h).toBe(2);
    });

    it("simulating continuous drag from y=3 to y=2, y=1, y=0", () => {
      // Simulate a drag where the startLayout stays the same
      // but the intent changes as the user drags
      const h = heading("heading", 0, 0, 36, 2);
      const cardA = block("cardA", 1, 3, 18, 22);
      const cardB = block("cardB", 1, 25, 18, 8);
      const startLayout = [h, cardA, cardB];
      const options = createSolverOptions(startLayout);

      // Step 1: Move to y=2 (no collision with heading)
      const intent1 = createMoveIntent("cardA", 1, 2);
      const result1 = solveLayout(startLayout, intent1, options);
      expect(result1.accepted).toBe(true);
      
      let resultHeading = result1.layout.find(b => b.id === "heading")!;
      expect(resultHeading.position.y).toBe(0); // Heading should NOT move

      // Step 2: Move to y=1 (collides with heading)
      const intent2 = createMoveIntent("cardA", 1, 1);
      const result2 = solveLayout(startLayout, intent2, options);
      expect(result2.accepted).toBe(true);
      
      resultHeading = result2.layout.find(b => b.id === "heading")!;
      // Heading should be wrapped below cardA (which is now at y=1 with h=22, so bottom=23)
      expect(resultHeading.position.y).toBeGreaterThanOrEqual(23);

      // Step 3: Move to y=0 (more collision with heading)
      const intent3 = createMoveIntent("cardA", 1, 0);
      const result3 = solveLayout(startLayout, intent3, options);
      expect(result3.accepted).toBe(true);
      
      resultHeading = result3.layout.find(b => b.id === "heading")!;
      // Heading should be wrapped below cardA (which is now at y=0 with h=22, so bottom=22)
      expect(resultHeading.position.y).toBeGreaterThanOrEqual(22);

      // Verify no collisions in final layout
      const finalBlocks = result3.layout;
      for (let i = 0; i < finalBlocks.length; i++) {
        for (let j = i + 1; j < finalBlocks.length; j++) {
          const a = finalBlocks[i].position;
          const b = finalBlocks[j].position;
          const intersects = 
            a.x < b.x + b.w && a.x + a.w > b.x &&
            a.y < b.y + b.h && a.y + a.h > b.y;
          expect(intersects).toBe(false);
        }
      }
    });

    it("docker layout: moving container-status up should not cause overlaps", () => {
      // Reproduces bug from debug session 1778623849459-xj1njuk.json
      // Layout: heading full-width, two cards in left column, two cards in right column
      const containers = heading("containers", 0, 0, 36, 2);
      const containerLifecycle = block("container-lifecycle", 0, 2, 18, 22);
      const containerStatus = block("container-status", 18, 2, 18, 11);
      const containerRename = block("container-rename", 0, 24, 18, 8);
      const containerInteraction = block("container-interaction", 18, 13, 18, 16);
      
      const blocks = [containers, containerLifecycle, containerStatus, containerRename, containerInteraction];
      const options = createSolverOptions(blocks);
      
      // Move container-status from (18, 2) to (18, 1) - enters heading space
      const intent = createMoveIntent("container-status", 18, 1);
      const result = solveLayout(blocks, intent, options);
      
      expect(result.accepted).toBe(true);
      
      // Verify no collisions in result layout
      verifyNoOverlaps(result.layout);
    });

    it("docker layout: moving container-interaction up should not cause overlaps", () => {
      // Reproduces bug from debug session 1778624060297-kxfphy8.json
      const containers = heading("containers", 0, 0, 36, 2);
      const containerLifecycle = block("container-lifecycle", 0, 2, 18, 22);
      const containerStatus = block("container-status", 18, 2, 18, 11);
      const containerRename = block("container-rename", 0, 24, 18, 8);
      const containerInteraction = block("container-interaction", 18, 13, 18, 16);
      const images = heading("images", 0, 32, 36, 2);
      const imageInspection = block("image-inspection", 18, 34, 18, 8);
      const inspection = heading("inspection", 0, 51, 36, 2);
      const imageLifecycle = block("image-lifecycle", 0, 54, 18, 15);
      
      const blocks = [
        containers, containerLifecycle, containerStatus, containerRename, containerInteraction,
        images, imageInspection, inspection, imageLifecycle
      ];
      const options = createSolverOptions(blocks);
      
      // Move container-interaction from (18, 13) to (18, 12)
      const intent = createMoveIntent("container-interaction", 18, 12);
      const result = solveLayout(blocks, intent, options);
      
      expect(result.accepted).toBe(true);
      
      // Verify no collisions in result layout
      verifyNoOverlaps(result.layout);
    });

    it("should shrink/wrap intermediate block before affecting distant blocks", () => {
      // When C moves up toward A (heading), B (card between them) should be shrunk/wrapped
      // BEFORE A is affected
      const headingA = heading("A", 0, 0, 36, 2);        // y=[0,2)
      const cardB = block("B", 18, 2, 18, 11);          // y=[2,13)
      const cardC = block("C", 18, 13, 18, 16);         // y=[13,29)
      
      const blocks = [headingA, cardB, cardC];
      const options = createSolverOptions(blocks);
      
      // Move C from y=13 to y=12 (enters B's space)
      const intent = createMoveIntent("C", 18, 12);
      const result = solveLayout(blocks, intent, options);
      
      expect(result.accepted).toBe(true);
      verifyNoOverlaps(result.layout);
      
      const resultA = result.layout.find(b => b.id === "A")!;
      const resultB = result.layout.find(b => b.id === "B")!;
      const resultC = result.layout.find(b => b.id === "C")!;
      
      // C should be at its target position
      expect(resultC.position.y).toBe(12);
      
      // A (heading) should NOT have moved - it's not in direct collision with C
      expect(resultA.position.y).toBe(0);
      
      // B should either be shrunk (h < 11) or wrapped below C (y >= 28)
      const bWasShrunk = resultB.position.h < 11;
      const bWasWrapped = resultB.position.y >= 12 + 16; // below C
      expect(bWasShrunk || bWasWrapped).toBe(true);
    });
  });
});

// Helper to verify no overlaps exist in a layout
function verifyNoOverlaps(layout: ReturnType<typeof block>[]) {
  for (let i = 0; i < layout.length; i++) {
    for (let j = i + 1; j < layout.length; j++) {
      const a = layout[i];
      const b = layout[j];
      const intersects = 
        a.position.x < b.position.x + b.position.w && 
        a.position.x + a.position.w > b.position.x &&
        a.position.y < b.position.y + b.position.h && 
        a.position.y + a.position.h > b.position.y;
      
      if (intersects) {
        throw new Error(
          `Overlap detected between ${a.id} (${a.position.x},${a.position.y} ${a.position.w}x${a.position.h}) ` +
          `and ${b.id} (${b.position.x},${b.position.y} ${b.position.w}x${b.position.h})`
        );
      }
    }
  }
}

describe("Docker cheatsheet regression tests", () => {
  it("session 1778625051643: moving container-status up wraps heading and cascades correctly", () => {
    // Simplified version of the Docker layout from debug session
    const containers = heading("containers", 0, 0, 36, 2);           // y=[0,2)
    const containerLifecycle = block("container-lifecycle", 0, 2, 18, 22);    // y=[2,24)
    const containerStatus = block("container-status", 18, 2, 18, 11);         // y=[2,13)
    const containerRename = block("container-rename", 0, 24, 18, 8);          // y=[24,32)
    const containerInteraction = block("container-interaction", 18, 13, 18, 16); // y=[13,29)
    const images = heading("images", 0, 32, 36, 2);                           // y=[32,34)

    const blocks = [containers, containerLifecycle, containerStatus, containerRename, containerInteraction, images];
    const options = createSolverOptions(blocks);

    // Move container-status from y=2 to y=1 (pushes into heading)
    const intent = createMoveIntent("container-status", 18, 1);
    const result = solveLayout(blocks, intent, options);

    expect(result.accepted).toBe(true);
    verifyNoOverlaps(result.layout);

    const resultContainers = result.layout.find(b => b.id === "containers")!;
    const resultContainerStatus = result.layout.find(b => b.id === "container-status")!;
    const resultContainerLifecycle = result.layout.find(b => b.id === "container-lifecycle")!;
    const resultImages = result.layout.find(b => b.id === "images")!;

    // container-status should be at target y=1
    expect(resultContainerStatus.position.y).toBe(1);

    // Heading "containers" should have wrapped below container-status (y=12)
    // because it can't be pushed above grid boundary
    expect(resultContainers.position.y).toBeGreaterThanOrEqual(12);

    // container-lifecycle should be pushed below the wrapped heading
    expect(resultContainerLifecycle.position.y).toBeGreaterThan(resultContainers.position.y);

    // images heading should still be below all the container cards
    const maxContainerCardBottom = Math.max(
      resultContainerLifecycle.position.y + resultContainerLifecycle.position.h,
      result.layout.find(b => b.id === "container-rename")!.position.y + 
        result.layout.find(b => b.id === "container-rename")!.position.h,
      result.layout.find(b => b.id === "container-interaction")!.position.y + 
        result.layout.find(b => b.id === "container-interaction")!.position.h
    );
    expect(resultImages.position.y).toBeGreaterThanOrEqual(maxContainerCardBottom);
  });

  it("session 1778625428694: pushed card should push headings in its path, not be pushed by them", () => {
    // This test reproduces the bug where image-inspection (N) was pushed to y=90
    // instead of staying under images (F) and pushing inspection (G), image-lifecycle (H), etc.
    
    // Simplified layout focusing on the problematic area:
    // - images heading (F) at y=32, full width
    // - image-inspection (N) at y=34, right column
    // - inspection heading (G) at y=51, full width
    // - image-lifecycle (H) at y=54, left column
    // - container-inspection (I) at y=54, right column
    
    const imagesHeading = heading("images", 0, 32, 36, 2);           // y=[32,34)
    const imageInspection = block("image-inspection", 18, 34, 18, 8); // y=[34,42)
    const inspectionHeading = heading("inspection", 0, 51, 36, 2);    // y=[51,53)
    const imageLifecycle = block("image-lifecycle", 0, 54, 18, 15);   // y=[54,69)
    const containerInspection = block("container-inspection", 18, 54, 18, 16); // y=[54,70)
    const volumesHeading = heading("volumes", 0, 70, 18, 2);          // y=[70,72)
    const networksHeading = heading("networks", 18, 70, 18, 2);       // y=[70,72)

    const blocks = [
      imagesHeading, imageInspection, inspectionHeading, 
      imageLifecycle, containerInspection, volumesHeading, networksHeading
    ];
    const options = createSolverOptions(blocks);

    // Simulate the scenario: images heading is pushed down by 12 (from y=32 to y=44)
    // This means image-inspection should also move down and push inspection heading
    const intent = createMoveIntent("images", 0, 44);
    const result = solveLayout(blocks, intent, options);

    expect(result.accepted).toBe(true);
    verifyNoOverlaps(result.layout);

    const resultImages = result.layout.find(b => b.id === "images")!;
    const resultImageInspection = result.layout.find(b => b.id === "image-inspection")!;
    const resultInspection = result.layout.find(b => b.id === "inspection")!;
    const resultImageLifecycle = result.layout.find(b => b.id === "image-lifecycle")!;
    const resultContainerInspection = result.layout.find(b => b.id === "container-inspection")!;

    // images heading should be at y=44
    expect(resultImages.position.y).toBe(44);

    // image-inspection should be pushed down but stay close to images heading
    // It should be at y=46 (right after images which ends at y=46)
    // or pushed slightly more if there's a cascade, but NOT at y=90!
    expect(resultImageInspection.position.y).toBeLessThan(70);
    
    // image-inspection should have pushed inspection heading down
    // inspection was at y=51, image-inspection would collide if it moves to y=46 (ends at y=54 > 51)
    // So inspection should be pushed to at least y=54 (after image-inspection ends)
    const imageInspectionBottom = resultImageInspection.position.y + resultImageInspection.position.h;
    expect(resultInspection.position.y).toBeGreaterThanOrEqual(imageInspectionBottom);

    // image-lifecycle and container-inspection should be pushed below inspection
    expect(resultImageLifecycle.position.y).toBeGreaterThan(resultInspection.position.y);
    expect(resultContainerInspection.position.y).toBeGreaterThan(resultInspection.position.y);
  });
});
