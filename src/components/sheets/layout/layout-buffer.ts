/**
 * Buffered layout staging for keyboard layout mode.
 *
 * This module is a pure data layer. It owns no React state, no DOM, no
 * persistence. Its job is to absorb engine operations into an in-memory
 * snapshot so the caller can later commit (apply to persistence) or
 * discard (forget) the accumulated edits.
 *
 * Lifecycle expected by callers:
 *
 *   1. Create a buffer from the currently persisted layout when entering
 *      the keyboard layout mode:                  createBuffer(snapshot)
 *   2. For every keyboard operation, route through the buffer instead of
 *      the editor:                                applyToBuffer(buf, op, ctx)
 *   3. On commit (Return): take the final blocks and hand them to the
 *      persistence layer:                         commitBuffer(buf)
 *   4. On discard (Esc / mouse click): drop the buffer reference. There
 *      is no separate `discardBuffer` function because discarding is the
 *      absence of a commit — the caller simply stops using the buffer.
 *
 * Immutability: every call returns a new buffer object. The input buffer
 * is never mutated; reusing it after an `applyToBuffer` call yields the
 * pre-call state, which is useful for tests and for branching scenarios.
 *
 * Counter semantics: `changesCount` counts how many operations *changed*
 * the layout. Operations rejected or no-oped by the engine (constraint
 * violations, clamping that produced an identical layout) do not
 * increment the counter. This matches the user-facing intent — the
 * counter measures effective edits, not keystrokes.
 */

import {
  applyOperation,
  type BlockConstraints,
  type EngineEventEmitter,
  type LayoutBlock,
  type Operation,
} from "@/lib/layout/engine";

export type LayoutBuffer = {
  /** Layout captured when the buffer was created. Never mutated. */
  readonly initialSnapshot: readonly LayoutBlock[];
  /** Current staged layout. Reflects all accepted operations since `start`. */
  readonly currentBuffer: readonly LayoutBlock[];
  /** Number of operations that actually changed the layout. */
  readonly changesCount: number;
};

export type ApplyContext = {
  gridColumns: number;
  constraints: Map<string, BlockConstraints>;
  emitter?: EngineEventEmitter;
};

export type ApplyResult = {
  /** New buffer (or the input buffer reference if the op was a no-op). */
  buffer: LayoutBuffer;
  /** Resulting blocks (== `buffer.currentBuffer`, repeated for ergonomics). */
  blocks: readonly LayoutBlock[];
};

/**
 * Build a fresh buffer rooted at `snapshot`. The snapshot is stored by
 * reference; callers should pass an immutable array.
 */
export function createBuffer(snapshot: readonly LayoutBlock[]): LayoutBuffer {
  return {
    initialSnapshot: snapshot,
    currentBuffer: snapshot,
    changesCount: 0,
  };
}

/**
 * Apply `op` to `buffer.currentBuffer` through the layout engine and
 * return the next buffer state plus the resulting blocks.
 *
 * If the engine returns a layout identical to the input (no-op or fully
 * rejected operation), the original buffer reference is returned and
 * `changesCount` stays put.
 */
export function applyToBuffer(
  buffer: LayoutBuffer,
  op: Operation,
  ctx: ApplyContext,
): ApplyResult {
  const result = applyOperation(buffer.currentBuffer, op, {
    gridColumns: ctx.gridColumns,
    constraints: ctx.constraints,
    emitter: ctx.emitter,
  });

  if (areBlocksEqual(buffer.currentBuffer, result.blocks)) {
    return { buffer, blocks: buffer.currentBuffer };
  }

  return {
    buffer: {
      initialSnapshot: buffer.initialSnapshot,
      currentBuffer: result.blocks,
      changesCount: buffer.changesCount + 1,
    },
    blocks: result.blocks,
  };
}

/**
 * Return the layout that should be persisted on commit. Callers pass
 * this to their persistence setter and then drop the buffer reference.
 */
export function commitBuffer(buffer: LayoutBuffer): readonly LayoutBlock[] {
  return buffer.currentBuffer;
}

/**
 * Reset the buffer to its initial snapshot without dropping it. The
 * caller stays in layout mode; only the staged edits are forgotten.
 * `changesCount` is zeroed. If the buffer is already at the initial
 * snapshot, the same reference is returned.
 */
export function resetBuffer(buffer: LayoutBuffer): LayoutBuffer {
  if (
    buffer.changesCount === 0 &&
    buffer.currentBuffer === buffer.initialSnapshot
  ) {
    return buffer;
  }
  return {
    initialSnapshot: buffer.initialSnapshot,
    currentBuffer: buffer.initialSnapshot,
    changesCount: 0,
  };
}

/**
 * Structural equality on the fields the engine produces: id, kind, and
 * position (x, y, w, h). Block order is treated as significant — the
 * engine is deterministic about ordering, so a permutation would itself
 * be a meaningful change.
 */
function areBlocksEqual(
  a: readonly LayoutBlock[],
  b: readonly LayoutBlock[],
): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const ba = a[i];
    const bb = b[i];
    if (ba.id !== bb.id) return false;
    if (ba.kind !== bb.kind) return false;
    const pa = ba.position;
    const pb = bb.position;
    if (pa.x !== pb.x || pa.y !== pb.y || pa.w !== pb.w || pa.h !== pb.h) {
      return false;
    }
  }
  return true;
}
