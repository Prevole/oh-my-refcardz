/**
 * Wrap rules: pure placement computation for the horizontal-axis south fallback.
 *
 * See docs/layout-engine.md, "South fallback for horizontal wrap".
 *
 * This module computes target positions only. Collision resolution between the
 * placed wrappables and the existing south region is the responsibility of the
 * caller (step.ts), which runs a recursive resolution per placement.
 */

import { euclideanDistance } from "./geometry";
import type { GridPosition } from "./types";

export type WrappableInput = {
  id: string;
  /** Current position of the block in the working set (post-shrink, pre-wrap). */
  current: GridPosition;
  /** Initial size at the start of the session — used for the wrap target size. */
  restoredSize: { w: number; h: number };
  /**
   * Initial X column at the start of the session. Used as the wrap target X
   * so that a block whose width is restored does not overflow the grid right
   * edge (which would happen if we reused `current.x` after a shrink chain).
   */
  initialX: number;
};

type SouthFallbackInput = {
  primary: GridPosition;
  wrappables: readonly WrappableInput[];
};

type SouthFallbackPlacement = {
  id: string;
  target: GridPosition;
  /** 0 = first placed (farthest), then ascending. */
  placementOrder: number;
};

/**
 * Compute south-fallback wrap placements (Q3 normalization).
 *
 * Pipeline:
 *   1. Normalize Y: find the wrappable closest in y to `primary.y`. Translate
 *      every wrappable by `(0, dy)` where `dy = primary.y - that.y`. X is not
 *      modified.
 *   2. Compute euclidean distance from each normalized member's top-left to the
 *      primary's top-left. Distance uses the block's **initial-session X** (the
 *      column it will land on), not its current shrunk X.
 *   3. Sort descending (farthest first). Ties broken by id ascending.
 *   4. Compute the group translation `dy2` so that the topmost final y equals
 *      `primary.y + primary.h`. The group's internal y-structure is preserved.
 *   5. Return placements with `target = (initialX, normalized y + dy2,
 *      restoredSize.w, restoredSize.h)`. Using `initialX` (not `current.x`)
 *      prevents grid overflow when the block's width is restored after a shrink.
 */
export function computeSouthFallbackPlacements(input: SouthFallbackInput): SouthFallbackPlacement[] {
  const { primary, wrappables } = input;
  if (wrappables.length === 0) return [];

  // --- Step 1: Y normalization -------------------------------------------
  // Closest in y to primary.y. Ties broken by id ascending for determinism.
  let anchor = wrappables[0];
  let anchorDelta = Math.abs(anchor.current.y - primary.y);
  for (const w of wrappables) {
    const delta = Math.abs(w.current.y - primary.y);
    if (delta < anchorDelta || (delta === anchorDelta && w.id < anchor.id)) {
      anchor = w;
      anchorDelta = delta;
    }
  }
  const dy = primary.y - anchor.current.y;

  type Normalized = {
    id: string;
    initialX: number;
    normalizedY: number;
    restoredSize: { w: number; h: number };
    distance: number;
  };

  const normalized: Normalized[] = wrappables.map((w) => {
    const normalizedY = w.current.y + dy;
    return {
      id: w.id,
      initialX: w.initialX,
      normalizedY,
      restoredSize: w.restoredSize,
      distance: euclideanDistance(
        { x: w.initialX, y: normalizedY },
        { x: primary.x, y: primary.y }
      ),
    };
  });

  // --- Step 2/3: sort by distance descending, ties by id ascending -------
  normalized.sort((a, b) => {
    if (b.distance !== a.distance) return b.distance - a.distance;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });

  // --- Step 4: group translation so min final y = primary.y + primary.h --
  const minNormalizedY = Math.min(...normalized.map((n) => n.normalizedY));
  const groupTopY = primary.y + primary.h;
  const dy2 = groupTopY - minNormalizedY;

  // --- Step 5: build placements ------------------------------------------
  return normalized.map((n, i) => ({
    id: n.id,
    target: {
      x: n.initialX,
      y: n.normalizedY + dy2,
      w: n.restoredSize.w,
      h: n.restoredSize.h,
    },
    placementOrder: i,
  }));
}
