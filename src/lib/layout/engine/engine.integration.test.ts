/**
 * Engine integration tests.
 *
 * These scenarios exercise the public `applyOperation` entry-point on richer
 * block configurations that reproduce concrete bugs, gestures, or interactions
 * observed end-to-end. They are not unit tests of an individual module — they
 * verify the composition of step decomposition, chain resolution, wrap, and
 * residual collision passes together.
 *
 * Add new regression scenarios here when a bug surfaces from a real session.
 */

import { describe, expect, it } from "vitest";

import { applyOperation } from "./engine";
import type {
  BlockConstraints,
  EngineOptions,
  LayoutBlock,
  Operation,
} from "./types";

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function block(id: string, x: number, y: number, w: number, h: number): LayoutBlock {
  return { id, kind: "card", position: { x, y, w, h } };
}

const defaultConstraints: BlockConstraints = {
  minW: 1,
  minH: 1,
  allowedResizeDirections: ["north", "south", "east", "west"],
};

function constraintsFor(
  blocks: LayoutBlock[],
  overrides: Record<string, Partial<BlockConstraints>> = {}
): Map<string, BlockConstraints> {
  const map = new Map<string, BlockConstraints>();
  for (const b of blocks) {
    map.set(b.id, { ...defaultConstraints, ...overrides[b.id] });
  }
  return map;
}

function makeOptions(
  blocks: LayoutBlock[],
  overrides: Record<string, Partial<BlockConstraints>> = {}
): EngineOptions {
  return {
    gridColumns: 36,
    constraints: constraintsFor(blocks, overrides),
    opId: "op-integration",
  };
}

// -----------------------------------------------------------------------------
// Scenario: north move pulls a full-width heading into a wrap; the wrap target
// is occupied by non-wrappable blocks that must be pushed south transitively.
//
// Source: debug session .debug-sessions/1779177970080-2n30qjj.json (cheatsheets/docker)
//   - User drags `container-status` from (18, 2, 18, 11) with dy = -1.
//   - North chain reaches the full-width heading `containers` at (0, 0, 36, 2).
//   - Heading cannot be pushed further north (already at y=0) → axis wrap.
//   - Heading lands at (0, 12) per the south-baseline rule (primaryNewY + primaryH).
//   - At y=12 the heading overlaps `lifecycle` (0, 2, 18, 22) and
//     `interaction` (18, 13, 18, 11). Those two blocks must shift south by
//     their own minimum dy to clear the heading:
//       - lifecycle: dy = (12 + 2) - 2  = 12 cells
//       - interaction: dy = (12 + 2) - 13 = 1 cell
//   - After lifecycle moves down by 12, it now overlaps `rename` (0, 24, 18, 8),
//     which must follow the cascade with dy = (lifecycle.newY + lifecycle.h) - rename.y
//                                            = (14 + 22) - 24 = 12 cells.
//   - `interaction` (now at y=14) does NOT overlap any other block south of it,
//     so its cascade stops there — it does NOT inherit lifecycle's dy.
// -----------------------------------------------------------------------------

