/**
 * Keyboard layout session — pure logic.
 *
 * Wraps an EngineSession to provide the semantics needed by the keyboard
 * layout mode: per-keystroke OperationOptions normalisation, a standalone
 * `changesCount` counter, and undo/redo entry points (`reset`,
 * `replaceContents`) that swap the underlying session.
 *
 * No React, no DOM. The companion hook `use-layout-buffer-state.ts` is a
 * thin shell that surfaces this module's state into React rendering.
 *
 * Lifecycle:
 *
 *   1. `createKeyboardSession(snapshot, ctx)` opens an EngineSession on
 *      `snapshot`. The session lives for the entire keyboard mode so its
 *      snapshot cache makes revisited footprints geometrically reversible
 *      — Right Right Left Left lands back on the exact previously-computed
 *      layout, neighbours included.
 *   2. `apply(op)` routes the operation to `EngineSession.step` /
 *      `EngineSession.resize` after pushing per-keystroke
 *      `OperationOptions` (strict / compact toggles).
 *   3. `commit()` finalises the underlying session and returns the staged
 *      blocks for the caller to persist.
 *   4. `cancel()` abandons the session without producing output.
 *   5. `reset()` cancels and reopens a fresh session rooted at the original
 *      initial snapshot. The cache is intentionally dropped — reset is
 *      semantically "start over from scratch".
 *   6. `replaceContents(snapshot, delta)` is the undo/redo entry point: it
 *      cancels the current session, opens a new one on `snapshot`, and
 *      adjusts the standalone `changesCount` by `delta`. The cache is
 *      dropped here too; we do not try to preserve entries that may no
 *      longer be reachable from the new baseline.
 *
 * Counter semantics:
 *
 *   - `changesCount` counts operations that effectively changed the layout.
 *     No-op operations (rejected by the engine, or producing an identical
 *     layout) do not increment the counter.
 *   - `replaceContents` is the only operation that may decrement the
 *     counter. It clamps to `[0, +Inf)` and forces 0 when the new snapshot
 *     equals the initial snapshot structurally.
 *
 * Note on context: `gridColumns`, `constraints`, and `emitterProvider` are
 * captured at creation. A reopened session reuses the same map because the
 * keyboard mode never adds or removes blocks; only positions and sizes
 * change. If the set of block ids/kinds were to vary mid-session, the
 * caller would need to create a brand-new session.
 */

import {
  createEngineSession,
  type BlockConstraints,
  type EngineEventEmitter,
  type EngineSession,
  type LayoutBlock,
  type MoveOperation,
  type Operation,
  type OperationOptions,
  type ResizeOperation,
} from "@/lib/layout/engine";

export type SessionContext = {
  gridColumns: number;
  constraints: Map<string, BlockConstraints>;
  /**
   * Optional dynamic emitter resolver, invoked on every event emission.
   * Use this when the emitter's lifetime is shorter than the session
   * (e.g. a debug recorder that may be toggled while the keyboard mode
   * is open).
   */
  emitterProvider?: () => EngineEventEmitter | undefined;
};

export type ApplyOutcome = {
  /** Resulting blocks (== getCurrentBlocks() after the call). */
  blocks: readonly LayoutBlock[];
  /** Effective edits counter after the call. */
  changesCount: number;
  /** True when the operation produced a change. */
  changed: boolean;
};

export type KeyboardSession = {
  /** Live snapshot of the staged blocks. */
  getCurrentBlocks(): readonly LayoutBlock[];
  /** Standalone counter — counts only operations that effectively changed the layout. */
  getChangesCount(): number;
  /** Apply a keyboard operation to the underlying engine session. */
  apply(op: Operation): ApplyOutcome;
  /** Finalise the session and return the staged blocks. */
  commit(): readonly LayoutBlock[];
  /** Abandon the session without producing output. */
  cancel(): void;
  /**
   * Cancel the current session and open a fresh one rooted at the original
   * initial snapshot. Counter goes back to 0. Returns the initial snapshot.
   */
  reset(): readonly LayoutBlock[];
  /**
   * Replace the session contents with `snapshot` and adjust `changesCount`
   * by `delta`. Counter is clamped to `[0, +Inf)` and forced to 0 when
   * `snapshot` equals the initial snapshot structurally. Returns the new
   * staged blocks.
   */
  replaceContents(
    snapshot: readonly LayoutBlock[],
    delta: number,
  ): readonly LayoutBlock[];
};

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

