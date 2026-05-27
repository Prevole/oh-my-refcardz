/**
 * LayoutHistory — cursor-based undo/redo store for layout snapshots.
 *
 * See docs/layout-engine.md (history contract) for the broader picture.
 *
 * Conceptual model (1-based for the comment, 0-based in code):
 *   past: [e0, e1, ..., en-1]   present: en    future: [en+1, en+2, ...]
 *
 * Each entry carries:
 *  - `snapshot`: the layout array AFTER the operation that produced this entry.
 *  - `source`: which interaction mode produced the entry — `"mouse"` (gesture
 *    commit) or `"keyboard"` (buffered keystroke). This is consumed by the
 *    owner of the history to decide where to write back on undo/redo (mouse
 *    commits persist immediately; keyboard pushes wait for the buffered
 *    session to commit, unless they cross-reflect a mouse step).
 *
 * Invariants:
 *  - A history with no snapshot has `present === null`. The first `push` only
 *    sets the present; it does not enable undo.
 *  - Snapshots are stored by reference. The caller MUST NOT mutate any array
 *    it has previously passed to `push()` or received from `undo()` / `redo()`.
 *    Phase H relies on the engine's hard immutability contract (see
 *    `engine.test.ts` section 3.9.9) to make this safe.
 *  - The `capacity` option caps the number of entries in `past`; the oldest
 *    entry is dropped first when the cap is reached. `future` is uncapped
 *    because it is bounded by `past.length + 1` at any moment.
 */

import type { LayoutBlock } from "./engine";

const DEFAULT_CAPACITY = 100;

export type LayoutHistorySource = "mouse" | "keyboard";

export interface LayoutHistoryEntry {
  snapshot: readonly LayoutBlock[];
  source: LayoutHistorySource;
}

/**
 * Opaque cursor used to pin a position in the history.
 *
 * A cursor captures (a) the entry that was the present at pin time and
 * (b) the epoch in which it was issued. An empty cursor (issued when the
 * present was `null`) is represented by `entry === null`.
 *
 * Pins are invalidated when:
 *  - `clear()` is called (epoch bumps), or
 *  - the pinned entry was dropped from `past` by the capacity cap.
 *
 * Using an invalidated pin throws.
 */
export interface LayoutHistoryCursor {
  readonly epoch: number;
  readonly entry: LayoutHistoryEntry | null;
}

export interface LayoutHistoryOptions {
  /** Maximum number of past entries kept. Defaults to 100. Must be >= 1. */
  capacity?: number;
}

export interface LayoutHistory {
  /**
   * Record a new entry. The first call after construction (or after
   * `clear()`) becomes the present without enabling undo. Subsequent calls
   * push the previous present onto `past` and drop any `future` entries
   * (divergent branch).
   */
  push(snapshot: readonly LayoutBlock[], source: LayoutHistorySource): void;
  /**
   * Walk one step back. Returns the new present, or `null` if `past` is empty.
   */
  undo(): LayoutHistoryEntry | null;
  /**
   * Walk one step forward. Returns the new present, or `null` if `future` is
   * empty.
   */
  redo(): LayoutHistoryEntry | null;
  canUndo(): boolean;
  canRedo(): boolean;
  /**
   * Drop the entire history (past, present, future). The next `push` behaves
   * as the initial anchor again. Outstanding cursors are invalidated.
   */
  clear(): void;
  /** Current sizes of the past and future stacks (excluding the present). */
  size(): { past: number; future: number };
  /**
   * Capture the current position as an opaque cursor. The cursor stays
   * valid until either `clear()` is called or capacity evicts the pinned
   * entry from `past`. A pin taken when the history is empty is also
   * valid and behaves as "restore to empty".
   */
  pin(): LayoutHistoryCursor;
  /**
   * Drop everything pushed after the pinned position: truncates `past` to
   * the pin's entry, restores `present` to it, and clears `future`. If the
   * pin was taken on an empty history, the entire history is dropped. If
   * the pin is no longer valid (entry evicted by capacity, or `clear()`
   * was called), throws.
   */
  restoreTo(cursor: LayoutHistoryCursor): void;
  /**
   * Change the `source` of every entry pushed after the pinned position
   * up to and including the present. Useful to mark in-session keyboard
   * entries as persisted on session commit. Throws if the pin is invalid.
   */
  relabelAfter(cursor: LayoutHistoryCursor, source: LayoutHistorySource): void;
}

