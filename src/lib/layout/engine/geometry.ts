import type { Direction, GridPosition } from "./types";
import { axisOf } from "./types";

// -----------------------------------------------------------------------------
// Basic rectangle predicates
// -----------------------------------------------------------------------------

/**
 * Two rectangles intersect when they share at least one cell.
 * Adjacent rectangles touching only on an edge do not intersect.
 */
export function intersects(a: GridPosition, b: GridPosition): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

/**
 * Returns true when `inner` is fully contained within `outer`.
 */
export function contains(outer: GridPosition, inner: GridPosition): boolean {
  return (
    inner.x >= outer.x &&
    inner.y >= outer.y &&
    inner.x + inner.w <= outer.x + outer.w &&
    inner.y + inner.h <= outer.y + outer.h
  );
}

/**
 * Returns true when the rectangle fits within the grid's column range [0, gridColumns].
 * Vertical extent is unbounded; only x and w are checked.
 */
export function isWithinGridX(rect: GridPosition, gridColumns: number): boolean {
  return rect.x >= 0 && rect.x + rect.w <= gridColumns;
}

/**
 * Returns true when the rectangle does not violate the north boundary (y >= 0).
 */
export function isWithinGridY(rect: GridPosition): boolean {
  return rect.y >= 0;
}

// -----------------------------------------------------------------------------
// Translation
// -----------------------------------------------------------------------------

export function translate(rect: GridPosition, dx: number, dy: number): GridPosition {
  return { ...rect, x: rect.x + dx, y: rect.y + dy };
}

// -----------------------------------------------------------------------------
// Direction-aware predicates
// -----------------------------------------------------------------------------

/**
 * Returns the size of the overlap between `a` and `b` on the axis perpendicular
 * to `direction`.
 *
 * For a horizontal direction (east/west), this is the vertical overlap (in rows).
 * For a vertical direction (north/south), this is the horizontal overlap (in cols).
 *
 * Returns 0 when there is no overlap.
 */
export function perpendicularOverlap(
  a: GridPosition,
  b: GridPosition,
  direction: Direction
): number {
  if (axisOf(direction) === "horizontal") {
    const start = Math.max(a.y, b.y);
    const end = Math.min(a.y + a.h, b.y + b.h);
    return Math.max(0, end - start);
  }

  const start = Math.max(a.x, b.x);
  const end = Math.min(a.x + a.w, b.x + b.w);
  return Math.max(0, end - start);
}

/**
 * Returns true when `b` is contiguous to `a` on the `direction` face of `a`.
 *
 * "Contiguous" means: `b` touches that face (no gap, no overlap on the parallel axis)
 * and they share at least one cell on the perpendicular axis.
 */
export function isContiguous(a: GridPosition, b: GridPosition, direction: Direction): boolean {
  if (perpendicularOverlap(a, b, direction) <= 0) return false;

  switch (direction) {
    case "east":
      return b.x === a.x + a.w;
    case "west":
      return b.x + b.w === a.x;
    case "south":
      return b.y === a.y + a.h;
    case "north":
      return b.y + b.h === a.y;
  }
}

// -----------------------------------------------------------------------------
// Anchor distance
// -----------------------------------------------------------------------------

/**
 * Computes the euclidean distance between two anchor points.
 */
export function euclideanDistance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

// -----------------------------------------------------------------------------
// South-fallback normalization
// -----------------------------------------------------------------------------

/**
 * For horizontal wrap south-fallback ordering: translates the y component of all
 * wrappable rectangles so the row closest to `primary.y` aligns with `primary.y`.
 * Columns are left untouched. The same `dy` is applied to every wrappable.
 *
 * Used to compute a meaningful euclidean distance between primary and wrappables
 * when they sit on a different row than the primary.
 *
 * The normalized rectangles are for **distance computation only**: callers must
 * not use them as the actual placement positions.
 */
export function normalizeForSouthFallback(
  primary: GridPosition,
  wrappable: readonly GridPosition[]
): { dy: number; normalized: GridPosition[] } {
  if (wrappable.length === 0) {
    return { dy: 0, normalized: [] };
  }

  let bestDelta = Infinity;
  let chosenDy = 0;
  for (const w of wrappable) {
    const delta = primary.y - w.y;
    if (Math.abs(delta) < Math.abs(bestDelta)) {
      bestDelta = delta;
      chosenDy = delta;
    }
  }

  const normalized = wrappable.map((w) => ({ ...w, y: w.y + chosenDy }));
  return { dy: chosenDy, normalized };
}
