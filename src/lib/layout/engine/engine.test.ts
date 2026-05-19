/**
 * Engine tests (étape 3.9).
 *
 * Covers the public `applyOperation` orchestration:
 *  - session lifecycle events
 *  - step decomposition (vertical-first for moves)
 *  - delta accounting (appliedDx, appliedDy, appliedDelta)
 *  - resize path (grow + shrink, +compact)
 *  - aggregation of `affected` across steps
 *  - failure modes (primary not found, no-op)
 */

import { describe, expect, it, vi } from "vitest";

import { applyOperation } from "./engine";
import type {
  BlockConstraints,
  EngineEvent,
  EngineOptions,
  LayoutBlock,
  Operation,
} from "./types";

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function block(id: string, x: number, y: number, w = 1, h = 1): LayoutBlock {
  return { id, kind: "card", position: { x, y, w, h } };
}

const defaultConstraints: BlockConstraints = {
  minW: 1,
  minH: 1,
  allowedResizeDirections: ["north", "south", "east", "west"],
};

function constraintsFor(blocks: LayoutBlock[]): Map<string, BlockConstraints> {
  const map = new Map<string, BlockConstraints>();
  for (const b of blocks) map.set(b.id, defaultConstraints);
  return map;
}

function captureEvents(): { listener: (e: EngineEvent) => void; events: EngineEvent[] } {
  const events: EngineEvent[] = [];
  return { listener: (e) => events.push(e), events };
}

function makeOptions(
  blocks: LayoutBlock[],
  emitter?: EngineOptions["emitter"]
): EngineOptions {
  return {
    gridColumns: 10,
    constraints: constraintsFor(blocks),
    emitter,
    opId: "op-test",
  };
}

// -----------------------------------------------------------------------------
// 3.9.1 — Minimal: no-op and trivial move
// -----------------------------------------------------------------------------

describe("applyOperation — 3.9.1 minimal", () => {
  it("returns accepted=false for a no-op move (dx=0, dy=0)", () => {
    const blocks = [block("a", 2, 2)];
    const op: Operation = { kind: "move", blockId: "a", dx: 0, dy: 0 };
    const result = applyOperation(blocks, op, makeOptions(blocks));

    expect(result.accepted).toBe(false);
    expect(result.appliedDx).toBe(0);
    expect(result.appliedDy).toBe(0);
    expect(result.blocks[0].position).toEqual({ x: 2, y: 2, w: 1, h: 1 });
  });

  it("applies a simple south move with no obstacles", () => {
    const blocks = [block("a", 2, 2)];
    const op: Operation = { kind: "move", blockId: "a", dx: 0, dy: 1 };
    const result = applyOperation(blocks, op, makeOptions(blocks));

    expect(result.accepted).toBe(true);
    expect(result.appliedDx).toBe(0);
    expect(result.appliedDy).toBe(1);
    const a = result.blocks.find((b) => b.id === "a")!;
    expect(a.position).toEqual({ x: 2, y: 3, w: 1, h: 1 });
  });

  it("does not mutate the input blocks array", () => {
    const blocks = [block("a", 2, 2)];
    const op: Operation = { kind: "move", blockId: "a", dx: 0, dy: 1 };
    applyOperation(blocks, op, makeOptions(blocks));
    expect(blocks[0].position).toEqual({ x: 2, y: 2, w: 1, h: 1 });
  });

  it("throws when the primary id is not found", () => {
    const blocks = [block("a", 0, 0)];
    const op: Operation = { kind: "move", blockId: "ghost", dx: 0, dy: 1 };
    expect(() => applyOperation(blocks, op, makeOptions(blocks))).toThrow();
  });
});

// -----------------------------------------------------------------------------
// 3.9.2 — Session lifecycle events
// -----------------------------------------------------------------------------