describe("integration — north move with vertical wrap cascade", () => {
  it("pushes each non-wrappable block by its individual minimum dy", () => {
    // Minimal synthetic reproduction of the docker page bug.
    //
    // Layout (numbers are grid cells, origin top-left):
    //
    //         x=0          x=18         x=36
    //  y=0   ┌──────────  heading  ──────────┐  (full width 36, h=2)
    //  y=2   ├─lifecycle──┬─── status ───────┤  status (18, 2, 18, 11), primary
    //  y=2   │  (h=22)    │                  │  lifecycle (0, 2, 18, 22)
    //  y=13  │            ├─ interaction ────┤  interaction (18, 13, 18, 11)
    //  y=24  ├──rename────┴──────────────────┤  rename (0, 24, 18, 8)
    //  y=32  └────────────────────────────────┘
    const initial: LayoutBlock[] = [
      block("heading", 0, 0, 36, 2),
      block("lifecycle", 0, 2, 18, 22),
      block("status", 18, 2, 18, 11),
      block("interaction", 18, 13, 18, 11),
      block("rename", 0, 24, 18, 8),
    ];

    const op: Operation = {
      kind: "move",
      blockId: "status",
      dx: 0,
      dy: -1,
    };

    const result = applyOperation(initial, op, makeOptions(initial, {
      // The heading is constrained to a minimum height equal to its initial
      // height, which forces wrap (instead of shrink) when the chain pulls it
      // against the grid's north edge.
      heading: { minH: 2 },
    }));

    expect(result.accepted).toBe(true);

    const byId = (id: string) => result.blocks.find((b) => b.id === id)!.position;

    // No overlap between any two blocks in the final state.
    const finalBlocks = result.blocks;
    for (let i = 0; i < finalBlocks.length; i++) {
      for (let j = i + 1; j < finalBlocks.length; j++) {
        const a = finalBlocks[i].position;
        const b = finalBlocks[j].position;
        const overlap =
          a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
        expect(
          overlap,
          `${finalBlocks[i].id} (${JSON.stringify(a)}) overlaps ${finalBlocks[j].id} (${JSON.stringify(b)})`
        ).toBe(false);
      }
    }

    // Exact expected positions: each block is pushed by the minimum dy required
    // to clear its own collision with the wrappable or with its pusher.
    expect(byId("status")).toEqual({ x: 18, y: 1, w: 18, h: 11 });
    expect(byId("heading")).toEqual({ x: 0, y: 12, w: 36, h: 2 });
    expect(byId("lifecycle")).toEqual({ x: 0, y: 14, w: 18, h: 22 }); // dy=12
    expect(byId("interaction")).toEqual({ x: 18, y: 14, w: 18, h: 11 }); // dy=1
    expect(byId("rename")).toEqual({ x: 0, y: 36, w: 18, h: 8 }); // dy=12 (cascade from lifecycle)
  });

  // ---------------------------------------------------------------------------
  // Sub-scenario: a pushed block must drag its south-contiguous neighbor even
  // when the push is large enough to "jump over" the neighbor (no resulting
  // collision). The south-contiguity relation from the INITIAL layout is
  // preserved through the cascade.
  //
  // Source: debug session .debug-sessions/1779181079407-1grdaqa.json
  //   - After the bulk of the residual pass, `images` (F, a heading at y=32)
  //     is pushed down to y=44 (dy=12).
  //   - `image-inspection` (K, at y=34) was initially south-contiguous to F
  //     (F.y+F.h=34 = K.y, x-overlap on the right column).
  //   - F-new at y=44 sits BELOW K-initial at y=34..42 — no induced collision.
  //   - Bug: K was not pushed because collision-only cascade misses this case.
  //   - Expected: K follows F with dy >= dy_F = 12. K-new at y=46..54.
  //   - Then K-new collides with `inspection` heading at y=51 → inspection
  //     must be pushed in turn.
  // ---------------------------------------------------------------------------
  it("drags a south-contiguous neighbor even when the push jumps over it", () => {
    // Smaller synthetic reproduction focused on the F→K dragging.
    //
    // Layout:
    //
    //         x=0          x=18         x=36
    //  y=0   ┌──────────  heading-A  ────────┐  (full width 36, h=2)
    //  y=2   ├────────────┬─── primary ──────┤  primary (18, 2, 18, 4)
    //  y=2   │            │                  │
    //  y=6   │  block-B   ├──────────────────┤  block-B  (0, 2, 18, 10)
    //        │  (h=10)    │                  │
    //  y=12  ├────────────┴──────────────────┤  heading-F (0, 12, 36, 1)
    //  y=13  ├──────  block-K  ──────────────┤  block-K (18, 13, 18, 4)
    //        │                               │
    //  y=17  └────────────────────────────────┘
    //
    // Move primary north by 1:
    //   - chain {primary, heading-A}: A wraps to (0, primary.newY + primary.h)
    //     = (0, 1+4, 36, 2) = (0, 5, 36, 2).
    //   - A overlaps block-B (y=[5,7) ⊂ [2,12)) → B pushed by dy = 5+2-2 = 5
    //     → B-new (0, 7, 18, 10), y=[7,17).
    //   - A does not overlap heading-F (initial y=12) but B-new (y=[7,17))
    //     overlaps F-initial (y=[12,13)) → F pushed by dy = 7+10-12 = 5
    //     → F-new (0, 17, 36, 1), y=[17,18).
    //   - F-new at y=[17,18) does NOT overlap K-initial (y=[13,17)) — F has
    //     "jumped over" K. But K was initially south-contiguous to F
    //     (F.y+F.h=13 = K.y, x-overlap [18,36)). K must follow F: dy_K >= dy_F
    //     = 5. So K-new at (18, 18, 18, 4).
    //
    // The bug, before fix: K stays at y=13 because no collision triggers its push.
    const initial: LayoutBlock[] = [
      block("heading-A", 0, 0, 36, 2),
      block("block-B", 0, 2, 18, 10),
      block("primary", 18, 2, 18, 4),
      block("heading-F", 0, 12, 36, 1),
      block("block-K", 18, 13, 18, 4),
    ];

    const op: Operation = {
      kind: "move",
      blockId: "primary",
      dx: 0,
      dy: -1,
    };

    const result = applyOperation(
      initial,
      op,
      makeOptions(initial, {
        "heading-A": { minH: 2 },
        "heading-F": { minH: 1 },
      })
    );

    expect(result.accepted).toBe(true);

    const byId = (id: string) => result.blocks.find((b) => b.id === id)!.position;

    // No overlap anywhere.
    const finalBlocks = result.blocks;
    for (let i = 0; i < finalBlocks.length; i++) {
      for (let j = i + 1; j < finalBlocks.length; j++) {
        const a = finalBlocks[i].position;
        const b = finalBlocks[j].position;
        const overlap =
          a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
        expect(
          overlap,
          `${finalBlocks[i].id} (${JSON.stringify(a)}) overlaps ${finalBlocks[j].id} (${JSON.stringify(b)})`
        ).toBe(false);
      }
    }

    expect(byId("primary")).toEqual({ x: 18, y: 1, w: 18, h: 4 });
    expect(byId("heading-A")).toEqual({ x: 0, y: 5, w: 36, h: 2 });
    expect(byId("block-B")).toEqual({ x: 0, y: 7, w: 18, h: 10 }); // dy=5
    expect(byId("heading-F")).toEqual({ x: 0, y: 17, w: 36, h: 1 }); // dy=5
    // The critical assertion: block-K must follow heading-F because it was
    // south-contiguous in the initial layout, even though F jumped over K's
    // initial position. dy_K >= dy_F = 5.
    expect(byId("block-K")).toEqual({ x: 18, y: 18, w: 18, h: 4 }); // dy=5
  });
});

