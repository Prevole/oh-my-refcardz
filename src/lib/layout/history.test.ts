/**
 * LayoutHistory tests (Phase H).
 *
 * Covers the cursor-based history that backs the layout undo/redo system.
 *
 * Conceptual model:
 *   past: [e0, e1, ..., en-1]   present: en    future: [en+1, ...]
 *
 *  - `push(snapshot, source)` drops `future`, moves `present` into `past`, and
 *    makes a new entry `{ snapshot, source }` the new present. The very first
 *    push is the initial anchor (no past, no future).
 *  - `undo()` pops the last entry from `past` into `present`, and pushes the
 *    previous present onto the front of `future`. Returns the new present, or
 *    `null` if `past` is empty.
 *  - `redo()` does the reverse. Returns `null` if `future` is empty.
 *  - The capacity caps the length of `past` only; oldest entries are dropped.
 *  - Snapshots are stored by reference (the caller must not mutate them).
 *  - Each entry carries a `source` ("mouse" | "keyboard") so the owner can
 *    decide where to write back on undo/redo.
 */

import { describe, expect, it } from "vitest";

import { createLayoutHistory } from "./history";
import type { LayoutBlock } from "./engine";

function block(id: string, x: number, y: number): LayoutBlock {
  return { id, kind: "card", position: { x, y, w: 1, h: 1 } };
}

function snap(...blocks: LayoutBlock[]): readonly LayoutBlock[] {
  return blocks;
}

describe("createLayoutHistory — empty state", () => {
  it("starts with canUndo=false and canRedo=false", () => {
    const h = createLayoutHistory();
    expect(h.canUndo()).toBe(false);
    expect(h.canRedo()).toBe(false);
  });

  it("reports size {past: 0, future: 0} when empty", () => {
    const h = createLayoutHistory();
    expect(h.size()).toEqual({ past: 0, future: 0 });
  });

  it("undo() on empty history returns null", () => {
    const h = createLayoutHistory();
    expect(h.undo()).toBeNull();
  });

  it("redo() on empty history returns null", () => {
    const h = createLayoutHistory();
    expect(h.redo()).toBeNull();
  });
});

describe("createLayoutHistory — anchoring", () => {
  it("first push establishes the present without enabling undo", () => {
    const h = createLayoutHistory();
    h.push(snap(block("a", 0, 0)), "mouse");

    expect(h.canUndo()).toBe(false);
    expect(h.canRedo()).toBe(false);
    expect(h.size()).toEqual({ past: 0, future: 0 });
  });
});

describe("createLayoutHistory — push and undo", () => {
  it("two pushes enable undo, undo returns the first snapshot and its source", () => {
    const h = createLayoutHistory();
    const s0 = snap(block("a", 0, 0));
    const s1 = snap(block("a", 1, 0));
    h.push(s0, "mouse");
    h.push(s1, "keyboard");

    expect(h.canUndo()).toBe(true);
    expect(h.canRedo()).toBe(false);
    expect(h.size()).toEqual({ past: 1, future: 0 });

    const result = h.undo();
    expect(result).toEqual({ snapshot: s0, source: "mouse" });
    expect(h.canUndo()).toBe(false);
    expect(h.canRedo()).toBe(true);
    expect(h.size()).toEqual({ past: 0, future: 1 });
  });

  it("undo preserves snapshot reference (no defensive cloning)", () => {
    const h = createLayoutHistory();
    const s0 = snap(block("a", 0, 0));
    const s1 = snap(block("a", 1, 0));
    h.push(s0, "mouse");
    h.push(s1, "mouse");

    expect(h.undo()?.snapshot).toBe(s0);
  });

  it("multiple undos walk back through the past in order, preserving sources", () => {
    const h = createLayoutHistory();
    const s0 = snap(block("a", 0, 0));
    const s1 = snap(block("a", 1, 0));
    const s2 = snap(block("a", 2, 0));
    h.push(s0, "mouse");
    h.push(s1, "keyboard");
    h.push(s2, "mouse");

    expect(h.undo()).toEqual({ snapshot: s1, source: "keyboard" });
    expect(h.undo()).toEqual({ snapshot: s0, source: "mouse" });
    expect(h.undo()).toBeNull();
  });
});

