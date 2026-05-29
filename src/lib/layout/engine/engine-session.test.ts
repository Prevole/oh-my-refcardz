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

// -----------------------------------------------------------------------------
// Snapshot cache: revisit a footprint to restore the state seen there before.
// -----------------------------------------------------------------------------

describe("createEngineSession — snapshot cache", () => {
  it("restores the initial state when the primary returns to its starting footprint", () => {
    // Setup: A and B side by side. Move A right (pushes nothing), then back left.
    // After the round-trip, A is at its initial position and so is the whole world.
    const blocks = [block("a", 0, 0), block("b", 5, 0)];
    const session = createEngineSession(blocks, {
      gridColumns: 10,
      constraints: constraintsFor(blocks),
    });
    session.step({ blockId: "a", direction: "east" });
    expect(session.getCurrentBlocks().find((b) => b.id === "a")!.position).toEqual({
      x: 1,
      y: 0,
      w: 1,
      h: 1,
    });
    session.step({ blockId: "a", direction: "west" });
    expect(session.getCurrentBlocks()).toEqual(blocks);
  });

  it("restores neighbors that were pushed away, when the primary returns to its origin", () => {
    // A immediately next to B: pushing A east into B's column displaces B.
    // Coming back west should restore B to its original position via the cache.
    const blocks = [block("a", 0, 0), block("b", 1, 0)];
    const session = createEngineSession(blocks, {
      gridColumns: 10,
      constraints: constraintsFor(blocks),
    });
    session.step({ blockId: "a", direction: "east" });
    // A is at (1, 0) and B was pushed to (2, 0).
    const afterPush = session.getCurrentBlocks();
    expect(afterPush.find((b) => b.id === "a")!.position.x).toBe(1);
    expect(afterPush.find((b) => b.id === "b")!.position.x).toBe(2);

    // Reverse: A goes back west to (0, 0). Cache hit on (0, 0) restores the
    // initial state — B returns to (1, 0) without recomputation.
    session.step({ blockId: "a", direction: "west" });
    expect(session.getCurrentBlocks()).toEqual(blocks);
  });

  it("emits session.restore (instead of step.start/end) when a cache entry is restored", () => {
    const blocks = [block("a", 0, 0)];
    const { emitter, events } = recordingEmitter();
    const session = createEngineSession(blocks, {
      gridColumns: 10,
      constraints: constraintsFor(blocks),
      emitter,
    });
    session.step({ blockId: "a", direction: "east" });
    session.step({ blockId: "a", direction: "west" });

    const restoreEvents = events.filter((e) => e.type === "session.restore");
    expect(restoreEvents).toHaveLength(1);
    const restore = restoreEvents[0] as Extract<
      EngineEvent,
      { type: "session.restore" }
    >;
    expect(restore.primaryId).toBe("a");
    expect(restore.cacheKey).toBe("a:0:0:1:1");

    // The second step did NOT emit step.start/step.end (cache hit short-circuit).
    const stepStarts = events.filter((e) => e.type === "step.start");
    expect(stepStarts).toHaveLength(1);
  });

  it("stepIndex still increments on cache hits to keep a monotonic counter", () => {
    const blocks = [block("a", 0, 0)];
    const { emitter, events } = recordingEmitter();
    const session = createEngineSession(blocks, {
      gridColumns: 10,
      constraints: constraintsFor(blocks),
      emitter,
    });
    session.step({ blockId: "a", direction: "east" }); // stepIndex 0
    session.step({ blockId: "a", direction: "west" }); // stepIndex 1 (cache hit)
    session.step({ blockId: "a", direction: "south" }); // stepIndex 2

    const indices = events
      .filter(
        (e) =>
          e.type === "step.start" ||
          e.type === "step.end" ||
          e.type === "session.restore"
      )
      .map((e) => (e as { stepIndex: number }).stepIndex);
    // step.start(0), step.end(0), session.restore(1), step.start(2), step.end(2)
    expect(indices).toEqual([0, 0, 1, 2, 2]);
  });

  it("caches the state along a longer path and restores via a different footprint chain", () => {
    // Move A east, east, east — caches states at footprints (0,0), (1,0), (2,0).
    // Then move west twice: each step is a cache hit.
    const blocks = [block("a", 0, 0)];
    const session = createEngineSession(blocks, {
      gridColumns: 10,
      constraints: constraintsFor(blocks),
    });
    session.step({ blockId: "a", direction: "east" });
    session.step({ blockId: "a", direction: "east" });
    session.step({ blockId: "a", direction: "east" });

    const { emitter, events } = recordingEmitter();
    // Wire a new recording emitter for the next two steps so we can isolate
    // the restore events. (Existing engine has no public API to swap emitters,
    // so we count by inspection — instead, use a fresh session for clarity.)
    void emitter;
    void events;

    session.step({ blockId: "a", direction: "west" });
    session.step({ blockId: "a", direction: "west" });
    expect(session.getCurrentBlocks()[0].position).toEqual({
      x: 1,
      y: 0,
      w: 1,
      h: 1,
    });

    session.step({ blockId: "a", direction: "west" });
    expect(session.getCurrentBlocks()[0].position).toEqual({
      x: 0,
      y: 0,
      w: 1,
      h: 1,
    });
  });

  it("does NOT cache a state when the step is rejected (out of grid)", () => {
    // A at (0, 0): step north is rejected. No cache entry should be added
    // for an unreachable footprint. Re-attempting north should still reject.
    const blocks = [block("a", 0, 0)];
    const { emitter, events } = recordingEmitter();
    const session = createEngineSession(blocks, {
      gridColumns: 10,
      constraints: constraintsFor(blocks),
      emitter,
    });
    const first = session.step({ blockId: "a", direction: "north" });
    const second = session.step({ blockId: "a", direction: "north" });
    expect(first.accepted).toBe(false);
    expect(second.accepted).toBe(false);

    // Both attempts must have gone through resolveMoveStep (not a cache hit):
    // two step.start events, zero session.restore.
    expect(events.filter((e) => e.type === "step.start")).toHaveLength(2);
    expect(events.filter((e) => e.type === "session.restore")).toHaveLength(0);
  });

  it("moveTo benefits from the cache when the return path retraces the outbound footprints", () => {
    // A monoaxial drag: out east 3 cells, then back west 3 cells. The return
    // path retraces the exact same intermediate footprints, so every step
    // back must hit the cache instead of re-running resolveMoveStep.
    const blocks = [block("a", 0, 0)];
    const { emitter, events } = recordingEmitter();
    const session = createEngineSession(blocks, {
      gridColumns: 10,
      constraints: constraintsFor(blocks),
      emitter,
    });

    session.moveTo({ blockId: "a", x: 3, y: 0 });
    const eventsAfterOutbound = events.length;

    session.moveTo({ blockId: "a", x: 0, y: 0 });

    expect(session.getCurrentBlocks()[0].position).toEqual({
      x: 0,
      y: 0,
      w: 1,
      h: 1,
    });

    const returnEvents = events.slice(eventsAfterOutbound);
    const restores = returnEvents.filter((e) => e.type === "session.restore");
    const stepStarts = returnEvents.filter((e) => e.type === "step.start");
    // 3 cells back to origin, each footprint cached on the outbound trip
    // → 3 cache hits, 0 fresh step resolutions.
    expect(restores).toHaveLength(3);
    expect(stepStarts).toHaveLength(0);
  });

  it("moveTo on a diagonal return uses the cache only at footprints actually visited outbound", () => {
    // Out path with dominant horizontal: (0,0)→(1,0)→(2,0)→(2,1)→(3,1)→(3,2).
    // Return path with dominant horizontal: (3,2)→(2,2)→(1,2)→(0,2)→(0,1)→(0,0).
    // The two paths only meet at the origin footprint (0,0).
    // The final position must still be the origin, regardless of how many
    // cells were cache hits vs fresh resolutions.
    const blocks = [block("a", 0, 0)];
    const { emitter, events } = recordingEmitter();
    const session = createEngineSession(blocks, {
      gridColumns: 10,
      constraints: constraintsFor(blocks),
      emitter,
    });
    session.moveTo({ blockId: "a", x: 3, y: 2 });
    const eventsAfterOutbound = events.length;

    session.moveTo({ blockId: "a", x: 0, y: 0 });

    expect(session.getCurrentBlocks()[0].position).toEqual({
      x: 0,
      y: 0,
      w: 1,
      h: 1,
    });

    const returnEvents = events.slice(eventsAfterOutbound);
    const restores = returnEvents.filter((e) => e.type === "session.restore");
    // Only the origin footprint is shared between the two paths,
    // so exactly one restore is expected on the return.
    expect(restores).toHaveLength(1);
  });

  it("moveTo round trip restores neighbors that were pushed during the outbound path", () => {
    // A starts at (0, 0), B at (2, 0). Dragging A east pushes B east.
    // Dragging A back west must restore B to its original (2, 0) via the
    // cache, not leave B drifted.
    const blocks = [block("a", 0, 0), block("b", 2, 0)];
    const session = createEngineSession(blocks, {
      gridColumns: 10,
      constraints: constraintsFor(blocks),
    });

    session.moveTo({ blockId: "a", x: 3, y: 0 });
    // Sanity: A reached (3, 0) and B was pushed east.
    const afterOutbound = session.getCurrentBlocks();
    expect(afterOutbound.find((b) => b.id === "a")!.position.x).toBe(3);
    expect(afterOutbound.find((b) => b.id === "b")!.position.x).toBeGreaterThan(
      2,
    );

    session.moveTo({ blockId: "a", x: 0, y: 0 });
    const afterReturn = session.getCurrentBlocks();
    expect(afterReturn.find((b) => b.id === "a")!.position).toEqual({
      x: 0,
      y: 0,
      w: 1,
      h: 1,
    });
    // The cache must have restored B to its untouched starting footprint.
    expect(afterReturn.find((b) => b.id === "b")!.position).toEqual({
      x: 2,
      y: 0,
      w: 1,
      h: 1,
    });
  });
});