// -----------------------------------------------------------------------------
// Scenario: east drag that shrinks neighbors against the grid right edge until
// they wrap south. The south-fallback target must place each wrappable on its
// INITIAL-SESSION X column, not the shrunk X. Using the shrunk X (the column
// the block occupied just before wrap) overflows the grid when the width is
// restored.
//
// Source: debug session .debug-sessions/1779181774419-txzpcbq.json (cheatsheets/docker)
//   - User drags `container-lifecycle` east by 14 cells.
//   - `container-status` (initial x=18, w=18) and `container-interaction`
//     (initial x=18, w=18) get pushed east, saturate at x=30 w=6 (minW), then
//     wrap south.
//   - Before fix: they wrap to (30, …, 18, …) — overflowing 12 cells past x=36.
//   - After fix: they wrap to (18, …, 18, …) — their initial-session column.
// -----------------------------------------------------------------------------

describe("integration — east drag wrap south restores initial column", () => {
  it("places shrunk-then-wrapped blocks on their initial X column, not the shrunk X", () => {
    // Minimal synthetic reproduction of the docker east-drag bug.
    //
    //         x=0           x=18          x=36
    //  y=0   ┌──── heading (containers, 36x2) ────┐
    //  y=2   ├─ lifecycle ─┬─── status ───────────┤  status   (18, 2, 18, 11)
    //  y=2   │             │                      │  lifecycle(0,  2, 18, 22)  primary
    //  y=13  │             ├─ interaction ────────┤  interaction (18, 13, 18, 16)
    //  y=24  ├─ rename ────┴──────────────────────┤  rename   (0, 24, 18, 8)
    //  y=32
    const initial: LayoutBlock[] = [
      block("heading", 0, 0, 36, 2),
      block("lifecycle", 0, 2, 18, 22),
      block("status", 18, 2, 18, 11),
      block("interaction", 18, 13, 18, 16),
      block("rename", 0, 24, 18, 8),
    ];

    // Drag lifecycle east by 14 cells. status and interaction must wrap south.
    const op: Operation = {
      kind: "move",
      blockId: "lifecycle",
      dx: 14,
      dy: 0,
    };

    // Cards have a minW of 6 (mirrors the real cheatsheet card constraint).
    // This forces the east-shrink to saturate at w=6 and then triggers wrap south
    // instead of shrinking all the way down to w=1.
    const result = applyOperation(
      initial,
      op,
      makeOptions(initial, {
        status: { minW: 6 },
        interaction: { minW: 6 },
      })
    );

    expect(result.accepted).toBe(true);

    const byId = (id: string) => result.blocks.find((b) => b.id === id)!.position;

    // No overlap and every block stays within the grid horizontally.
    const finalBlocks = result.blocks;
    for (const b of finalBlocks) {
      expect(
        b.position.x + b.position.w,
        `${b.id} overflows grid: x=${b.position.x} w=${b.position.w}`
      ).toBeLessThanOrEqual(36);
      expect(b.position.x, `${b.id} has negative x`).toBeGreaterThanOrEqual(0);
    }
    for (let i = 0; i < finalBlocks.length; i++) {
      for (let j = i + 1; j < finalBlocks.length; j++) {
        const a = finalBlocks[i].position;
        const b = finalBlocks[j].position;
        const overlap =
          a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
        expect(
          overlap,
          `${finalBlocks[i].id} (${JSON.stringify(a)}) overlaps ${finalBlocks[j].id} (${JSON.stringify(b)})`
        ).toBe(false);
      }
    }

    // Primary lands at x=14 (initial 0 + dx 14), size unchanged.
    expect(byId("lifecycle")).toEqual({ x: 14, y: 2, w: 18, h: 22 });

    // The critical assertion: wrapped blocks restore size AND initial X column.
    // Before the fix they ended up at x=30 (the shrunk column) → overflow.
    expect(byId("status").x).toBe(18);
    expect(byId("status").w).toBe(18);
    expect(byId("interaction").x).toBe(18);
    expect(byId("interaction").w).toBe(18);
  });
});

