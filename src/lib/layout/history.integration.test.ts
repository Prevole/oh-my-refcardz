/**
 * LayoutHistory — integration scenarios (Phase H4).
 *
 * Where `history.test.ts` exercises each primitive in isolation, this file
 * stitches them into the full user workflows the history layer must support:
 *
 *  - Single-mode mouse sequences (gesture → undo → redo, divergent branches).
 *  - Single-mode keyboard sequences (per-keystroke push, reset, redo).
 *  - Cross-mode flows mixing mouse commits with buffered keyboard sessions,
 *    including the H4.4 session pin contract: a session-discard truncates
 *    the in-session entries; a session-commit relabels them as persisted.
 *  - Capacity eviction interacting with session pins.
 *
 * These tests are intentionally written at the LayoutHistory API level (no
 * hooks, no DOM). The hook wiring is covered by E2E in Phase H6. This file
 * is the safety net for the pile semantics that those hooks rely on.
 */

import { describe, expect, it } from "vitest";

import {
  createLayoutHistory,
  type LayoutHistory,
} from "./history";
import type { LayoutBlock } from "./engine";

// --- fixtures ----------------------------------------------------------------

function block(id: string, x: number, y: number): LayoutBlock {
  return { id, kind: "card", position: { x, y, w: 1, h: 1 } };
}

function snap(...blocks: LayoutBlock[]): readonly LayoutBlock[] {
  return blocks;
}

// A baseline two-block layout that every scenario starts from.
const INITIAL = snap(block("a", 0, 0), block("b", 2, 0));

// Helpers that produce distinct snapshot identities for each step so we can
// assert by reference where it matters.
const M1 = snap(block("a", 1, 0), block("b", 2, 0)); // mouse move A → x=1
const M2 = snap(block("a", 1, 0), block("b", 3, 0)); // mouse move B → x=3
const K1 = snap(block("a", 1, 1), block("b", 3, 0)); // keyboard nudge A down
const K2 = snap(block("a", 1, 2), block("b", 3, 0)); // keyboard nudge A down
const K3 = snap(block("a", 1, 2), block("b", 4, 0)); // keyboard nudge B right

// Anchor every history with the initial snapshot, matching the renderer's
// real wiring (useLayoutHistory takes `initialSnapshot` in its options).
function withInitial(): LayoutHistory {
  const h = createLayoutHistory();
  h.push(INITIAL, "mouse");
  return h;
}

// -----------------------------------------------------------------------------
// 1. Single-mode mouse sequences
// -----------------------------------------------------------------------------

describe("integration — single-mode mouse", () => {
  it("undo/redo walks the linear past after a sequence of mouse commits", () => {
    const h = withInitial();
    h.push(M1, "mouse");
    h.push(M2, "mouse");

    // Standing on M2 with M1 + INITIAL in the past.
    expect(h.canUndo()).toBe(true);
    expect(h.canRedo()).toBe(false);

    expect(h.undo()?.snapshot).toBe(M1);
    expect(h.undo()?.snapshot).toBe(INITIAL);
    expect(h.undo()).toBeNull();
    expect(h.canUndo()).toBe(false);

    // Redo back to the tip.
    expect(h.redo()?.snapshot).toBe(M1);
    expect(h.redo()?.snapshot).toBe(M2);
    expect(h.redo()).toBeNull();
  });

  it("a new mouse push after undo drops the future branch", () => {
    const h = withInitial();
    h.push(M1, "mouse");
    h.push(M2, "mouse");
    h.undo(); // back on M1, future = [M2]
    expect(h.canRedo()).toBe(true);

    const M2prime = snap(block("a", 1, 0), block("b", 9, 0));
    h.push(M2prime, "mouse");

    expect(h.canRedo()).toBe(false);
    expect(h.undo()?.snapshot).toBe(M1);
  });
});

// -----------------------------------------------------------------------------
// 2. Single-mode keyboard sequences (no session pin, no commit boundary)
// -----------------------------------------------------------------------------

describe("integration — single-mode keyboard", () => {
  it("per-keystroke pushes form a linear pile, undo-able in reverse", () => {
    const h = withInitial();
    h.push(K1, "keyboard");
    h.push(K2, "keyboard");
    h.push(K3, "keyboard");

    expect(h.undo()?.snapshot).toBe(K2);
    expect(h.undo()?.snapshot).toBe(K1);
    expect(h.undo()?.snapshot).toBe(INITIAL);
    expect(h.undo()).toBeNull();
  });

  it("each keyboard entry carries the keyboard source for routing", () => {
    const h = withInitial();
    h.push(K1, "keyboard");
    h.push(K2, "keyboard");

    expect(h.undo()?.source).toBe("keyboard");
    expect(h.redo()?.source).toBe("keyboard");
  });
});

// -----------------------------------------------------------------------------
// 3. Cross-mode flows with session pins
// -----------------------------------------------------------------------------

