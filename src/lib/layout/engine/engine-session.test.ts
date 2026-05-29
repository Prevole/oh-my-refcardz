/**
 * EngineSession tests.
 *
 * Covers the stateful session API: step, moveTo, resize, commit, cancel.
 * The cache layer is added in a follow-up commit; these tests document the
 * pre-cache behavior (each step recomputes from the current working state).
 */

import { describe, expect, it, vi } from "vitest";

import { createEngineSession } from "./engine-session";
import type {
  BlockConstraints,
  EngineEvent,
  EngineEventEmitter,
  LayoutBlock,
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

function recordingEmitter(): {
  emitter: EngineEventEmitter;
  events: EngineEvent[];
} {
  const events: EngineEvent[] = [];
  return {
    emitter: { emit: (e) => events.push(e), on: vi.fn() },
    events,
  };
}

// -----------------------------------------------------------------------------
// Lifecycle
// -----------------------------------------------------------------------------

describe("createEngineSession — lifecycle", () => {
  it("returns the initial blocks via getCurrentBlocks before any step", () => {
    const blocks = [block("a", 2, 2)];
    const session = createEngineSession(blocks, {
      gridColumns: 10,
      constraints: constraintsFor(blocks),
    });
    expect(session.getCurrentBlocks()).toEqual(blocks);
  });

  it("getCurrentBlocks returns a fresh clone each time", () => {
    const blocks = [block("a", 2, 2)];
    const session = createEngineSession(blocks, {
      gridColumns: 10,
      constraints: constraintsFor(blocks),
    });
    const view1 = session.getCurrentBlocks();
    const view2 = session.getCurrentBlocks();
    expect(view1).not.toBe(view2);
    expect(view1[0]).not.toBe(view2[0]);
    expect(view1[0].position).not.toBe(view2[0].position);
  });

  it("commit returns the current state and seals the session", () => {
    const blocks = [block("a", 2, 2)];
    const session = createEngineSession(blocks, {
      gridColumns: 10,
      constraints: constraintsFor(blocks),
    });
    const final = session.commit();
    expect(final).toEqual(blocks);
    expect(() => session.step({ blockId: "a", direction: "south" })).toThrow(
      /commit\/cancel/
    );
  });

  it("cancel returns the initial state and seals the session", () => {
    const blocks = [block("a", 2, 2)];
    const session = createEngineSession(blocks, {
      gridColumns: 10,
      constraints: constraintsFor(blocks),
    });
    session.step({ blockId: "a", direction: "south" });
    const restored = session.cancel();
    expect(restored).toEqual(blocks);
    expect(() => session.commit()).toThrow(/commit\/cancel/);
  });

  it("does not mutate the input array", () => {
    const blocks = [block("a", 2, 2)];
    const session = createEngineSession(blocks, {
      gridColumns: 10,
      constraints: constraintsFor(blocks),
    });
    session.step({ blockId: "a", direction: "south" });
    expect(blocks[0].position).toEqual({ x: 2, y: 2, w: 1, h: 1 });
  });
});

// -----------------------------------------------------------------------------
// step (unit movement)
// -----------------------------------------------------------------------------

describe("createEngineSession — step", () => {
  it("applies a single south step", () => {
    const blocks = [block("a", 2, 2)];
    const session = createEngineSession(blocks, {
      gridColumns: 10,
      constraints: constraintsFor(blocks),
    });
    const outcome = session.step({ blockId: "a", direction: "south" });
    expect(outcome.accepted).toBe(true);
    expect(session.getCurrentBlocks()[0].position).toEqual({
      x: 2,
      y: 3,
      w: 1,
      h: 1,
    });
  });

  it("accumulates multiple steps in the working state", () => {
    const blocks = [block("a", 2, 2)];
    const session = createEngineSession(blocks, {
      gridColumns: 10,
      constraints: constraintsFor(blocks),
    });
    session.step({ blockId: "a", direction: "south" });
    session.step({ blockId: "a", direction: "south" });
    session.step({ blockId: "a", direction: "east" });
    expect(session.getCurrentBlocks()[0].position).toEqual({
      x: 3,
      y: 4,
      w: 1,
      h: 1,
    });
  });

  it("rejects a step that would push the primary out of the grid", () => {
    const blocks = [block("a", 0, 0)];
    const session = createEngineSession(blocks, {
      gridColumns: 10,
      constraints: constraintsFor(blocks),
    });
    const outcome = session.step({ blockId: "a", direction: "north" });
    expect(outcome.accepted).toBe(false);
    expect(outcome.reason).toMatch(/primary-hit-edge/);
    expect(session.getCurrentBlocks()[0].position).toEqual({
      x: 0,
      y: 0,
      w: 1,
      h: 1,
    });
  });

  it("throws when primary id is unknown", () => {
    const blocks = [block("a", 2, 2)];
    const session = createEngineSession(blocks, {
      gridColumns: 10,
      constraints: constraintsFor(blocks),
    });
    expect(() => session.step({ blockId: "ghost", direction: "south" })).toThrow(
      /not found/
    );
  });

  it("emits one step.start / step.end pair per call with a monotonic stepIndex", () => {
    const blocks = [block("a", 2, 2)];
    const { emitter, events } = recordingEmitter();
    const session = createEngineSession(blocks, {
      gridColumns: 10,
      constraints: constraintsFor(blocks),
      emitter,
    });
    session.step({ blockId: "a", direction: "south" });
    session.step({ blockId: "a", direction: "east" });

    const stepEvents = events.filter(
      (e) => e.type === "step.start" || e.type === "step.end"
    );
    expect(stepEvents.map((e) => (e as { stepIndex: number }).stepIndex)).toEqual([
      0, 0, 1, 1,
    ]);
  });
});

// -----------------------------------------------------------------------------
// moveTo (path decomposition)
// -----------------------------------------------------------------------------

describe("createEngineSession — moveTo", () => {
  it("reaches the target on an obstacle-free path", () => {
    const blocks = [block("a", 0, 0)];
    const session = createEngineSession(blocks, {
      gridColumns: 10,
      constraints: constraintsFor(blocks),
    });
    const outcome = session.moveTo({ blockId: "a", x: 3, y: 2 });
    expect(outcome.reachedTarget).toBe(true);
    expect(outcome.stepsApplied).toBe(5);
    expect(session.getCurrentBlocks()[0].position).toEqual({
      x: 3,
      y: 2,
      w: 1,
      h: 1,
    });
  });

  it("steps along the dominant axis first (more horizontal than vertical)", () => {
    const blocks = [block("a", 0, 0)];
    const { emitter, events } = recordingEmitter();
    const session = createEngineSession(blocks, {
      gridColumns: 10,
      constraints: constraintsFor(blocks),
      emitter,
    });
    // dx=4, dy=1 → dominant axis is horizontal; expect east, east, east, east, south
    // (or interleaved with the dominant axis taking priority each iteration).
    session.moveTo({ blockId: "a", x: 4, y: 1 });
    const stepStarts = events.filter((e) => e.type === "step.start");
    expect(stepStarts).toHaveLength(5);
    // First step must be along the dominant axis.
    expect((stepStarts[0] as { direction: string }).direction).toBe("east");
  });

  it("returns reachedTarget=false and stops when a step is rejected", () => {
    const blocks = [block("a", 0, 0)];
    const session = createEngineSession(blocks, {
      gridColumns: 10,
      constraints: constraintsFor(blocks),
    });
    // Target requires going north from y=0 → impossible immediately.
    const outcome = session.moveTo({ blockId: "a", x: 0, y: -2 });
    expect(outcome.reachedTarget).toBe(false);
    expect(outcome.stepsApplied).toBe(0);
    expect(session.getCurrentBlocks()[0].position).toEqual({
      x: 0,
      y: 0,
      w: 1,
      h: 1,
    });
  });

  it("is a no-op when target equals current position", () => {
    const blocks = [block("a", 3, 3)];
    const session = createEngineSession(blocks, {
      gridColumns: 10,
      constraints: constraintsFor(blocks),
    });
    const outcome = session.moveTo({ blockId: "a", x: 3, y: 3 });
    expect(outcome.reachedTarget).toBe(true);
    expect(outcome.stepsApplied).toBe(0);
  });
});

// -----------------------------------------------------------------------------
// resize
// -----------------------------------------------------------------------------

describe("createEngineSession — resize", () => {
  it("grows the primary by one cell on the requested edge", () => {
    const blocks = [block("a", 2, 2, 2, 2)];
    const session = createEngineSession(blocks, {
      gridColumns: 10,
      constraints: constraintsFor(blocks),
    });
    const outcome = session.resize({
      blockId: "a",
      edge: "east",
      direction: "grow",
    });
    expect(outcome.accepted).toBe(true);
    expect(session.getCurrentBlocks()[0].position).toEqual({
      x: 2,
      y: 2,
      w: 3,
      h: 2,
    });
  });

  it("shrinks the primary by one cell on the requested edge", () => {
    const blocks = [block("a", 2, 2, 3, 3)];
    const session = createEngineSession(blocks, {
      gridColumns: 10,
      constraints: constraintsFor(blocks),
    });
    const outcome = session.resize({
      blockId: "a",
      edge: "east",
      direction: "shrink",
    });
    expect(outcome.accepted).toBe(true);
    expect(session.getCurrentBlocks()[0].position).toEqual({
      x: 2,
      y: 2,
      w: 2,
      h: 3,
    });
  });
});