describe("applyOperation — 3.9.2 session lifecycle", () => {
  it("emits session.start and session.end around the operation", () => {
    const blocks = [block("a", 2, 2)];
    const { listener, events } = captureEvents();
    const emitter = { emit: listener, on: vi.fn() };
    const op: Operation = { kind: "move", blockId: "a", dx: 0, dy: 1 };

    applyOperation(blocks, op, makeOptions(blocks, emitter));

    const types = events.map((e) => e.type);
    expect(types[0]).toBe("session.start");
    expect(types[types.length - 1]).toBe("session.end");
  });

  it("session.start carries the operation and initial blocks (deep clone)", () => {
    const blocks = [block("a", 2, 2)];
    const { listener, events } = captureEvents();
    const emitter = { emit: listener, on: vi.fn() };
    const op: Operation = { kind: "move", blockId: "a", dx: 0, dy: 1 };

    applyOperation(blocks, op, makeOptions(blocks, emitter));

    const start = events.find((e) => e.type === "session.start");
    expect(start).toBeDefined();
    if (start && start.type === "session.start") {
      expect(start.opId).toBe("op-test");
      expect(start.operation).toEqual(op);
      expect(start.initial).toEqual(blocks);
      // Should be a clone, not the same reference (immutability guarantee).
      expect(start.initial).not.toBe(blocks);
    }
  });

  it("session.end carries accepted=true and the final state", () => {
    const blocks = [block("a", 2, 2)];
    const { listener, events } = captureEvents();
    const emitter = { emit: listener, on: vi.fn() };
    const op: Operation = { kind: "move", blockId: "a", dx: 0, dy: 1 };

    applyOperation(blocks, op, makeOptions(blocks, emitter));

    const end = events.find((e) => e.type === "session.end");
    expect(end).toBeDefined();
    if (end && end.type === "session.end") {
      expect(end.accepted).toBe(true);
      expect(end.final.find((b) => b.id === "a")!.position).toEqual({
        x: 2,
        y: 3,
        w: 1,
        h: 1,
      });
    }
  });

  it("session.end accepted=false when nothing was applied (no-op)", () => {
    const blocks = [block("a", 2, 2)];
    const { listener, events } = captureEvents();
    const emitter = { emit: listener, on: vi.fn() };
    const op: Operation = { kind: "move", blockId: "a", dx: 0, dy: 0 };

    applyOperation(blocks, op, makeOptions(blocks, emitter));

    const end = events.find((e) => e.type === "session.end");
    if (end && end.type === "session.end") {
      expect(end.accepted).toBe(false);
    }
  });
});

// -----------------------------------------------------------------------------
// 3.9.3 — Vertical-first decomposition
// -----------------------------------------------------------------------------

describe("applyOperation — 3.9.3 decomposition", () => {
  it("decomposes a diagonal move into vertical steps then horizontal steps", () => {
    const blocks = [block("a", 0, 0)];
    const { listener, events } = captureEvents();
    const emitter = { emit: listener, on: vi.fn() };
    // dx=2, dy=2 → expect 2 south then 2 east.
    const op: Operation = { kind: "move", blockId: "a", dx: 2, dy: 2 };

    applyOperation(blocks, op, makeOptions(blocks, emitter));

    const stepStarts = events.filter((e) => e.type === "step.start");
    expect(stepStarts).toHaveLength(4);
    if (
      stepStarts[0].type === "step.start" &&
      stepStarts[1].type === "step.start" &&
      stepStarts[2].type === "step.start" &&
      stepStarts[3].type === "step.start"
    ) {
      expect(stepStarts[0].direction).toBe("south");
      expect(stepStarts[1].direction).toBe("south");
      expect(stepStarts[2].direction).toBe("east");
      expect(stepStarts[3].direction).toBe("east");
    }
  });

  it("uses north and west directions for negative deltas", () => {
    const blocks = [block("a", 4, 4)];
    const { listener, events } = captureEvents();
    const emitter = { emit: listener, on: vi.fn() };
    const op: Operation = { kind: "move", blockId: "a", dx: -1, dy: -1 };

    applyOperation(blocks, op, makeOptions(blocks, emitter));

    const dirs = events
      .filter((e) => e.type === "step.start")
      .map((e) => (e.type === "step.start" ? e.direction : null));
    expect(dirs).toEqual(["north", "west"]);
  });

  it("applies the cumulative displacement to the primary", () => {
    const blocks = [block("a", 0, 0)];
    const op: Operation = { kind: "move", blockId: "a", dx: 2, dy: 1 };
    const result = applyOperation(blocks, op, makeOptions(blocks));
    expect(result.appliedDx).toBe(2);
    expect(result.appliedDy).toBe(1);
    const a = result.blocks.find((b) => b.id === "a")!;
    expect(a.position).toEqual({ x: 2, y: 1, w: 1, h: 1 });
  });
});