// -----------------------------------------------------------------------------
// Scenario: east drag of the primary triggers a wrap-south of two right-column
// neighbors. The post-wrap residual cascade must propagate ONLY the minimum dy
// required to clear the newly-placed wrappables — it must not amplify or
// over-push blocks that are already comfortably below.
//
// Source: debug session .debug-sessions/1779192723382-vyizvtc.json (cheatsheets/docker)
//   - User drags `container-lifecycle` (B) east by 13 cells from x=0.
//   - `container-status` (C) shrinks then wraps to (18, 24, 18, 11).
//     bottom = 35.
//   - `container-interaction` (E) shrinks then wraps to (18, 35, 18, 16).
//     bottom = 51.
//   - Right-column residual cascade (above the existing `image-inspection` K
//     at y=34, h=8):
//       - K must drop to y >= 51 (just clearing E's bottom). dy_K >= 17.
//       - But the engine observed dy_K = 19 (K landed at y=53). +2 extra.
//   - That +2 extra ripples down through every block in both columns, blowing
//     up the bottom blocks: `network-query` (Q) ends at y=173 from y=95
//     (dy=78), `image-registry` (G) at y=104 from y=72 (dy=32), etc.
//
// The expected behavior: residual cascade dy = obstacle_bottom - block_top,
// no extra gap. Each pushed block clears its immediate pusher exactly, then
// stops propagating unless it itself creates a new collision.
// -----------------------------------------------------------------------------

