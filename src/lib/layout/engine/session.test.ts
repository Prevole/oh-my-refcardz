import { describe, expect, it } from "vitest";
import { createSessionMemory } from "./session";
import type { LayoutBlock } from "./types";

const block = (id: string, w: number, h: number, x = 0, y = 0): LayoutBlock => ({
  id,
  kind: "card",
  position: { x, y, w, h },
});

describe("createSessionMemory", () => {
  it("snapshots each block's initial size on creation", () => {
    const session = createSessionMemory([block("a", 4, 2), block("b", 1, 1)]);

    expect(session.getInitialSize("a")).toEqual({ w: 4, h: 2 });
    expect(session.getInitialSize("b")).toEqual({ w: 1, h: 1 });
  });

  it("snapshots each block's initial position (x, y, w, h) on creation", () => {
    const session = createSessionMemory([block("a", 4, 2, 5, 7), block("b", 1, 1, 12, 3)]);

    expect(session.getInitialPosition("a")).toEqual({ x: 5, y: 7, w: 4, h: 2 });
    expect(session.getInitialPosition("b")).toEqual({ x: 12, y: 3, w: 1, h: 1 });
  });

  it("returns undefined for unknown ids", () => {
    const session = createSessionMemory([block("a", 4, 2)]);
    expect(session.getInitialSize("missing")).toBeUndefined();
    expect(session.getInitialPosition("missing")).toBeUndefined();
  });

  it("preserves the original position even if the block is later mutated", () => {
    const blocks = [block("a", 4, 2, 5, 7)];
    const session = createSessionMemory(blocks);

    blocks[0].position.x = 99;
    blocks[0].position.y = 99;
    blocks[0].position.w = 1;
    blocks[0].position.h = 1;

    expect(session.getInitialSize("a")).toEqual({ w: 4, h: 2 });
    expect(session.getInitialPosition("a")).toEqual({ x: 5, y: 7, w: 4, h: 2 });
  });

  it("returns a fresh copy from getInitialPosition (no shared reference)", () => {
    const session = createSessionMemory([block("a", 4, 2, 5, 7)]);
    const first = session.getInitialPosition("a")!;
    first.x = 999;
    expect(session.getInitialPosition("a")).toEqual({ x: 5, y: 7, w: 4, h: 2 });
  });

  it("isolates instances - two sessions on the same blocks are independent", () => {
    const a = createSessionMemory([block("a", 4, 2)]);
    const b = createSessionMemory([block("a", 1, 1)]);

    expect(a.getInitialSize("a")).toEqual({ w: 4, h: 2 });
    expect(b.getInitialSize("a")).toEqual({ w: 1, h: 1 });
  });
});