export function createLayoutHistory(
  options?: LayoutHistoryOptions
): LayoutHistory {
  const capacity = options?.capacity ?? DEFAULT_CAPACITY;
  if (capacity < 1) {
    throw new Error(`LayoutHistory: capacity must be >= 1, got ${capacity}`);
  }

  let past: LayoutHistoryEntry[] = [];
  let present: LayoutHistoryEntry | null = null;
  let future: LayoutHistoryEntry[] = [];
  // Bumped on clear() so cursors taken before are invalidated.
  let epoch = 0;

  // Resolve a cursor's pinned entry to its index in the linear sequence
  // (past + present + future), or -1 if it has been evicted. Empty pins
  // (entry === null) resolve to -1 by convention; callers must handle
  // them as a special "restore to empty" case.
  function locate(entry: LayoutHistoryEntry): number {
    const idx = past.indexOf(entry);
    if (idx >= 0) return idx;
    if (present === entry) return past.length;
    // We intentionally do NOT look in `future`: cursors are taken from the
    // present, so they should only ever resolve to past or present.
    return -1;
  }

  function validate(cursor: LayoutHistoryCursor): void {
    if (cursor.epoch !== epoch) {
      throw new Error("LayoutHistory: pin is invalid (history was cleared)");
    }
    if (cursor.entry === null) return; // empty pin is always valid
    if (locate(cursor.entry) < 0) {
      throw new Error(
        "LayoutHistory: pin is invalid (entry evicted by capacity)"
      );
    }
  }

  return {
    push(snapshot, source) {
      const entry: LayoutHistoryEntry = { snapshot, source };
      if (present === null) {
        // Initial anchor: just set the present.
        present = entry;
        return;
      }
      past.push(present);
      // Cap past at `capacity` by dropping the oldest entries.
      if (past.length > capacity) {
        past = past.slice(past.length - capacity);
      }
      present = entry;
      // Pushing on a diverging branch drops the future.
      future = [];
    },

    undo() {
      if (past.length === 0 || present === null) return null;
      const previous = past.pop() as LayoutHistoryEntry;
      future.unshift(present);
      present = previous;
      return present;
    },

    redo() {
      if (future.length === 0 || present === null) return null;
      const next = future.shift() as LayoutHistoryEntry;
      past.push(present);
      present = next;
      return present;
    },

    canUndo() {
      return past.length > 0;
    },

    canRedo() {
      return future.length > 0;
    },

    clear() {
      past = [];
      present = null;
      future = [];
      epoch += 1;
    },

    size() {
      return { past: past.length, future: future.length };
    },

    pin() {
      return { epoch, entry: present };
    },

    restoreTo(cursor) {
      validate(cursor);
      if (cursor.entry === null) {
        // Pin was taken on an empty history: drop everything.
        past = [];
        present = null;
        future = [];
        return;
      }
      const idx = locate(cursor.entry);
      // Past entries up to and including the pin index stay in past until
      // the pin itself, which becomes the new present. Everything beyond
      // the pin (whether currently in past, present, or future) is dropped.
      past = past.slice(0, idx);
      present = cursor.entry;
      future = [];
    },

    relabelAfter(cursor, source) {
      validate(cursor);
      const pinIndex = cursor.entry === null ? -1 : locate(cursor.entry);
      // Mutate entries strictly after the pin in past, plus the present.
      for (let i = pinIndex + 1; i < past.length; i++) {
        past[i] = { snapshot: past[i].snapshot, source };
      }
      if (present !== null && present !== cursor.entry) {
        present = { snapshot: present.snapshot, source };
      }
      // Future entries are also relabelled to stay coherent if redo is used.
      future = future.map((e) => ({ snapshot: e.snapshot, source }));
    },
  };
}