describe("createLayoutHistory — redo", () => {
  it("redo after undo returns the entry that was undone", () => {
    const h = createLayoutHistory();
    const s0 = snap(block("a", 0, 0));
    const s1 = snap(block("a", 1, 0));
    h.push(s0, "mouse");
    h.push(s1, "keyboard");

    h.undo();
    expect(h.canRedo()).toBe(true);

    const result = h.redo();
    expect(result).toEqual({ snapshot: s1, source: "keyboard" });
    expect(h.canRedo()).toBe(false);
    expect(h.canUndo()).toBe(true);
  });

  it("redo() without a prior undo returns null", () => {
    const h = createLayoutHistory();
    h.push(snap(block("a", 0, 0)), "mouse");
    h.push(snap(block("a", 1, 0)), "mouse");

    expect(h.redo()).toBeNull();
  });

  it("multiple undos then multiple redos restore the original sequence", () => {
    const h = createLayoutHistory();
    const s0 = snap(block("a", 0, 0));
    const s1 = snap(block("a", 1, 0));
    const s2 = snap(block("a", 2, 0));
    h.push(s0, "mouse");
    h.push(s1, "mouse");
    h.push(s2, "mouse");

    h.undo();
    h.undo();
    expect(h.redo()?.snapshot).toBe(s1);
    expect(h.redo()?.snapshot).toBe(s2);
    expect(h.canRedo()).toBe(false);
  });
});

describe("createLayoutHistory — push truncates future (divergent branch)", () => {
  it("pushing after an undo drops the future entries", () => {
    const h = createLayoutHistory();
    const s0 = snap(block("a", 0, 0));
    const s1 = snap(block("a", 1, 0));
    const s2 = snap(block("a", 2, 0));
    h.push(s0, "mouse");
    h.push(s1, "mouse");
    h.push(s2, "mouse");
    h.undo(); // present = s1, future = [s2]
    expect(h.canRedo()).toBe(true);

    const sBranch = snap(block("a", 9, 9));
    h.push(sBranch, "keyboard");

    expect(h.canRedo()).toBe(false);
    expect(h.size().future).toBe(0);
    // Undo from the new branch returns the previous present, not s2.
    expect(h.undo()?.snapshot).toBe(s1);
  });
});

describe("createLayoutHistory — capacity", () => {
  it("caps the past length at the configured capacity", () => {
    const h = createLayoutHistory({ capacity: 3 });
    const snaps = [0, 1, 2, 3, 4, 5].map((i) => snap(block("a", i, 0)));

    // Push 6 snapshots. After: present = s5, past should hold at most 3.
    snaps.forEach((s) => h.push(s, "mouse"));

    expect(h.size().past).toBe(3);
    // Undo three times walks back to snaps[2] (oldest still in past = snaps[2]).
    expect(h.undo()?.snapshot).toBe(snaps[4]);
    expect(h.undo()?.snapshot).toBe(snaps[3]);
    expect(h.undo()?.snapshot).toBe(snaps[2]);
    // No further undo: snaps[0] and snaps[1] were dropped.
    expect(h.undo()).toBeNull();
  });

  it("falls back to a sensible default capacity when not provided", () => {
    const h = createLayoutHistory();
    // Push 250 snapshots; default cap should hold at least 100.
    for (let i = 0; i < 250; i++) h.push(snap(block("a", i, 0)), "mouse");
    expect(h.size().past).toBeGreaterThanOrEqual(100);
  });

  it("rejects a capacity < 1", () => {
    expect(() => createLayoutHistory({ capacity: 0 })).toThrow();
    expect(() => createLayoutHistory({ capacity: -5 })).toThrow();
  });
});

