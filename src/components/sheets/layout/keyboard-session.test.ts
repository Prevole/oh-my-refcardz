/**
 * KeyboardSession tests.
 *
 * Covers:
 *   - lifecycle (cancel, commit, double-close safety)
 *   - apply: change detection, counter increments, no-op handling, option
 *     leakage prevention across keystrokes
 *   - reset: returns to initial snapshot, zeroes counter
 *   - replaceContents: undo/redo semantics, clamping, force-0 on initial
 *   - cache reversibility: revisiting a footprint restores the previously
 *     computed layout (this is the main reason the session exists)
 *   - emitter provider: events are routed dynamically per emission
 */

import { describe, expect, it, vi } from "vitest";

import {
  blocksEqual,
  createKeyboardSession,
  type SessionContext,
} from "./keyboard-session";
import type {
  BlockConstraints,
  EngineEvent,
  EngineEventEmitter,
  LayoutBlock,
  MoveOperation,
  ResizeOperation,
} from "@/lib/layout/engine";

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

const GRID_COLUMNS = 64;

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

function ctxFor(blocks: readonly LayoutBlock[]): SessionContext {
  return { gridColumns: GRID_COLUMNS, constraints: constraintsFor(blocks) };
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

describe("createKeyboardSession — lifecycle", () => {
  it("initialises with the supplied snapshot and a zero counter", () => {
    const snapshot = [block("a", 0, 0)];
    const s = createKeyboardSession(snapshot, ctxFor(snapshot));
    expect(s.getCurrentBlocks()).toBe(snapshot);
    expect(s.getChangesCount()).toBe(0);
  });

  it("commit returns the current staged blocks and closes the session", () => {
    const snapshot = [block("a", 5, 0)];
    const s = createKeyboardSession(snapshot, ctxFor(snapshot));
    const op: MoveOperation = { kind: "move", blockId: "a", dx: 1, dy: 0 };
    s.apply(op);
    const committed = s.commit();
    expect(committed[0].position.x).toBe(6);
    expect(() => s.apply(op)).toThrow(/commit\/cancel/);
  });

  it("cancel closes the session silently and is idempotent", () => {
    const snapshot = [block("a", 0, 0)];
    const s = createKeyboardSession(snapshot, ctxFor(snapshot));
    s.cancel();
    s.cancel(); // idempotent
    const op: MoveOperation = { kind: "move", blockId: "a", dx: 1, dy: 0 };
    expect(() => s.apply(op)).toThrow(/commit\/cancel/);
  });

  it("commit on a fresh session returns the initial snapshot", () => {
    const snapshot = [block("a", 0, 0)];
    const s = createKeyboardSession(snapshot, ctxFor(snapshot));
    const committed = s.commit();
    expect(blocksEqual(committed, snapshot)).toBe(true);
  });
});

// -----------------------------------------------------------------------------
// apply
// -----------------------------------------------------------------------------

describe("createKeyboardSession — apply", () => {
  it("increments changesCount and updates current blocks when the layout changes", () => {
    const snapshot = [block("a", 5, 0)];
    const s = createKeyboardSession(snapshot, ctxFor(snapshot));
    const op: MoveOperation = { kind: "move", blockId: "a", dx: 1, dy: 0 };
    const out = s.apply(op);
    expect(out.changed).toBe(true);
    expect(out.changesCount).toBe(1);
    expect(out.blocks[0].position.x).toBe(6);
    expect(s.getChangesCount()).toBe(1);
  });

  it("does not increment changesCount when the engine produces a no-op", () => {
    // A block at x=0 cannot move further west in strict mode.
    const snapshot = [block("a", 0, 0)];
    const s = createKeyboardSession(snapshot, ctxFor(snapshot));
    const strictWest: MoveOperation = {
      kind: "move",
      blockId: "a",
      dx: -1,
      dy: 0,
      options: { allowWrap: false, allowShrink: false },
    };
    const out = s.apply(strictWest);
    expect(out.changed).toBe(false);
    expect(out.changesCount).toBe(0);
    expect(s.getChangesCount()).toBe(0);
  });

  it("accumulates changesCount across multiple successful operations", () => {
    const snapshot = [block("a", 5, 5)];
    const s = createKeyboardSession(snapshot, ctxFor(snapshot));
    for (let i = 0; i < 5; i++) {
      s.apply({ kind: "move", blockId: "a", dx: 1, dy: 0 });
    }
    expect(s.getChangesCount()).toBe(5);
    expect(s.getCurrentBlocks()[0].position.x).toBe(10);
  });

  it("treats a resize with delta=0 as a no-op", () => {
    const snapshot = [block("a", 5, 5)];
    const s = createKeyboardSession(snapshot, ctxFor(snapshot));
    const op: ResizeOperation = {
      kind: "resize",
      blockId: "a",
      edge: "east",
      delta: 0,
    };
    const out = s.apply(op);
    expect(out.changed).toBe(false);
    expect(out.changesCount).toBe(0);
  });

  it("does not leak strict options from a prior keystroke", () => {
    // Block at x=1, w=1: strict east cannot push past the right edge of a
    // 1-col grid; permissive east wraps to (0, y+1). We use a wider grid
    // to keep things simple: prior strict op succeeds in moving east, the
    // next op with no options must default to permissive flags so that
    // engine semantics aren't polluted by the previous setOperationOptions.
    //
    // The cleanest way to test this is via the resize edge: strict
    // disallows shrink past minW. A 1-wide block + strict shrink would be
    // rejected. After that, a non-strict shrink should also be rejected
    // for the same minW reason (so this test would not distinguish), but
    // a non-strict grow that wraps must succeed where a strict grow that
    // would wrap would fail.
    //
    // Instead we rely on the documented contract: resolveKeystrokeOptions
    // produces a fully-resolved object and pushes it via
    // setOperationOptions on every apply. We assert by observing that
    // after a strict op, a permissive op behaves as permissive.
    const snapshot = [
      block("a", 0, 0, 4, 2),
      block("b", 4, 0, 4, 2),
    ];
    const s = createKeyboardSession(snapshot, ctxFor(snapshot));

    // First: strict move east on a — would push b. Strict mode forbids
    // moving b (which would itself require a push), so the op may be
    // rejected. Whatever it does, it sets strict in the underlying engine.
    s.apply({
      kind: "move",
      blockId: "a",
      dx: 1,
      dy: 0,
      options: { allowWrap: false, allowShrink: false },
    });

    // Snapshot post-strict.
    const afterStrict = s.getCurrentBlocks();

    // Now: permissive move east on a. The next setOperationOptions call
    // must restore permissive flags so b can be pushed/wrapped/shrunk.
    s.apply({ kind: "move", blockId: "a", dx: 1, dy: 0 });

    // If options had leaked, this would behave identically to the strict
    // call above. With proper normalisation, the permissive call should
    // have produced a different layout (b pushed or wrapped). We accept
    // any layout change vs the strict snapshot as evidence the strict
    // flags were cleared.
    expect(blocksEqual(s.getCurrentBlocks(), afterStrict)).toBe(false);
  });
});

// -----------------------------------------------------------------------------
// reset
// -----------------------------------------------------------------------------

describe("createKeyboardSession — reset", () => {
  it("rewinds to the initial snapshot and zeroes the counter", () => {
    const snapshot = [block("a", 5, 0)];
    const s = createKeyboardSession(snapshot, ctxFor(snapshot));
    s.apply({ kind: "move", blockId: "a", dx: 1, dy: 0 });
    s.apply({ kind: "move", blockId: "a", dx: 1, dy: 0 });
    expect(s.getChangesCount()).toBe(2);
    const out = s.reset();
    expect(out).toBe(snapshot);
    expect(s.getCurrentBlocks()).toBe(snapshot);
    expect(s.getChangesCount()).toBe(0);
  });

  it("leaves the session usable after reset", () => {
    const snapshot = [block("a", 5, 0)];
    const s = createKeyboardSession(snapshot, ctxFor(snapshot));
    s.apply({ kind: "move", blockId: "a", dx: 1, dy: 0 });
    s.reset();
    const out = s.apply({ kind: "move", blockId: "a", dx: 1, dy: 0 });
    expect(out.changed).toBe(true);
    expect(out.changesCount).toBe(1);
    expect(out.blocks[0].position.x).toBe(6);
  });

  it("throws when called after commit/cancel", () => {
    const snapshot = [block("a", 0, 0)];
    const s = createKeyboardSession(snapshot, ctxFor(snapshot));
    s.commit();
    expect(() => s.reset()).toThrow(/commit\/cancel/);
  });
});

// -----------------------------------------------------------------------------
// replaceContents
// -----------------------------------------------------------------------------

describe("createKeyboardSession — replaceContents", () => {
  it("writes the snapshot and applies the delta to changesCount", () => {
    const initial = [block("a", 0, 0)];
    const s = createKeyboardSession(initial, ctxFor(initial));
    s.apply({ kind: "move", blockId: "a", dx: 1, dy: 0 });
    s.apply({ kind: "move", blockId: "a", dx: 1, dy: 0 });
    expect(s.getChangesCount()).toBe(2);

    // Undo one step: provide the layout after the first move (synthesised
    // here as a known state), delta -1.
    const oneStep = [block("a", 1, 0)];
    const out = s.replaceContents(oneStep, -1);
    expect(out).toBe(oneStep);
    expect(s.getCurrentBlocks()).toBe(oneStep);
    expect(s.getChangesCount()).toBe(1);
  });

  it("clamps changesCount to 0 when the delta would push it negative", () => {
    const initial = [block("a", 0, 0)];
    const s = createKeyboardSession(initial, ctxFor(initial));
    s.apply({ kind: "move", blockId: "a", dx: 1, dy: 0 });
    expect(s.getChangesCount()).toBe(1);
    // Snapshot differs from initial, so the clamp leaves max(0, 1-5) = 0.
    const snapshot = [block("a", 3, 0)];
    s.replaceContents(snapshot, -5);
    expect(s.getChangesCount()).toBe(0);
  });

  it("forces changesCount to 0 when the snapshot equals the initial snapshot structurally", () => {
    const initial = [block("a", 0, 0)];
    const s = createKeyboardSession(initial, ctxFor(initial));
    s.apply({ kind: "move", blockId: "a", dx: 1, dy: 0 });
    // A different array, structurally equal to initial.
    const equivalent = [block("a", 0, 0)];
    s.replaceContents(equivalent, +1);
    expect(s.getChangesCount()).toBe(0);
  });

  it("leaves the session usable after replaceContents", () => {
    const initial = [block("a", 0, 0)];
    const s = createKeyboardSession(initial, ctxFor(initial));
    const next = [block("a", 5, 0)];
    s.replaceContents(next, +1);
    const out = s.apply({ kind: "move", blockId: "a", dx: 1, dy: 0 });
    expect(out.changed).toBe(true);
    expect(out.blocks[0].position.x).toBe(6);
    expect(out.changesCount).toBe(2);
  });

  it("throws when called after commit/cancel", () => {
    const snapshot = [block("a", 0, 0)];
    const s = createKeyboardSession(snapshot, ctxFor(snapshot));
    s.commit();
    expect(() => s.replaceContents(snapshot, 0)).toThrow(/commit\/cancel/);
  });
});

// -----------------------------------------------------------------------------
// Cache reversibility (the main motivation)
// -----------------------------------------------------------------------------

describe("createKeyboardSession — cache reversibility", () => {
  it("restores the previously computed layout when revisiting a footprint", () => {
    // Two adjacent blocks: moving 'a' east into 'b' should push 'b'.
    // Coming back west should restore the original layout exactly.
    const initial = [block("a", 0, 0, 4, 2), block("b", 4, 0, 4, 2)];
    const s = createKeyboardSession(initial, ctxFor(initial));

    s.apply({ kind: "move", blockId: "a", dx: 1, dy: 0 });
    const pushed = s.getCurrentBlocks();
    // a is now at x=1, and b is somewhere different from x=4.
    expect(pushed[0].position.x).toBe(1);

    s.apply({ kind: "move", blockId: "a", dx: -1, dy: 0 });
    const restored = s.getCurrentBlocks();
    expect(blocksEqual(restored, initial)).toBe(true);
  });
});

// -----------------------------------------------------------------------------
// Emitter provider
// -----------------------------------------------------------------------------

describe("createKeyboardSession — emitter provider", () => {
  it("forwards the dynamic emitter to the underlying engine session", () => {
    const initial = [block("a", 0, 0), block("b", 5, 0)];
    const r1 = recordingEmitter();
    let current: EngineEventEmitter | undefined = r1.emitter;
    const s = createKeyboardSession(initial, {
      ...ctxFor(initial),
      emitterProvider: () => current,
    });

    s.apply({ kind: "move", blockId: "a", dx: 1, dy: 0 });
    expect(r1.events.length).toBeGreaterThan(0);

    // Drop the emitter mid-session: subsequent events are silently dropped.
    const r1Count = r1.events.length;
    current = undefined;
    s.apply({ kind: "move", blockId: "a", dx: 1, dy: 0 });
    expect(r1.events.length).toBe(r1Count);
  });
});

// -----------------------------------------------------------------------------
// blocksEqual
// -----------------------------------------------------------------------------

describe("blocksEqual", () => {
  it("returns true for the same reference", () => {
    const a = [block("a", 0, 0)];
    expect(blocksEqual(a, a)).toBe(true);
  });

  it("returns true for structurally identical arrays of different references", () => {
    const a = [block("a", 1, 2, 3, 4), block("b", 5, 6)];
    const b = [block("a", 1, 2, 3, 4), block("b", 5, 6)];
    expect(blocksEqual(a, b)).toBe(true);
  });

  it("returns false when length differs", () => {
    expect(blocksEqual([block("a", 0, 0)], [])).toBe(false);
  });

  it("returns false when ids differ", () => {
    expect(blocksEqual([block("a", 0, 0)], [block("b", 0, 0)])).toBe(false);
  });

  it("returns false when positions differ on any axis", () => {
    expect(blocksEqual([block("a", 0, 0)], [block("a", 1, 0)])).toBe(false);
    expect(blocksEqual([block("a", 0, 0)], [block("a", 0, 1)])).toBe(false);
    expect(blocksEqual([block("a", 0, 0, 4, 2)], [block("a", 0, 0, 5, 2)])).toBe(
      false,
    );
    expect(blocksEqual([block("a", 0, 0, 4, 2)], [block("a", 0, 0, 4, 3)])).toBe(
      false,
    );
  });
});
