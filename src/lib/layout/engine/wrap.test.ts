import { describe, expect, it } from "vitest";
import { computeSouthFallbackPlacements, type WrappableInput } from "./wrap";
import type { GridPosition } from "./types";

const pos = (x: number, y: number, w: number, h: number): GridPosition => ({ x, y, w, h });

/**
 * Build a `WrappableInput` for tests. When `initialX` is omitted the block's
 * current X is reused — covering all legacy scenarios where the wrap target
 * column equals the current column.
 */
const wrappable = (
  id: string,
  current: GridPosition,
  restoredSize: { w: number; h: number },
  initialX: number = current.x
): WrappableInput => ({ id, current, restoredSize, initialX });

describe("computeSouthFallbackPlacements", () => {
  it("returns empty list when there are no wrappables", () => {
    const result = computeSouthFallbackPlacements({
      primary: pos(5, 5, 2, 2),
      wrappables: [],
    });
    expect(result).toEqual([]);
  });

  it("places a single wrappable at the column it originally had, just south of the primary", () => {
    const result = computeSouthFallbackPlacements({
      primary: pos(5, 5, 2, 2),
      wrappables: [wrappable("B", pos(10, 5, 2, 2), { w: 2, h: 2 })],
    });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("B");
    expect(result[0].target).toEqual({ x: 10, y: 7, w: 2, h: 2 }); // y = primary.y + primary.h = 5 + 2
  });

  it("uses restored size (not current shrunk size) for the placement", () => {
    const result = computeSouthFallbackPlacements({
      primary: pos(5, 5, 2, 2),
      wrappables: [wrappable("B", pos(10, 5, 1, 1), { w: 3, h: 4 })],
    });
    expect(result[0].target).toEqual({ x: 10, y: 7, w: 3, h: 4 });
  });

  it("places multiple wrappables preserving relative y-structure of the normalized group", () => {
    // Three wrappables at y=2, y=5, y=7. Primary at y=10.
    // Normalize: pick the one closest to primary.y = 10. That's y=7 (|10-7|=3). dy = 10-7 = +3.
    // Normalized y's: 2→5, 5→8, 7→10.
    // Group spans y in [5, 10]. Translate so min(normalized) = primary.y + primary.h = 12.
    // dy2 = 12 - 5 = 7. Final y's: 5+7=12, 8+7=15, 10+7=17.
    // Wait — that places the one with smallest normalized y (was y=2) at primary.y+primary.h,
    // not the one closest to primary. Let me re-read the doc.
    //
    // doc line 205: "Compute new y such that the group's relative y-structure is preserved and
    //               the whole group lies just below the primary (starting at primary.y + primary.h)."
    //
    // "starting at" = the group's top edge starts there. So min(final y) = primary.y + primary.h.
    // → dy2 = (primary.y + primary.h) - min(normalized y).
    // The block that was originally lowest (highest y, farthest south) keeps the largest final y.
    // The block that was originally highest (lowest y, farthest north) lands closest to primary.
    //
    // This is consistent: the wrappable group moves "as a whole" south, preserving internal layout.
    const result = computeSouthFallbackPlacements({
      primary: pos(0, 10, 2, 2),
      wrappables: [
        wrappable("Bhigh", pos(5, 2, 1, 1), { w: 1, h: 1 }),
        wrappable("Bmid", pos(6, 5, 1, 1), { w: 1, h: 1 }),
        wrappable("Blow", pos(7, 7, 1, 1), { w: 1, h: 1 }),
      ],
    });

    const byId = new Map(result.map((p) => [p.id, p]));
    // After normalize (closest to y=10 is y=7, dy=+3): Bhigh→y=5, Bmid→y=8, Blow→y=10.
    // After group translation so min=12: dy2 = 12 - 5 = 7. Bhigh→12, Bmid→15, Blow→17.
    expect(byId.get("Bhigh")!.target).toEqual({ x: 5, y: 12, w: 1, h: 1 });
    expect(byId.get("Bmid")!.target).toEqual({ x: 6, y: 15, w: 1, h: 1 });
    expect(byId.get("Blow")!.target).toEqual({ x: 7, y: 17, w: 1, h: 1 });
  });

  it("orders placements farthest-first (descending euclidean distance after Y normalization)", () => {
    // Primary at (0, 10). Wrappables at varying x and y.
    // After normalize: the closest-y member aligns with primary.y. Then compute distance from each
    // normalized member to primary.
    const result = computeSouthFallbackPlacements({
      primary: pos(0, 10, 2, 2),
      wrappables: [
        // dy normalize: closest y to 10 among {2, 5, 7} is 7 → dy = +3. Normalized y's: 5, 8, 10.
        wrappable("Near", pos(3, 7, 1, 1), { w: 1, h: 1 }), // normalized (3, 10) → dist = 3
        wrappable("Mid", pos(20, 5, 1, 1), { w: 1, h: 1 }), // normalized (20, 8) → dist = sqrt(400+4) ≈ 20.1
        wrappable("Far", pos(30, 2, 1, 1), { w: 1, h: 1 }), // normalized (30, 5) → dist = sqrt(900+25) ≈ 30.4
      ],
    });

    // Sort descending by distance: Far (30.4) > Mid (20.1) > Near (3).
    expect(result.map((p) => p.id)).toEqual(["Far", "Mid", "Near"]);
    expect(result[0].placementOrder).toBe(0);
    expect(result[1].placementOrder).toBe(1);
    expect(result[2].placementOrder).toBe(2);
  });

  it("ties in distance break by id ascending for determinism", () => {
    const result = computeSouthFallbackPlacements({
      primary: pos(0, 10, 2, 2),
      wrappables: [
        // Both end up at same distance after normalization.
        wrappable("Z", pos(5, 10, 1, 1), { w: 1, h: 1 }), // closest-y = 10 → dy=0. norm (5,10) → dist 5
        wrappable("A", pos(5, 10, 1, 1), { w: 1, h: 1 }), // same dist 5
      ],
    });

    // Same distance → tie-break by id ascending (A before Z) for placementOrder.
    // But sort is DESCENDING by distance, so equal distances should still tie-break consistently.
    // Convention: ascending id (so "A" placed first when distances are equal).
    expect(result[0].id).toBe("A");
    expect(result[1].id).toBe("Z");
  });

  it("preserves id-ascending tie-break order with 3+ equidistant wrappables", () => {
    // Exercise the comparator on every pair (covers both a<b and a>b branches).
    const result = computeSouthFallbackPlacements({
      primary: pos(0, 10, 2, 2),
      wrappables: [
        wrappable("M", pos(5, 10, 1, 1), { w: 1, h: 1 }),
        wrappable("A", pos(5, 10, 1, 1), { w: 1, h: 1 }),
        wrappable("Z", pos(5, 10, 1, 1), { w: 1, h: 1 }),
      ],
    });

    expect(result.map((r) => r.id)).toEqual(["A", "M", "Z"]);
  });

  it("uses initial-session X for the wrap target column (not the shrunk current X)", () => {
    // Scenario: a wrappable was shrunk and pushed east of its initial column
    // (initial x = 18, current x = 30 after being squeezed against the grid edge).
    // The wrap target must land at x = 18 so the restored width does not overflow.
    const result = computeSouthFallbackPlacements({
      primary: pos(14, 2, 18, 22),
      wrappables: [wrappable("C", pos(30, 2, 6, 11), { w: 18, h: 11 }, 18)],
    });
    expect(result).toHaveLength(1);
    expect(result[0].target).toEqual({ x: 18, y: 24, w: 18, h: 11 });
  });

  it("uses initial X (not current X) in distance computation", () => {
    // Two wrappables: both have current x = 30 (post-shrink edge), but very different
    // initial x's. Distance must use initialX so the farther-initial block is placed first.
    const result = computeSouthFallbackPlacements({
      primary: pos(0, 0, 2, 2),
      wrappables: [
        wrappable("CloseInitial", pos(30, 5, 1, 1), { w: 5, h: 1 }, 4),  // initial-distance ≈ sqrt(16+25)=6.4
        wrappable("FarInitial", pos(30, 5, 1, 1), { w: 5, h: 1 }, 25),   // initial-distance ≈ sqrt(625+25)=25.5
      ],
    });
    expect(result.map((p) => p.id)).toEqual(["FarInitial", "CloseInitial"]);
  });
});