/**
 * Structural equality on (id, kind, position). Block order is significant —
 * the engine is deterministic about ordering so a permutation would itself
 * mean something changed.
 */
export function blocksEqual(
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

/**
 * Fully resolve `op.options` so the session's "undefined preserves" semantics
 * cannot leak strict-mode flags from a prior keystroke into the next one.
 * Every call to `apply` pushes a complete options set.
 */
function resolveKeystrokeOptions(op: Operation): Required<OperationOptions> {
  const o = op.options ?? {};
  return {
    allowWrap: o.allowWrap ?? true,
    allowShrink: o.allowShrink ?? true,
    compact: o.compact ?? false,
  };
}

function directionFromMove(
  op: MoveOperation,
): "north" | "south" | "east" | "west" | null {
  if (op.dx === 1 && op.dy === 0) return "east";
  if (op.dx === -1 && op.dy === 0) return "west";
  if (op.dx === 0 && op.dy === 1) return "south";
  if (op.dx === 0 && op.dy === -1) return "north";
  return null;
}

// -----------------------------------------------------------------------------
// Factory
// -----------------------------------------------------------------------------

export function createKeyboardSession(
  initialSnapshot: readonly LayoutBlock[],
  ctx: SessionContext,
): KeyboardSession {
  const initial = initialSnapshot;
  let engine: EngineSession = openEngine(initial);
  let current: readonly LayoutBlock[] = initial;
  let changes = 0;
  let closed = false;

  function openEngine(snapshot: readonly LayoutBlock[]): EngineSession {
    return createEngineSession(snapshot, {
      gridColumns: ctx.gridColumns,
      constraints: ctx.constraints,
      emitterProvider: ctx.emitterProvider,
    });
  }

  function ensureOpen(action: string): void {
    if (closed) {
      throw new Error(
        `KeyboardSession: cannot ${action} after commit/cancel`,
      );
    }
  }

  function closeEngine(): void {
    try {
      engine.cancel();
    } catch {
      // Engine already closed — ignore.
    }
  }

  return {
    getCurrentBlocks(): readonly LayoutBlock[] {
      return current;
    },
    getChangesCount(): number {
      return changes;
    },
    apply(op: Operation): ApplyOutcome {
      ensureOpen("apply");
      const before = current;
      const options = resolveKeystrokeOptions(op);
      engine.setOperationOptions(options);

      if (op.kind === "move") {
        const dir = directionFromMove(op);
        if (dir) {
          engine.step({ blockId: op.blockId, direction: dir });
        }
        // Non-unit moves are not produced by the keyboard hook. If they
        // ever appear, skipping the call keeps the working state unchanged
        // and the outcome reports no-op.
      } else {
        const resize = op as ResizeOperation;
        if (resize.delta !== 0) {
          engine.resize({
            blockId: resize.blockId,
            edge: resize.edge,
            direction: resize.delta > 0 ? "grow" : "shrink",
          });
        }
      }

      const after = engine.getCurrentBlocks();
      const changed = !blocksEqual(before, after);
      if (changed) {
        current = after;
        changes += 1;
      }
      return { blocks: current, changesCount: changes, changed };
    },
    commit(): readonly LayoutBlock[] {
      ensureOpen("commit");
      const blocks = engine.commit();
      closed = true;
      current = blocks;
      return blocks;
    },
    cancel(): void {
      if (closed) return;
      closeEngine();
      closed = true;
    },
    reset(): readonly LayoutBlock[] {
      ensureOpen("reset");
      closeEngine();
      engine = openEngine(initial);
      current = initial;
      changes = 0;
      return initial;
    },
    replaceContents(
      snapshot: readonly LayoutBlock[],
      delta: number,
    ): readonly LayoutBlock[] {
      ensureOpen("replaceContents");
      closeEngine();
      engine = openEngine(snapshot);
      current = snapshot;
      changes = blocksEqual(snapshot, initial)
        ? 0
        : Math.max(0, changes + delta);
      return snapshot;
    },
  };
}
