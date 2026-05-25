import { describe, expect, it } from "vitest";
import type { BlockConstraints, LayoutBlock, MoveOperation } from "@/lib/layout/engine";
import {
  applyToBuffer,
  commitBuffer,
  createBuffer,
  resetBuffer,
  type ApplyContext,
} from "./layout-buffer";

const GRID_COLUMNS = 36;

function block(id: string, x: number, y: number, w = 4, h = 2): LayoutBlock {
  return { id, kind: "card", position: { x, y, w, h } };
}

function constraintsFor(blocks: readonly LayoutBlock[]): Map<string, BlockConstraints> {
  const map = new Map<string, BlockConstraints>();
  for (const b of blocks) {
    map.set(b.id, {
      minW: 1,
      minH: 1,
      maxW: GRID_COLUMNS,
      maxH: 999,
      allowedResizeDirections: ["west", "east", "north", "south"],
    });
  }
  return map;
}

function ctxFor(blocks: readonly LayoutBlock[]): ApplyContext {
  return { gridColumns: GRID_COLUMNS, constraints: constraintsFor(blocks) };
}

describe("createBuffer", () => {
  it("initialises with the supplied snapshot and a zero counter", () => {
    const snapshot = [block("a", 0, 0)];
    const buffer = createBuffer(snapshot);
    expect(buffer.initialSnapshot).toBe(snapshot);
    expect(buffer.currentBuffer).toBe(snapshot);
    expect(buffer.changesCount).toBe(0);
  });
});

describe("applyToBuffer", () => {
  it("returns the same buffer reference when the engine produces no change", () => {
    // A block at x=0 cannot move further west: the engine should clamp it
    // and produce the same layout.
    const snapshot = [block("a", 0, 0)];
    const buffer = createBuffer(snapshot);
    const op: MoveOperation = {
      kind: "move",
      blockId: "a",
      dx: -1,
      dy: 0,
      options: { allowWrap: false, allowShrink: false },
    };
    const result = applyToBuffer(buffer, op, ctxFor(snapshot));
    expect(result.buffer).toBe(buffer);
    expect(result.buffer.changesCount).toBe(0);
    expect(result.blocks).toBe(buffer.currentBuffer);
  });

  it("increments changesCount and updates currentBuffer when the layout changes", () => {
    const snapshot = [block("a", 5, 0)];
    const buffer = createBuffer(snapshot);
    const op: MoveOperation = { kind: "move", blockId: "a", dx: 1, dy: 0 };
    const result = applyToBuffer(buffer, op, ctxFor(snapshot));
    expect(result.buffer).not.toBe(buffer);
    expect(result.buffer.changesCount).toBe(1);
    expect(result.buffer.currentBuffer[0].position.x).toBe(6);
    expect(result.blocks).toBe(result.buffer.currentBuffer);
    // The initial snapshot is preserved across applies.
    expect(result.buffer.initialSnapshot).toBe(snapshot);
  });

  it("does not mutate the input buffer", () => {
    const snapshot = [block("a", 5, 0)];
    const buffer = createBuffer(snapshot);
    const op: MoveOperation = { kind: "move", blockId: "a", dx: 1, dy: 0 };
    applyToBuffer(buffer, op, ctxFor(snapshot));
    expect(buffer.currentBuffer).toBe(snapshot);
    expect(buffer.changesCount).toBe(0);
  });

  it("accumulates changesCount across multiple successful operations", () => {
    const snapshot = [block("a", 5, 5)];
    let buffer = createBuffer(snapshot);
    for (let i = 0; i < 5; i++) {
      const op: MoveOperation = { kind: "move", blockId: "a", dx: 1, dy: 0 };
      buffer = applyToBuffer(buffer, op, ctxFor(buffer.currentBuffer)).buffer;
    }
    expect(buffer.changesCount).toBe(5);
    expect(buffer.currentBuffer[0].position.x).toBe(10);
  });

  it("does not increment changesCount when an op produces a no-op", () => {
    // Block sits at x=0; strict move west cannot shrink/wrap → engine
    // refuses and returns the same layout.
    const snapshot = [block("a", 0, 0)];
    const buffer = createBuffer(snapshot);
    const strictWestOffGrid: MoveOperation = {
      kind: "move",
      blockId: "a",
      dx: -1,
      dy: 0,
      options: { allowWrap: false, allowShrink: false },
    };
    const result = applyToBuffer(buffer, strictWestOffGrid, ctxFor(buffer.currentBuffer));
    expect(result.buffer).toBe(buffer);
    expect(result.buffer.changesCount).toBe(0);
  });

  it("preserves changesCount when a no-op follows successful ops", () => {
    const snapshot = [block("a", 5, 5)];
    let buffer = createBuffer(snapshot);
    const moveEast: MoveOperation = { kind: "move", blockId: "a", dx: 1, dy: 0 };
    buffer = applyToBuffer(buffer, moveEast, ctxFor(buffer.currentBuffer)).buffer;
    buffer = applyToBuffer(buffer, moveEast, ctxFor(buffer.currentBuffer)).buffer;
    expect(buffer.changesCount).toBe(2);

    // Move the block to x=0 then attempt a strict west move (no-op).
    // We can't easily reach x=0 without more ops, so we use a strict
    // resize that the engine rejects: shrink a 4-wide block when minW=1
    // works, but shrink past minW would fail. Try shrinking a 1-wide.
    const singleWide: LayoutBlock = { id: "a", kind: "card", position: { x: 5, y: 5, w: 1, h: 1 } };
    let smallBuffer = createBuffer([singleWide]);
    const moveEastSmall: MoveOperation = { kind: "move", blockId: "a", dx: 1, dy: 0 };
    smallBuffer = applyToBuffer(smallBuffer, moveEastSmall, ctxFor(smallBuffer.currentBuffer)).buffer;
    expect(smallBuffer.changesCount).toBe(1);
    // A strict resize that would shrink below minW is rejected.
    const illegalShrink = {
      kind: "resize" as const,
      blockId: "a",
      edge: "east" as const,
      delta: -1,
      options: { allowShrink: false, allowWrap: false },
    };
    const before = smallBuffer;
    smallBuffer = applyToBuffer(smallBuffer, illegalShrink, ctxFor(smallBuffer.currentBuffer)).buffer;
    expect(smallBuffer).toBe(before);
    expect(smallBuffer.changesCount).toBe(1);
  });
});