describe("createLayoutHistory — clear", () => {
  it("clear() resets past and future and disables undo/redo", () => {
    const h = createLayoutHistory();
    h.push(snap(block("a", 0, 0)), "mouse");
    h.push(snap(block("a", 1, 0)), "mouse");
    h.push(snap(block("a", 2, 0)), "mouse");
    h.undo();
    expect(h.canUndo()).toBe(true);
    expect(h.canRedo()).toBe(true);

    h.clear();

    expect(h.canUndo()).toBe(false);
    expect(h.canRedo()).toBe(false);
    expect(h.size()).toEqual({ past: 0, future: 0 });
  });

  it("after clear, the next push behaves as the initial anchor", () => {
    const h = createLayoutHistory();
    h.push(snap(block("a", 0, 0)), "mouse");
    h.push(snap(block("a", 1, 0)), "keyboard");
    h.clear();

    const s0 = snap(block("b", 0, 0));
    h.push(s0, "keyboard");
    expect(h.canUndo()).toBe(false);
    expect(h.size()).toEqual({ past: 0, future: 0 });
  });
});

describe("createLayoutHistory — source tracking", () => {
  it("preserves the source through undo and redo round-trips", () => {
    const h = createLayoutHistory();
    const s0 = snap(block("a", 0, 0));
    const s1 = snap(block("a", 1, 0));
    const s2 = snap(block("a", 2, 0));
    h.push(s0, "mouse");
    h.push(s1, "keyboard");
    h.push(s2, "mouse");

    expect(h.undo()?.source).toBe("keyboard");
    expect(h.undo()?.source).toBe("mouse");
    expect(h.redo()?.source).toBe("keyboard");
    expect(h.redo()?.source).toBe("mouse");
  });

  it("distinguishes mouse from keyboard pushes even with identical snapshots", () => {
    const h = createLayoutHistory();
    const s = snap(block("a", 0, 0));
    h.push(s, "mouse");
    h.push(s, "keyboard");

    const result = h.undo();
    expect(result?.snapshot).toBe(s);
    expect(result?.source).toBe("mouse");
  });
});

/**
 * Session pins — pin() / restoreTo() / relabelAfter().
 *
 * The pin/restore mechanism gives the owner a way to mark a position in the
 * history (typically the moment a buffered keyboard session starts) and
 * later either:
 *  - drop everything pushed after the pin (the user discarded the session),
 *    via restoreTo(pin); or
 *  - relabel everything pushed after the pin as a different source (the user
 *    committed the session, so the keyboard entries are now persisted), via
 *    relabelAfter(pin, "mouse").
 *
 * The pin is opaque to callers. Internally it points to the same entry as the
 * present at the moment pin() was called.
 */
