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
});
