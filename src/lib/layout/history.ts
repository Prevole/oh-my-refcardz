/**
 * LayoutHistory — cursor-based undo/redo store for layout snapshots.
 *
 * See docs/layout-engine.md (history contract) for the broader picture.
 *
 * Conceptual model (1-based for the comment, 0-based in code):
 *   past: [s0, s1, ..., sn-1]   present: sn    future: [sn+1, sn+2, ...]
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

export interface LayoutHistoryOptions {
  /** Maximum number of past entries kept. Defaults to 100. Must be >= 1. */
  capacity?: number;
}

export interface LayoutHistory {
  /**
   * Record a new snapshot. The first call after construction (or after
   * `clear()`) becomes the present without enabling undo. Subsequent calls
   * push the previous present onto `past` and drop any `future` entries
   * (divergent branch).
   */
  push(snapshot: readonly LayoutBlock[]): void;
  /**
   * Walk one step back. Returns the new present, or `null` if `past` is empty.
   */
  undo(): readonly LayoutBlock[] | null;
  /**
   * Walk one step forward. Returns the new present, or `null` if `future` is
   * empty.
   */
  redo(): readonly LayoutBlock[] | null;
  canUndo(): boolean;
  canRedo(): boolean;
  /**
   * Drop the entire history (past, present, future). The next `push` behaves
   * as the initial anchor again.
   */
  clear(): void;
  /** Current sizes of the past and future stacks (excluding the present). */
  size(): { past: number; future: number };
}

export function createLayoutHistory(
  options?: LayoutHistoryOptions
): LayoutHistory {
  const capacity = options?.capacity ?? DEFAULT_CAPACITY;
  if (capacity < 1) {
    throw new Error(`LayoutHistory: capacity must be >= 1, got ${capacity}`);
  }

  let past: Array<readonly LayoutBlock[]> = [];
  let present: readonly LayoutBlock[] | null = null;
  let future: Array<readonly LayoutBlock[]> = [];

  return {
    push(snapshot) {
      if (present === null) {
        // Initial anchor: just set the present.
        present = snapshot;
        return;
      }
      past.push(present);
      // Cap past at `capacity` by dropping the oldest entries.
      if (past.length > capacity) {
        past = past.slice(past.length - capacity);
      }
      present = snapshot;
      // Pushing on a diverging branch drops the future.
      future = [];
    },

    undo() {
      if (past.length === 0 || present === null) return null;
      const previous = past.pop() as readonly LayoutBlock[];
      future.unshift(present);
      present = previous;
      return present;
    },

    redo() {
      if (future.length === 0 || present === null) return null;
      const next = future.shift() as readonly LayoutBlock[];
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
    },

    size() {
      return { past: past.length, future: future.length };
    },
  };
}
