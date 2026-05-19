import { describe, expect, it } from "vitest";
import { createSessionMemory } from "./session";
import type { LayoutBlock } from "./types";

const block = (id: string, w: number, h: number): LayoutBlock => ({
  id,
  kind: "card",
  position: { x: 0, y: 0, w, h },
});

describe("createSessionMemory", () => {
  it("snapshots each block's initial size on creation", () => {
    const session = createSessionMemory([block("a", 4, 2), block("b", 1, 1)]);

    expect(session.getInitialSize("a")).toEqual({ w: 4, h: 2 });
    expect(session.getInitialSize("b")).toEqual({ w: 1, h: 1 });
  });

  it("returns undefined for unknown ids", () => {
    const session = createSessionMemory([block("a", 4, 2)]);
    expect(session.getInitialSize("missing")).toBeUndefined();
  });

  it("preserves the original size even if the block is later mutated", () => {
    const blocks = [block("a", 4, 2)];
    const session = createSessionMemory(blocks);

    blocks[0].position.w = 1;
    blocks[0].position.h = 1;

    expect(session.getInitialSize("a")).toEqual({ w: 4, h: 2 });
  });

  it("isolates instances - two sessions on the same blocks are independent", () => {
    const a = createSessionMemory([block("a", 4, 2)]);
    const b = createSessionMemory([block("a", 1, 1)]);

    expect(a.getInitialSize("a")).toEqual({ w: 4, h: 2 });
    expect(b.getInitialSize("a")).toEqual({ w: 1, h: 1 });
  });
});