describe("LayoutHistory — pin/restoreTo/relabelAfter", () => {
  it("pin on an empty history returns a usable cursor and restoreTo is a no-op", () => {
    const h = createLayoutHistory();
    const p = h.pin();
    h.restoreTo(p);
    expect(h.canUndo()).toBe(false);
    expect(h.canRedo()).toBe(false);
    expect(h.size()).toEqual({ past: 0, future: 0 });
  });

  it("pin after the initial anchor returns to the anchor on restoreTo", () => {
    const h = createLayoutHistory();
    const s0 = snap(block("a", 0, 0));
    h.push(s0, "mouse");
    const p = h.pin();

    const s1 = snap(block("a", 1, 0));
    const s2 = snap(block("a", 2, 0));
    h.push(s1, "keyboard");
    h.push(s2, "keyboard");

    h.restoreTo(p);

    expect(h.size()).toEqual({ past: 0, future: 0 });
    expect(h.canUndo()).toBe(false);
    expect(h.canRedo()).toBe(false);
    // present remains the anchor; further pushes go on top.
    const s3 = snap(block("a", 3, 0));
    h.push(s3, "mouse");
    expect(h.undo()?.snapshot).toBe(s0);
  });

  it("restoreTo drops the future as well as entries past the pin", () => {
    const h = createLayoutHistory();
    const s0 = snap(block("a", 0, 0));
    const s1 = snap(block("a", 1, 0));
    const s2 = snap(block("a", 2, 0));
    const s3 = snap(block("a", 3, 0));
    h.push(s0, "mouse");
    const p = h.pin();
    h.push(s1, "keyboard");
    h.push(s2, "keyboard");
    h.push(s3, "keyboard");
    h.undo(); // present=s2, future=[s3]

    h.restoreTo(p);

    expect(h.canUndo()).toBe(false);
    expect(h.canRedo()).toBe(false);
    expect(h.size()).toEqual({ past: 0, future: 0 });
  });

  it("restoreTo with no pushes after the pin is a no-op", () => {
    const h = createLayoutHistory();
    const s0 = snap(block("a", 0, 0));
    const s1 = snap(block("a", 1, 0));
    h.push(s0, "mouse");
    h.push(s1, "mouse");
    const p = h.pin();

    h.restoreTo(p);

    expect(h.size()).toEqual({ past: 1, future: 0 });
    expect(h.canUndo()).toBe(true);
    expect(h.undo()?.snapshot).toBe(s0);
  });

  it("relabelAfter changes the source of entries pushed after the pin (inclusive of present)", () => {
    const h = createLayoutHistory();
    const s0 = snap(block("a", 0, 0));
    h.push(s0, "mouse");
    const p = h.pin();

    const s1 = snap(block("a", 1, 0));
    const s2 = snap(block("a", 2, 0));
    h.push(s1, "keyboard");
    h.push(s2, "keyboard");

    h.relabelAfter(p, "mouse");

    expect(h.undo()?.source).toBe("mouse"); // was keyboard for s1
    expect(h.undo()?.source).toBe("mouse"); // s0, untouched (was already mouse)
  });

  it("relabelAfter leaves entries before the pin untouched", () => {
    const h = createLayoutHistory();
    const s0 = snap(block("a", 0, 0));
    h.push(s0, "keyboard");
    const p = h.pin();

    const s1 = snap(block("a", 1, 0));
    const s2 = snap(block("a", 2, 0));
    h.push(s1, "keyboard");
    h.push(s2, "keyboard");

    h.relabelAfter(p, "mouse");

    expect(h.undo()?.source).toBe("mouse"); // s1, relabelled
    expect(h.undo()?.source).toBe("keyboard"); // s0, before the pin
  });

  it("relabelAfter with no pushes after the pin is a no-op", () => {
    const h = createLayoutHistory();
    const s0 = snap(block("a", 0, 0));
    h.push(s0, "keyboard");
    const p = h.pin();

    h.relabelAfter(p, "mouse");

    // The present is the pinned entry itself: relabelAfter must NOT touch it.
    // Pushing again then undoing brings s0 back unchanged.
    h.push(snap(block("a", 1, 0)), "keyboard");
    expect(h.undo()?.source).toBe("keyboard");
  });

  it("pin survives undo/redo cycles within the post-pin range", () => {
    const h = createLayoutHistory();
    const s0 = snap(block("a", 0, 0));
    h.push(s0, "mouse");
    const p = h.pin();

    const s1 = snap(block("a", 1, 0));
    const s2 = snap(block("a", 2, 0));
    h.push(s1, "keyboard");
    h.push(s2, "keyboard");
    h.undo(); // present=s1, future=[s2]
    h.undo(); // present=s0, future=[s1,s2]
    h.redo(); // present=s1, future=[s2]

    h.restoreTo(p);

    expect(h.size()).toEqual({ past: 0, future: 0 });
    expect(h.canUndo()).toBe(false);
    expect(h.canRedo()).toBe(false);
  });

  it("throws when the pinned entry has been dropped by capacity", () => {
    const h = createLayoutHistory({ capacity: 2 });
    const s0 = snap(block("a", 0, 0));
    h.push(s0, "mouse");
    const p = h.pin();
    // Push more than capacity allows so that s0 falls out of past.
    h.push(snap(block("a", 1, 0)), "mouse");
    h.push(snap(block("a", 2, 0)), "mouse");
    h.push(snap(block("a", 3, 0)), "mouse");

    expect(() => h.restoreTo(p)).toThrow(/pin.*invalid/i);
    expect(() => h.relabelAfter(p, "mouse")).toThrow(/pin.*invalid/i);
  });

  it("throws when used after clear()", () => {
    const h = createLayoutHistory();
    h.push(snap(block("a", 0, 0)), "mouse");
    const p = h.pin();
    h.clear();

    expect(() => h.restoreTo(p)).toThrow(/pin.*invalid/i);
    expect(() => h.relabelAfter(p, "mouse")).toThrow(/pin.*invalid/i);
  });
});
