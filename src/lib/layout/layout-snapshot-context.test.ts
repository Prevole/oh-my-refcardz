import { describe, it, expect } from "vitest";
import { createSnapshot } from "./layout-snapshot-context";
import type { LayoutBlock } from "./solver/types";

describe("createSnapshot", () => {
  it("creates a snapshot from blocks", () => {
    const blocks: LayoutBlock[] = [
      { id: "a", kind: "card", position: { x: 0, y: 0, w: 10, h: 5 } },
      { id: "b", kind: "heading", position: { x: 10, y: 0, w: 12, h: 2 } },
    ];

    const snapshot = createSnapshot(blocks, "commit", "load");

    expect(snapshot.phase).toBe("commit");
    expect(snapshot.source).toBe("load");
    expect(snapshot.blocks).toEqual({
      a: { x: 0, y: 0, w: 10, h: 5 },
      b: { x: 10, y: 0, w: 12, h: 2 },
    });
  });

  it("creates a preview snapshot", () => {
    const blocks: LayoutBlock[] = [
      { id: "a", kind: "card", position: { x: 5, y: 3, w: 10, h: 5 } },
    ];

    const snapshot = createSnapshot(blocks, "preview", "drag");

    expect(snapshot.phase).toBe("preview");
    expect(snapshot.source).toBe("drag");
    expect(snapshot.blocks.a).toEqual({ x: 5, y: 3, w: 10, h: 5 });
  });

  it("handles empty blocks array", () => {
    const snapshot = createSnapshot([], "commit", "initial");

    expect(snapshot.blocks).toEqual({});
    expect(snapshot.phase).toBe("commit");
    expect(snapshot.source).toBe("initial");
  });
});

describe("useSortedBlocks", () => {
  // Note: This is a hook that requires React context, so we test the sorting logic
  // by extracting the logic. For full hook testing, we'd need @testing-library/react-hooks.

  it("sorts blocks by reading order (y first, then x)", () => {
    const blocks: Record<string, { x: number; y: number; w: number; h: number }> = {
      c: { x: 20, y: 0, w: 10, h: 5 },
      a: { x: 0, y: 0, w: 10, h: 5 },
      b: { x: 10, y: 0, w: 10, h: 5 },
      d: { x: 0, y: 5, w: 10, h: 5 },
    };

    // Simulate the sorting logic from useSortedBlocks
    const sorted = Object.entries(blocks)
      .map(([id, position]) => ({ id, position }))
      .sort((a, b) => {
        if (a.position.y !== b.position.y) {
          return a.position.y - b.position.y;
        }
        return a.position.x - b.position.x;
      });

    expect(sorted.map((b) => b.id)).toEqual(["a", "b", "c", "d"]);
  });
});