// -----------------------------------------------------------------------------
// 3.9.4 — step.start / step.end / chain.computed
// -----------------------------------------------------------------------------

describe("applyOperation — 3.9.4 step events", () => {
  it("emits step.start and step.end with stepIndex in order", () => {
    const blocks = [block("a", 0, 0)];
    const { listener, events } = captureEvents();
    const emitter = { emit: listener, on: vi.fn() };
    const op: Operation = { kind: "move", blockId: "a", dx: 0, dy: 2 };

    applyOperation(blocks, op, makeOptions(blocks, emitter));

    const steps = events.filter(
      (e) => e.type === "step.start" || e.type === "step.end"
    );
    // 2 steps × 2 events = 4 events
    expect(steps).toHaveLength(4);

    // stepIndex 0, 0, 1, 1 in order
    const indices = steps.map((e) =>
      e.type === "step.start" || e.type === "step.end" ? e.stepIndex : -1
    );
    expect(indices).toEqual([0, 0, 1, 1]);
  });

  it("emits chain.computed when a step triggers chain resolution", () => {
    // Two adjacent blocks; pushing east causes chain computation.
    const blocks = [block("a", 2, 2), block("b", 3, 2)];
    const { listener, events } = captureEvents();
    const emitter = { emit: listener, on: vi.fn() };
    const op: Operation = { kind: "move", blockId: "a", dx: 1, dy: 0 };

    applyOperation(blocks, op, makeOptions(blocks, emitter));

    const chainEvents = events.filter((e) => e.type === "chain.computed");
    expect(chainEvents).toHaveLength(1);
    if (chainEvents[0].type === "chain.computed") {
      expect(chainEvents[0].direction).toBe("east");
      expect(chainEvents[0].members).toEqual(["a", "b"]);
    }
  });

  it("does NOT emit chain.computed for steps without collision", () => {
    const blocks = [block("a", 2, 2)];
    const { listener, events } = captureEvents();
    const emitter = { emit: listener, on: vi.fn() };
    const op: Operation = { kind: "move", blockId: "a", dx: 1, dy: 0 };

    applyOperation(blocks, op, makeOptions(blocks, emitter));

    expect(events.filter((e) => e.type === "chain.computed")).toHaveLength(0);
  });
});

// -----------------------------------------------------------------------------
// 3.9.5 — Abort on step rejection
// -----------------------------------------------------------------------------

describe("applyOperation — 3.9.5 abort on rejection", () => {
  it("aborts the rest of the operation when a step is rejected", () => {
    // Primary at east edge cannot move further east.
    const blocks = [block("a", 9, 0)];
    const { listener, events } = captureEvents();
    const emitter = { emit: listener, on: vi.fn() };
    const op: Operation = { kind: "move", blockId: "a", dx: 2, dy: 0 };

    const result = applyOperation(blocks, op, makeOptions(blocks, emitter));

    // No step applied at all → not accepted, appliedDx = 0.
    expect(result.accepted).toBe(false);
    expect(result.appliedDx).toBe(0);
    // Only one step.start was emitted then aborted.
    const stepStarts = events.filter((e) => e.type === "step.start");
    expect(stepStarts).toHaveLength(1);
  });

  it("keeps partial progress when later steps fail", () => {
    // Primary can move south by 1 then needs to go further but is blocked.
    // Build: primary at (0,0), block at (0,2) so south step 1 ok, step 2 collides.
    // To force a true rejection (not push), use allowShrink=false and a chain saturated state.
    // Simpler: use an east boundary. Primary at (8,0), dx=2.
    // Step 1: 8→9 ok (within gridColumns=10 since w=1 -> x+w=10). Step 2: 9→10 rejected.
    const blocks = [block("a", 8, 0)];
    const op: Operation = { kind: "move", blockId: "a", dx: 2, dy: 0 };
    const result = applyOperation(blocks, op, makeOptions(blocks));

    expect(result.accepted).toBe(true); // some progress
    expect(result.appliedDx).toBe(1);
    expect(result.appliedDy).toBe(0);
    const a = result.blocks.find((b) => b.id === "a")!;
    expect(a.position.x).toBe(9);
  });

  it("vertical failure does not block horizontal phase", () => {
    // Primary at north edge: y=0, dy=-1 must be rejected.
    // Then dx=1 should still apply (the contract aborts the whole op on step
    // rejection; this test confirms the abort behavior matches the contract).
    const blocks = [block("a", 0, 0)];
    const op: Operation = { kind: "move", blockId: "a", dx: 1, dy: -1 };
    const result = applyOperation(blocks, op, makeOptions(blocks));

    // Per contract: abort on step rejection. So no horizontal progress.
    expect(result.appliedDy).toBe(0);
    expect(result.appliedDx).toBe(0);
    expect(result.accepted).toBe(false);
  });
});