describe("integration — east drag wrap south residual cascade is minimal", () => {
  it("propagates only the minimum dy required to clear the wrapped blocks", () => {
    // Full docker page layout snapshot taken from
    // .debug-sessions/1779192723382-vyizvtc.json at session.start.
    const initial: LayoutBlock[] = [
      block("containers", 0, 0, 36, 2),
      block("container-lifecycle", 0, 2, 18, 22), // primary (B)
      block("container-status", 18, 2, 18, 11), // C
      block("container-rename", 0, 24, 18, 8), // D
      block("container-interaction", 18, 13, 18, 16), // E
      block("images", 0, 32, 36, 2), // F (heading)
      block("image-lifecycle", 0, 54, 18, 15), // H
      block("inspection", 0, 51, 36, 2), // I (heading)
      block("image-inspection", 18, 34, 18, 8), // K
      block("container-inspection", 18, 54, 18, 16), // J
      block("image-registry", 0, 72, 18, 18), // G
      block("volumes", 0, 70, 18, 2), // L (heading, half-width)
      block("networks", 18, 70, 18, 2), // P (heading, half-width)
      block("volume-lifecycle", 18, 72, 18, 12), // N
      block("volume-query", 18, 84, 18, 11), // M
      block("volume-mounting", 0, 95, 18, 8), // O
      block("network-query", 18, 95, 18, 11), // Q
      block("cleanup", 0, 112, 36, 2), // T (heading)
      block("network-lifecycle", 0, 114, 18, 12), // R
      block("network-connection", 18, 114, 18, 17), // S
      block("system-cleanup", 0, 131, 36, 18), // U
    ];

    const op: Operation = {
      kind: "move",
      blockId: "container-lifecycle",
      dx: 13,
      dy: 0,
    };

    // Cards have minW=6 (matches the real cheatsheet card constraint), so
    // status/interaction shrink to w=6 then wrap south.
    const headingOverrides = {
      containers: { minH: 2 },
      images: { minH: 2 },
      inspection: { minH: 2 },
      volumes: { minH: 2 },
      networks: { minH: 2 },
      cleanup: { minH: 2 },
    };
    const cardOverrides = {
      "container-status": { minW: 6 },
      "container-interaction": { minW: 6 },
    };

    const result = applyOperation(
      initial,
      op,
      makeOptions(initial, { ...headingOverrides, ...cardOverrides })
    );

    expect(result.accepted).toBe(true);

    const byId = (id: string) => result.blocks.find((b) => b.id === id)!.position;
    const initialY = (id: string) => initial.find((b) => b.id === id)!.position.y;

    // No overlap anywhere.
    const finalBlocks = result.blocks;
    for (let i = 0; i < finalBlocks.length; i++) {
      for (let j = i + 1; j < finalBlocks.length; j++) {
        const a = finalBlocks[i].position;
        const b = finalBlocks[j].position;
        const overlap =
          a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
        expect(
          overlap,
          `${finalBlocks[i].id} (${JSON.stringify(a)}) overlaps ${finalBlocks[j].id} (${JSON.stringify(b)})`
        ).toBe(false);
      }
    }

    // Primary moved as requested.
    expect(byId("container-lifecycle")).toEqual({ x: 13, y: 2, w: 18, h: 22 });

    // Wrapped blocks land just below the primary, restored to their full width.
    expect(byId("container-status")).toEqual({ x: 18, y: 24, w: 18, h: 11 });
    expect(byId("container-interaction")).toEqual({ x: 18, y: 35, w: 18, h: 16 });

    // Right-column cascade: image-inspection (K) must clear container-interaction
    // (E) which now ends at y=51. K is pushed by F (images, which spans full
    // width and lands at y=51..53 after clearing E). F.init.y=32 <= K.init.y=34
    // → F legitimately pushes K to y=53 (dy=19 total: 17 from E + 2 from F).
    expect(byId("image-inspection").y).toBe(53);

    // Order preservation: blocks that were vertically ordered in the initial
    // layout must remain so after the cascade. No "remontées" allowed.
    const orderPairs: Array<[string, string]> = [
      ["image-lifecycle", "volumes"], // H above L
      ["container-inspection", "networks"], // J above P
      ["image-lifecycle", "volume-lifecycle"], // H above volume-lifecycle
      ["container-inspection", "volume-lifecycle"], // J above volume-lifecycle
    ];
    for (const [aboveId, belowId] of orderPairs) {
      const above = byId(aboveId);
      const below = byId(belowId);
      expect(
        above.y,
        `${aboveId} (y=${above.y}) must remain above ${belowId} (y=${below.y})`
      ).toBeLessThanOrEqual(below.y);
    }

    // Critical: bottom blocks should NOT drift by 30+ cells. Bound their drift
    // by the maximum legitimate dy in the cascade.
    const MAX_REASONABLE_DRIFT = 20;
    const bottomBlocks = [
      "volumes",
      "networks",
      "volume-lifecycle",
      "volume-query",
      "volume-mounting",
      "network-query",
      "image-registry",
      "cleanup",
      "network-lifecycle",
      "network-connection",
      "system-cleanup",
    ];
    for (const id of bottomBlocks) {
      const drift = byId(id).y - initialY(id);
      expect(
        drift,
        `${id} drifted by ${drift} (initial y=${initialY(id)}, final y=${byId(id).y}); expected <= ${MAX_REASONABLE_DRIFT}`
      ).toBeLessThanOrEqual(MAX_REASONABLE_DRIFT);
    }
  });
});

