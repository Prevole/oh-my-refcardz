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
};

export type SouthFallbackInput = {
  primary: GridPosition;
  wrappables: readonly WrappableInput[];
};

export type SouthFallbackPlacement = {
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
 *      primary's top-left.
 *   3. Sort descending (farthest first). Ties broken by id ascending.
 *   4. Compute the group translation `dy2` so that the topmost final y equals
 *      `primary.y + primary.h`. The group's internal y-structure is preserved.
 *   5. Return placements with `target = (original x, normalized y + dy2,
 *      restoredSize.w, restoredSize.h)`.
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
    originalX: number;
    normalizedY: number;
    restoredSize: { w: number; h: number };
    distance: number;
  };

  const normalized: Normalized[] = wrappables.map((w) => {
    const normalizedY = w.current.y + dy;
    return {
      id: w.id,
      originalX: w.current.x,
      normalizedY,
      restoredSize: w.restoredSize,
      distance: euclideanDistance(
        { x: w.current.x, y: normalizedY },
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
      x: n.originalX,
      y: n.normalizedY + dy2,
      w: n.restoredSize.w,
      h: n.restoredSize.h,
    },
    placementOrder: i,
  }));
}