describe("commitBuffer", () => {
  it("returns the current buffer contents", () => {
    const snapshot = [block("a", 5, 0)];
    const buffer = createBuffer(snapshot);
    const op: MoveOperation = { kind: "move", blockId: "a", dx: 1, dy: 0 };
    const next = applyToBuffer(buffer, op, ctxFor(snapshot)).buffer;
    expect(commitBuffer(next)).toBe(next.currentBuffer);
    expect(commitBuffer(next)[0].position.x).toBe(6);
  });

  it("returns the initial snapshot when no operation has changed the layout", () => {
    const snapshot = [block("a", 0, 0)];
    const buffer = createBuffer(snapshot);
    expect(commitBuffer(buffer)).toBe(snapshot);
  });
});

describe("resetBuffer", () => {
  it("returns the same buffer reference when no edits have been staged", () => {
    const snapshot = [block("a", 0, 0)];
    const buffer = createBuffer(snapshot);
    expect(resetBuffer(buffer)).toBe(buffer);
  });

  it("rewinds currentBuffer to the initial snapshot and zeroes the counter", () => {
    const snapshot = [block("a", 5, 0)];
    const buffer = createBuffer(snapshot);
    const op: MoveOperation = { kind: "move", blockId: "a", dx: 1, dy: 0 };
    const staged = applyToBuffer(buffer, op, ctxFor(snapshot)).buffer;
    expect(staged.changesCount).toBe(1);
    const reset = resetBuffer(staged);
    expect(reset.currentBuffer).toBe(snapshot);
    expect(reset.changesCount).toBe(0);
    expect(reset.initialSnapshot).toBe(snapshot);
  });

  it("does not mutate the input buffer", () => {
    const snapshot = [block("a", 5, 0)];
    const buffer = createBuffer(snapshot);
    const op: MoveOperation = { kind: "move", blockId: "a", dx: 1, dy: 0 };
    const staged = applyToBuffer(buffer, op, ctxFor(snapshot)).buffer;
    resetBuffer(staged);
    expect(staged.currentBuffer[0].position.x).toBe(6);
    expect(staged.changesCount).toBe(1);
  });
});