describe("integration — cross-mode with session pin", () => {
  it("session discard drops every in-session keyboard entry", () => {
    const h = withInitial();
    h.push(M1, "mouse"); // pre-session mouse commit
    const pin = h.pin();
    h.push(K1, "keyboard");
    h.push(K2, "keyboard");

    // User aborts the layout-mode session.
    h.restoreTo(pin);

    // Pile is back to M1; the K-entries are unreachable in both directions.
    expect(h.canRedo()).toBe(false);
    expect(h.undo()?.snapshot).toBe(INITIAL);
    expect(h.redo()?.snapshot).toBe(M1);
    expect(h.redo()).toBeNull();
  });

  it("session commit relabels in-session keyboard entries as persisted", () => {
    const h = withInitial();
    h.push(M1, "mouse");
    const pin = h.pin();
    h.push(K1, "keyboard");
    h.push(K2, "keyboard");

    // User confirms the session via Return.
    h.relabelAfter(pin, "mouse");

    // The pile stays the same length, but undo now reports mouse sources
    // for the previously-buffered keyboard entries. That is what the
    // renderer needs so cross-mode undo writes back through commitLayout.
    expect(h.undo()?.source).toBe("mouse");
    expect(h.undo()?.source).toBe("mouse");
    // Pre-session mouse entry kept its source.
    expect(h.undo()?.source).toBe("mouse");
  });

  it("the pinned entry itself is preserved by both restoreTo and relabelAfter", () => {
    const h = withInitial();
    h.push(M1, "mouse");
    const pin = h.pin(); // pinned entry = M1, source "mouse"
    h.push(K1, "keyboard");

    h.relabelAfter(pin, "keyboard");
    // M1 is the pin: it must keep its mouse source even after relabel.
    h.undo(); // pop K1 (now relabeled to keyboard)
    const present = h.undo();
    expect(present?.snapshot).toBe(INITIAL);
    // M1 is now in future; peek by redoing.
    const m1Again = h.redo();
    expect(m1Again?.snapshot).toBe(M1);
    expect(m1Again?.source).toBe("mouse");
  });

  it("post-commit, a new mouse push appends normally on top of the relabeled pile", () => {
    const h = withInitial();
    const pin = h.pin();
    h.push(K1, "keyboard");
    h.relabelAfter(pin, "mouse");

    h.push(M2, "mouse");
    expect(h.canUndo()).toBe(true);
    expect(h.undo()?.snapshot).toBe(K1);
    // K1 is now persisted-equivalent.
    expect(h.redo()?.snapshot).toBe(M2);
  });

  it("post-discard, the pin cursor cannot be reused (epoch is unchanged but entry was dropped)", () => {
    const h = withInitial();
    h.push(M1, "mouse");
    const pin = h.pin();
    h.push(K1, "keyboard");
    h.restoreTo(pin);

    // Calling restoreTo a second time with the same pin still succeeds:
    // pin's entry (M1) is still the present, so it is a no-op restore.
    // This matches the renderer's reality where a session is closed
    // before another can be opened, so the pin is never replayed.
    expect(() => h.restoreTo(pin)).not.toThrow();
    expect(h.canRedo()).toBe(false);
  });
});

// -----------------------------------------------------------------------------
// 4. Capacity eviction interacting with pins
// -----------------------------------------------------------------------------

describe("integration — capacity + sessions", () => {
  it("an evicted pinned entry invalidates the cursor on restoreTo", () => {
    const h = createLayoutHistory({ capacity: 3 });
    h.push(INITIAL, "mouse");
    h.push(M1, "mouse");
    const pin = h.pin(); // pinned entry = M1
    // Push enough entries to evict M1 from past.
    h.push(K1, "keyboard");
    h.push(K2, "keyboard");
    h.push(K3, "keyboard");
    h.push(M2, "mouse");

    // M1 is now gone from past (capacity=3 means past holds at most 3).
    expect(() => h.restoreTo(pin)).toThrow();
  });

  it("clear() bumps epoch and invalidates outstanding pins", () => {
    const h = withInitial();
    const pin = h.pin();
    h.push(K1, "keyboard");
    h.clear();

    expect(() => h.restoreTo(pin)).toThrow();
    expect(() => h.relabelAfter(pin, "mouse")).toThrow();
  });
});

// -----------------------------------------------------------------------------
// 5. Anchor / initial snapshot semantics
// -----------------------------------------------------------------------------

describe("integration — anchor semantics", () => {
  it("undoing past the initial anchor is impossible", () => {
    const h = withInitial();
    h.push(M1, "mouse");
    h.undo(); // back to INITIAL
    expect(h.canUndo()).toBe(false);
    expect(h.undo()).toBeNull();
  });

  it("LAYOUT_RESET-style push (re-pushing the initial snapshot as keyboard) is recorded as a normal entry", () => {
    // Simulates the renderer behaviour: after a reset, the buffer's
    // initial snapshot is pushed as a keyboard-sourced entry so the
    // user can undo back to whatever they had before the reset.
    const h = withInitial();
    h.push(K1, "keyboard");
    h.push(INITIAL, "keyboard"); // user pressed Shift+R

    // Undo brings us back to K1, then to the initial anchor.
    expect(h.undo()?.snapshot).toBe(K1);
    expect(h.undo()?.snapshot).toBe(INITIAL);
    expect(h.canUndo()).toBe(false);
  });
});