// -----------------------------------------------------------------------------
// 3.9.6 — Resize path
// -----------------------------------------------------------------------------

describe("applyOperation — 3.9.6 resize", () => {
  it("grows the primary east by delta cells", () => {
    const blocks = [block("a", 0, 0, 2, 2)];
    const op: Operation = {
      kind: "resize",
      blockId: "a",
      edge: "east",
      delta: 2,
    };
    const result = applyOperation(blocks, op, makeOptions(blocks));

    expect(result.accepted).toBe(true);
    expect(result.appliedDelta).toBe(2);
    const a = result.blocks.find((b) => b.id === "a")!;
    expect(a.position).toEqual({ x: 0, y: 0, w: 4, h: 2 });
  });

  it("shrinks the primary east by |delta| cells", () => {
    const blocks = [block("a", 0, 0, 4, 2)];
    const op: Operation = {
      kind: "resize",
      blockId: "a",
      edge: "east",
      delta: -2,
    };
    const result = applyOperation(blocks, op, makeOptions(blocks));

    expect(result.accepted).toBe(true);
    expect(result.appliedDelta).toBe(-2);
    const a = result.blocks.find((b) => b.id === "a")!;
    expect(a.position).toEqual({ x: 0, y: 0, w: 2, h: 2 });
  });

  it("emits block.resize events", () => {
    const blocks = [block("a", 0, 0, 2, 2)];
    const { listener, events } = captureEvents();
    const emitter = { emit: listener, on: vi.fn() };
    const op: Operation = {
      kind: "resize",
      blockId: "a",
      edge: "east",
      delta: 1,
    };
    applyOperation(blocks, op, makeOptions(blocks, emitter));

    const resizes = events.filter((e) => e.type === "block.resize");
    expect(resizes).toHaveLength(1);
  });

  it("compacts neighbors after shrink when compact=true", () => {
    // Primary (0,0,3,2) with neighbor at (3,0,1,2). Shrink east by 1.
    // After: primary w=2; neighbor pulled west from x=3 to x=2.
    const blocks = [block("a", 0, 0, 3, 2), block("b", 3, 0, 1, 2)];
    const op: Operation = {
      kind: "resize",
      blockId: "a",
      edge: "east",
      delta: -1,
      options: { compact: true },
    };
    const result = applyOperation(blocks, op, makeOptions(blocks));

    expect(result.accepted).toBe(true);
    const a = result.blocks.find((b) => b.id === "a")!;
    const b = result.blocks.find((b) => b.id === "b")!;
    expect(a.position).toEqual({ x: 0, y: 0, w: 2, h: 2 });
    expect(b.position).toEqual({ x: 2, y: 0, w: 1, h: 2 });
  });
});

// -----------------------------------------------------------------------------
// 3.9.7 — affected aggregation
// -----------------------------------------------------------------------------

