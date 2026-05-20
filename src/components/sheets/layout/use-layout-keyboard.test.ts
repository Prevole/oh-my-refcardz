import { describe, expect, it } from "vitest";
import { ACTION_IDS } from "@/lib/keybindings";
import type { LayoutBlock } from "@/lib/layout/engine";
import {
  buildMoveOperation,
  buildResizeOperation,
  findNeighbour,
  moveSpecFromAction,
  navDirectionFromAction,
  pickClosestBlockByRects,
  pickTopLeftBlock,
  resizeSpecFromAction,
} from "./use-layout-keyboard";

function block(id: string, x: number, y: number, w = 1, h = 1): LayoutBlock {
  return { id, kind: "card", position: { x, y, w, h } };
}

describe("pickTopLeftBlock", () => {
  it("returns null for an empty list", () => {
    expect(pickTopLeftBlock([])).toBeNull();
  });

  it("picks the block with the lowest y, breaking ties by x", () => {
    const blocks = [
      block("a", 4, 2),
      block("b", 0, 2),
      block("c", 0, 0),
      block("d", 9, 0),
    ];
    expect(pickTopLeftBlock(blocks)).toBe("c");
  });
});

describe("pickClosestBlockByRects", () => {
  const rects: Record<string, { left: number; top: number; width: number; height: number }> = {
    a: { left: 0, top: 0, width: 100, height: 100 },
    b: { left: 500, top: 0, width: 100, height: 100 },
    c: { left: 0, top: 500, width: 100, height: 100 },
    d: { left: 500, top: 500, width: 100, height: 100 },
  };
  const rectFor = (id: string) => rects[id] ?? null;

  it("returns the id whose rect center is closest to the cursor", () => {
    expect(pickClosestBlockByRects(["a", "b", "c", "d"], { x: 50, y: 50 }, rectFor)).toBe("a");
    expect(pickClosestBlockByRects(["a", "b", "c", "d"], { x: 550, y: 550 }, rectFor)).toBe("d");
    expect(pickClosestBlockByRects(["a", "b", "c", "d"], { x: 550, y: 50 }, rectFor)).toBe("b");
  });

  it("skips ids whose rect lookup returns null", () => {
    expect(
      pickClosestBlockByRects(["missing", "a"], { x: 9999, y: 9999 }, rectFor),
    ).toBe("a");
  });

  it("returns null when no id has a known rect", () => {
    expect(pickClosestBlockByRects(["missing"], { x: 0, y: 0 }, rectFor)).toBeNull();
  });

  it("returns null when the id list is empty", () => {
    expect(pickClosestBlockByRects([], { x: 0, y: 0 }, rectFor)).toBeNull();
  });
});

describe("findNeighbour", () => {
  it("returns null when no candidate overlaps perpendicular projection", () => {
    const blocks = [block("a", 0, 0, 2, 2), block("b", 0, 10, 2, 2)];
    // Looking east from `a` there is no block on its right.
    expect(findNeighbour(blocks, "a", "east")).toBeNull();
    // Looking west from `b` there is no block to its left either.
    expect(findNeighbour(blocks, "b", "west")).toBeNull();
  });

  it("picks the closest horizontal neighbour with vertical overlap", () => {
    const blocks = [
      block("a", 0, 0, 2, 2),
      block("b", 4, 0, 2, 2),
      block("c", 8, 0, 2, 2),
    ];
    expect(findNeighbour(blocks, "a", "east")).toBe("b");
    expect(findNeighbour(blocks, "c", "west")).toBe("b");
  });

  it("ignores blocks without perpendicular overlap", () => {
    const blocks = [
      block("a", 0, 0, 2, 2),
      block("b", 4, 5, 2, 2), // vertically disjoint
      block("c", 4, 1, 2, 2), // overlaps on y=1
    ];
    expect(findNeighbour(blocks, "a", "east")).toBe("c");
  });

  it("returns null when focusedId is unknown", () => {
    const blocks = [block("a", 0, 0)];
    expect(findNeighbour(blocks, "missing", "east")).toBeNull();
  });

  it("handles vertical directions symmetrically", () => {
    const blocks = [
      block("a", 0, 0, 2, 2),
      block("b", 0, 4, 2, 2),
      block("c", 0, 8, 2, 2),
    ];
    expect(findNeighbour(blocks, "a", "south")).toBe("b");
    expect(findNeighbour(blocks, "c", "north")).toBe("b");
    expect(findNeighbour(blocks, "a", "north")).toBeNull();
  });
});

