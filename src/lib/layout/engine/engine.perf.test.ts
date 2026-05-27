import { describe, expect, it } from "vitest";
import { applyOperation } from "./engine";
import { createEventEmitter } from "./events";
import type { BlockConstraints, EngineEvent, LayoutBlock } from "./types";
import { GRID_COLUMNS } from "../grid-constants";
const PERF_BUDGET_MS = 50;
const BLOCK_COUNT = 100;

const defaultConstraints: BlockConstraints = {
  minW: 1,
  minH: 1,
  allowedResizeDirections: ["north", "south", "east", "west"],
};

/**
 * Build a realistic layout of `BLOCK_COUNT` blocks with no initial collisions.
 *
 * Strategy:
 * - Stack rows of blocks south-bound, each row filling the 64-column grid.
 * - Vary block widths (2..6 columns) and heights (1..3 rows) deterministically
 *   so the chain BFS explores non-trivial transitive contiguity.
 * - The result is a dense "real world" grid that triggers chain propagation,
 *   shrinking, wrapping, and south-fallback residual collisions under operation.
 */
function buildDenseLayout(count: number): LayoutBlock[] {
  const blocks: LayoutBlock[] = [];
  let id = 0;
  let row = 0;
  while (blocks.length < count) {
    let col = 0;
    let rowHeight = 0;
    while (col < GRID_COLUMNS && blocks.length < count) {
      // Deterministic width 2..6 and height 1..3.
      const w = 2 + ((id * 7) % 5);
      const h = 1 + ((id * 3) % 3);
      const clampedW = Math.min(w, GRID_COLUMNS - col);
      blocks.push({
        id: `b${id}`,
        kind: "card",
        position: { x: col, y: row, w: clampedW, h },
      });
      col += clampedW;
      rowHeight = Math.max(rowHeight, h);
      id += 1;
    }
    row += rowHeight;
  }
  return blocks;
}

function buildConstraints(blocks: readonly LayoutBlock[]): Map<string, BlockConstraints> {
  const m = new Map<string, BlockConstraints>();
  for (const b of blocks) m.set(b.id, defaultConstraints);
  return m;
}

describe("applyOperation — performance guard (3.11)", () => {
  it(`resolves a complex move on ${BLOCK_COUNT} blocks under ${PERF_BUDGET_MS}ms`, () => {
    const blocks = buildDenseLayout(BLOCK_COUNT);
    expect(blocks.length).toBe(BLOCK_COUNT);

    const constraints = buildConstraints(blocks);

    // Pick a block in the top row and move it east by several cells.
    // This triggers a long east chain across the row, with east-edge saturation
    // forcing wraps and likely cascading south-fallback collisions.
    const primary = blocks[0];

    // Sanity check: capture events to ensure the workload is non-trivial.
    const events: EngineEvent[] = [];
    const emitter = createEventEmitter();
    emitter.on((e) => events.push(e));

    // Warm-up run to amortize JIT/inlining costs; perf budget targets steady-state.
    applyOperation(blocks, { kind: "move", blockId: primary.id, dx: 5, dy: 0 }, {
      gridColumns: GRID_COLUMNS,
      constraints,
      emitter,
    });

    // Reset events before the timed run.
    events.length = 0;

    const start = performance.now();
    const result = applyOperation(blocks, { kind: "move", blockId: primary.id, dx: 5, dy: 0 }, {
      gridColumns: GRID_COLUMNS,
      constraints,
      emitter,
    });
    const elapsed = performance.now() - start;

    expect(result).toBeDefined();
    // Workload sanity: an east move on a dense grid must trigger non-trivial
    // chain activity. If this drops to ~2 events, the test is no longer meaningful.
    expect(events.length).toBeGreaterThan(10);
    expect(elapsed).toBeLessThan(PERF_BUDGET_MS);
  });

  it(`resolves a complex resize on ${BLOCK_COUNT} blocks under ${PERF_BUDGET_MS}ms`, () => {
    const blocks = buildDenseLayout(BLOCK_COUNT);
    const constraints = buildConstraints(blocks);
    const primary = blocks[0];

    applyOperation(
      blocks,
      { kind: "resize", blockId: primary.id, edge: "east", delta: 3 },
      { gridColumns: GRID_COLUMNS, constraints }
    );

    const start = performance.now();
    const result = applyOperation(
      blocks,
      { kind: "resize", blockId: primary.id, edge: "east", delta: 3 },
      { gridColumns: GRID_COLUMNS, constraints }
    );
    const elapsed = performance.now() - start;

    expect(result).toBeDefined();
    expect(elapsed).toBeLessThan(PERF_BUDGET_MS);
  });
});