// -----------------------------------------------------------------------------
// Scenario: cascading wrap among chain members.
//
// When a chain member A (heading) reaches its minW and wraps south, any other
// chain member B that ends up overlapping with A's wrap target must itself
// wrap south (and restore its session-initial size), rather than just being
// pushed by the residual cascade. This avoids leaving A sitting on top of B
// in a state where B is still shrunk.
// -----------------------------------------------------------------------------

describe("integration — cascading wrap among chain members", () => {
  it("promotes a chain member to wrap when it collides with another member's wrap target", () => {
    // Setup: A is a heading at the top of a column, B is the card directly
    // under A, C is the card to the east. All three share the top of the grid.
    // Drag C west enough to force A through shrink-to-minW then wrap.
    //
    //   A = heading at (0, 0, w=18, h=2), minW=12
    //   B = card at (0, 2, w=18, h=22), minW=6
    //   C = card at (18, 0, w=18, h=11), minW=6 — primary
    //
    // Dragging C west by dx=-7 forces:
    //   - C through x=18..11 (chain west: C → A & B push west)
    //   - A shrinks until w=12 (minW) then wraps south
    //   - B shrinks alongside A
    // After A wraps, A and B both end up at full width below the primary.
    const initial: LayoutBlock[] = [
      { id: "A", kind: "heading", position: { x: 0, y: 0, w: 18, h: 2 } },
      block("B", 0, 2, 18, 22),
      block("C", 18, 0, 18, 11),
    ];

    const op: Operation = {
      kind: "move",
      blockId: "C",
      dx: -7,
      dy: 0,
    };

    const options = makeOptions(initial, {
      A: { minW: 12, minH: 2 },
      B: { minW: 6 },
      C: { minW: 6 },
    });

    const result = applyOperation(initial, op, options);

    expect(result.accepted).toBe(true);

    const byId = (id: string) => result.blocks.find((b) => b.id === id)!.position;

    // C moves west to x=11.
    expect(byId("C").x).toBe(11);

    // A reached minW=12 and was forced to wrap south. After wrap, A is
    // restored to its session-initial width (w=18).
    expect(byId("A").w).toBe(18);
    expect(byId("A").y).toBeGreaterThan(0);

    // B was in the chain alongside A but as a non-wrappable shrinker. When A
    // wrapped to a y where B was still sitting, B should also wrap south
    // (rather than be left in place to overlap A) and restore its session-
    // initial width.
    expect(byId("B").w).toBe(18);
    expect(byId("B").y).toBeGreaterThan(2);

    // No overlap anywhere.
    for (let i = 0; i < result.blocks.length; i++) {
      for (let j = i + 1; j < result.blocks.length; j++) {
        const a = result.blocks[i].position;
        const b = result.blocks[j].position;
        const overlap =
          a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
        expect(
          overlap,
          `${result.blocks[i].id} (${JSON.stringify(a)}) overlaps ${result.blocks[j].id} (${JSON.stringify(b)})`
        ).toBe(false);
      }
    }

    // A wraps before B (A reached minW first), so A should be above B in the
    // final layout.
    expect(byId("A").y).toBeLessThanOrEqual(byId("B").y);
  });
});