describe("action → spec lookup", () => {
  it("maps every nav action to a direction", () => {
    expect(navDirectionFromAction(ACTION_IDS.LAYOUT_NAV_LEFT)).toBe("west");
    expect(navDirectionFromAction(ACTION_IDS.LAYOUT_NAV_RIGHT)).toBe("east");
    expect(navDirectionFromAction(ACTION_IDS.LAYOUT_NAV_UP)).toBe("north");
    expect(navDirectionFromAction(ACTION_IDS.LAYOUT_NAV_DOWN)).toBe("south");
    expect(navDirectionFromAction("unknown")).toBeUndefined();
  });

  it("maps every move action to a spec", () => {
    expect(moveSpecFromAction(ACTION_IDS.LAYOUT_MOVE_LEFT)).toEqual({
      kind: "move",
      direction: "west",
      strict: false,
    });
    expect(moveSpecFromAction(ACTION_IDS.LAYOUT_MOVE_STRICT_DOWN)).toEqual({
      kind: "move",
      direction: "south",
      strict: true,
    });
    expect(moveSpecFromAction("unknown")).toBeUndefined();
  });

  it("maps every resize action to a spec", () => {
    expect(resizeSpecFromAction(ACTION_IDS.LAYOUT_RESIZE_GROW_LEFT)).toEqual({
      kind: "resize",
      edge: "west",
      delta: 1,
      strict: false,
      compact: false,
    });
    expect(resizeSpecFromAction(ACTION_IDS.LAYOUT_RESIZE_SHRINK_STRICT_UP)).toEqual({
      kind: "resize",
      edge: "north",
      delta: -1,
      strict: true,
      compact: false,
    });
    expect(resizeSpecFromAction(ACTION_IDS.LAYOUT_RESIZE_SHRINK_COMPACT_RIGHT)).toEqual({
      kind: "resize",
      edge: "east",
      delta: -1,
      strict: false,
      compact: true,
    });
    expect(resizeSpecFromAction("unknown")).toBeUndefined();
  });
});

describe("operation builders", () => {
  it("buildMoveOperation produces signed dx/dy for each direction", () => {
    expect(buildMoveOperation("a", { kind: "move", direction: "west", strict: false })).toMatchObject({
      kind: "move",
      blockId: "a",
      dx: -1,
      dy: 0,
    });
    expect(buildMoveOperation("a", { kind: "move", direction: "east", strict: false })).toMatchObject({
      dx: 1,
      dy: 0,
    });
    expect(buildMoveOperation("a", { kind: "move", direction: "north", strict: false })).toMatchObject({
      dx: 0,
      dy: -1,
    });
    expect(buildMoveOperation("a", { kind: "move", direction: "south", strict: false })).toMatchObject({
      dx: 0,
      dy: 1,
    });
  });

  it("buildMoveOperation sets strict options when strict is true", () => {
    const op = buildMoveOperation("a", { kind: "move", direction: "east", strict: true });
    expect(op.options).toEqual({ allowWrap: false, allowShrink: false });
  });

  it("buildMoveOperation leaves options empty when strict is false", () => {
    const op = buildMoveOperation("a", { kind: "move", direction: "east", strict: false });
    expect(op.options).toEqual({});
  });

  it("buildResizeOperation passes edge and delta verbatim", () => {
    const op = buildResizeOperation("a", {
      kind: "resize",
      edge: "south",
      delta: 1,
      strict: false,
      compact: false,
    });
    expect(op).toMatchObject({ kind: "resize", blockId: "a", edge: "south", delta: 1 });
    expect(op.options).toEqual({});
  });

  it("buildResizeOperation enables compact mode when requested", () => {
    const op = buildResizeOperation("a", {
      kind: "resize",
      edge: "east",
      delta: -1,
      strict: false,
      compact: true,
    });
    expect(op.options?.compact).toBe(true);
  });

  it("buildResizeOperation sets strict flags", () => {
    const op = buildResizeOperation("a", {
      kind: "resize",
      edge: "west",
      delta: -1,
      strict: true,
      compact: false,
    });
    expect(op.options).toEqual({ allowShrink: false, allowWrap: false });
  });
});