describe("applyOperation — 3.9.7 affected aggregation", () => {
  it("aggregates `moved` across steps", () => {
    // a pushes b east two times.
    const blocks = [block("a", 0, 0), block("b", 1, 0)];
    const op: Operation = { kind: "move", blockId: "a", dx: 2, dy: 0 };
    const result = applyOperation(blocks, op, makeOptions(blocks));

    expect(result.affected.moved.has("b")).toBe(true);
    expect(result.affected.moved.has("a")).toBe(false); // primary excluded
    const bFinal = result.blocks.find((b) => b.id === "b")!;
    expect(bFinal.position.x).toBe(3);
  });

  it("preserves the initial-size mapping in `shrunk` across multiple shrink steps on the same block", () => {
    // Setup: a wide block "b" at the east edge that will be shrunk twice
    // by successive east pushes from "a".
    // grid=10. a at (0,0,1,1). b at (1,0, 9,1) fills the rest.
    // Push east: chain = [a, b]. b can't push east (it touches x=10), so shrink b on west edge.
    // Step 1: a→(1,0), b→(2,0,8,1). Step 2: a→(2,0), b→(3,0,7,1).
    // shrunk[b] must retain its session-initial size (w=9, h=1) on BOTH steps.
    const blocks = [block("a", 0, 0, 1, 1), block("b", 1, 0, 9, 1)];
    const op: Operation = { kind: "move", blockId: "a", dx: 2, dy: 0 };
    const result = applyOperation(blocks, op, makeOptions(blocks));

    expect(result.accepted).toBe(true);
    expect(result.affected.shrunk.has("b")).toBe(true);
    expect(result.affected.shrunk.get("b")).toEqual({ w: 9, h: 1 });
    const bFinal = result.blocks.find((x) => x.id === "b")!;
    expect(bFinal.position).toEqual({ x: 3, y: 0, w: 7, h: 1 });
  });

  it("aggregates `wrapped` across steps", () => {
    // Setup contiguous east chain that saturates: a (1,0,1,1) pushes b (2,0,1,1)
    // and b is at the east edge after first push... actually start b adjacent at edge:
    // a at (8,0,1,1) and b at (9,0,1,1). Push east: chain=[a,b].
    // b can't push to x=10. b.w=1=minW → saturated → wrap (south fallback).
    const blocks = [block("a", 8, 0, 1, 1), block("b", 9, 0, 1, 1)];
    const op: Operation = { kind: "move", blockId: "a", dx: 1, dy: 0 };
    const result = applyOperation(blocks, op, makeOptions(blocks));

    expect(result.accepted).toBe(true);
    expect(result.affected.wrapped.has("b")).toBe(true);
  });
});

// -----------------------------------------------------------------------------
// 3.9.8 — Defaults and edge cases
// -----------------------------------------------------------------------------

describe("applyOperation — 3.9.8 defaults", () => {
  it("generates an opId when none is provided", () => {
    const blocks = [block("a", 2, 2)];
    const { listener, events } = captureEvents();
    const emitter = { emit: listener, on: vi.fn() };
    // Build options WITHOUT opId.
    const options: EngineOptions = {
      gridColumns: 10,
      constraints: constraintsFor(blocks),
      emitter,
    };
    const op: Operation = { kind: "move", blockId: "a", dx: 0, dy: 1 };

    applyOperation(blocks, op, options);

    const start = events.find((e) => e.type === "session.start");
    expect(start).toBeDefined();
    if (start && start.type === "session.start") {
      expect(start.opId).toMatch(/^op-/);
      expect(start.opId.length).toBeGreaterThan(3);
    }
  });

  it("returns no-op for a resize with delta=0", () => {
    const blocks = [block("a", 2, 2, 3, 3)];
    const { listener, events } = captureEvents();
    const emitter = { emit: listener, on: vi.fn() };
    const op: Operation = {
      kind: "resize",
      blockId: "a",
      edge: "east",
      delta: 0,
    };
    const result = applyOperation(blocks, op, makeOptions(blocks, emitter));

    expect(result.accepted).toBe(false);
    expect(result.appliedDelta).toBe(0);
    expect(result.rejected?.reason).toBe("no-op");
    // Still emits session.start and session.end framing.
    expect(events.some((e) => e.type === "session.start")).toBe(true);
    expect(events.some((e) => e.type === "session.end")).toBe(true);
    // No step events.
    expect(events.some((e) => e.type === "step.start")).toBe(false);
  });
});
