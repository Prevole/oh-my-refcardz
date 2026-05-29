/**
 * EngineSession: stateful, mutation-based API used by interactive editors.
 *
 * A session wraps a working set of blocks and exposes unit-step operations
 * (`step`, `moveTo`, `resize`). It owns a snapshot cache keyed by primary
 * footprint so that revisiting a previously seen position restores the exact
 * state computed at that moment, without recomputing the resolution.
 *
 * Lifecycle:
 *   - createEngineSession(initial, options)       — start a session.
 *   - session.step({...}) | moveTo({...}) | ...   — apply unit operations.
 *   - session.commit() | session.cancel()         — end the session.
 *
 * Step semantics:
 *   - Each `step` advances the primary by exactly one cell in one direction.
 *   - `moveTo({x, y})` decomposes a multi-cell jump into a sequence of unit
 *     steps along the geometric path between current and target footprints.
 *   - `resize` advances one edge by one cell.
 *
 * Cache semantics (see docs/layout-engine.md, "Session cache"):
 *   - The key is the primary's full footprint `${id}:${x}:${y}:${w}:${h}`.
 *   - Before each unit step, the current state is recorded under the primary's
 *     current footprint (idempotent).
 *   - If the step's target footprint is already cached, the cached snapshot
 *     is restored and a `session.restore` event is emitted instead of
 *     recomputing the resolution.
 *   - Otherwise the step runs normally and its resulting state is cached on
 *     the next iteration when the primary sits on the new footprint.
 *
 * The legacy stateless `applyOperation(blocks, op, options)` is a thin wrapper
 * around an ephemeral EngineSession; see engine.ts.
 */

import { createSessionMemory } from "./session";
import { resolveMoveStep, resolveResizeStep, type StepContext } from "./step";
import type {
  BlockConstraints,
  Direction,
  EngineEvent,
  EngineEventEmitter,
  EngineOptions,
  LayoutBlock,
  OperationOptions,
} from "./types";

// -----------------------------------------------------------------------------
// Public types
// -----------------------------------------------------------------------------

export type EngineSessionOptions = EngineOptions & {
  /**
   * Resolved operation options that apply to every step within this session.
   * Defaults to { allowWrap: true, allowShrink: true, compact: false }.
   */
  operationOptions?: OperationOptions;
};

export type StepInput = {
  blockId: string;
  direction: Direction;
};

export type MoveToInput = {
  blockId: string;
  x: number;
  y: number;
};

export type ResizeInput = {
  blockId: string;
  edge: Direction;
  direction: "grow" | "shrink";
};

export type StepOutcome = {
  accepted: boolean;
  reason?: string;
  affected: {
    moved: Set<string>;
    shrunk: Map<string, { w: number; h: number }>;
    wrapped: Set<string>;
  };
};

export type MoveToOutcome = {
  /** Number of unit steps that succeeded along the decomposed path. */
  stepsApplied: number;
  /** True if the primary reached the requested (x, y), false otherwise. */
  reachedTarget: boolean;
  /** Aggregated set of blocks affected across all steps. */
  affected: {
    moved: Set<string>;
    shrunk: Map<string, { w: number; h: number }>;
    wrapped: Set<string>;
  };
};

export type EngineSession = {
  /** Read-only view of the current working set. Cloned on each access. */
  getCurrentBlocks(): LayoutBlock[];
  /** Apply one unit step. */
  step(input: StepInput): StepOutcome;
  /** Apply unit steps along the path from the primary's footprint to (x, y). */
  moveTo(input: MoveToInput): MoveToOutcome;
  /** Apply one unit resize step on the given edge. */
  resize(input: ResizeInput): StepOutcome;
  /**
   * Update the operation options used by subsequent step / moveTo / resize
   * calls. Unspecified fields keep their current value. Useful when a UI
   * modifier (e.g. Shift) toggles strict mode mid-drag.
   */
  setOperationOptions(options: OperationOptions): void;
  /** Finish the session, returning the final state. */
  commit(): LayoutBlock[];
  /** Abandon the session, returning the original initial state. */
  cancel(): LayoutBlock[];
};

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

const cloneBlocks = (blocks: readonly LayoutBlock[]): LayoutBlock[] =>
  blocks.map((b) => ({ id: b.id, kind: b.kind, position: { ...b.position } }));

const defaultOptions: Required<OperationOptions> = {
  allowWrap: true,
  allowShrink: true,
  compact: false,
};

const resolveOperationOptions = (
  options: OperationOptions | undefined
): Required<OperationOptions> => ({
  allowWrap: options?.allowWrap ?? defaultOptions.allowWrap,
  allowShrink: options?.allowShrink ?? defaultOptions.allowShrink,
  compact: options?.compact ?? defaultOptions.compact,
});

const generateOpId = (): string =>
  `op-${Date.now().toString(36)}-${Math.floor(Math.random() * 1_000_000).toString(36)}`;

const makeEmit =
  (emitter: EngineEventEmitter | undefined) =>
  (event: EngineEvent): void => {
    if (emitter) emitter.emit(event);
  };

const findPrimary = (blocks: readonly LayoutBlock[], id: string): LayoutBlock | undefined =>
  blocks.find((b) => b.id === id);

const footprintKey = (
  primaryId: string,
  footprint: { x: number; y: number; w: number; h: number }
): string => `${primaryId}:${footprint.x}:${footprint.y}:${footprint.w}:${footprint.h}`;

// -----------------------------------------------------------------------------
// Factory
// -----------------------------------------------------------------------------

export function createEngineSession(
  initialBlocks: readonly LayoutBlock[],
  options: EngineSessionOptions
): EngineSession {
  const initial = cloneBlocks(initialBlocks);
  let working: LayoutBlock[] = cloneBlocks(initialBlocks);
  let closed = false;

  const opId = options.opId ?? generateOpId();
  const emit = makeEmit(options.emitter);
  const operationOptions: Required<OperationOptions> = resolveOperationOptions(
    options.operationOptions
  );
  const session = createSessionMemory(working);
  const constraints: Map<string, BlockConstraints> = options.constraints;
  const gridColumns = options.gridColumns;

  // stepIndex is a session-wide monotonic counter, incremented on every
  // unit-step attempt (accepted, rejected, or restored from cache).
  let stepIndex = 0;

  // Snapshot cache: key = footprint of the primary, value = clone of the
  // entire working set at the moment the primary sat on that footprint.
  const cache = new Map<string, LayoutBlock[]>();

  const ensureOpen = (action: string): void => {
    if (closed) {
      throw new Error(`EngineSession: cannot ${action} after commit/cancel`);
    }
  };

  // Cache the current working state under the primary's current footprint,
  // unless an entry for that footprint already exists. Idempotent.
  const cacheCurrent = (primaryId: string): void => {
    const primary = findPrimary(working, primaryId);
    if (!primary) return;
    const key = footprintKey(primaryId, primary.position);
    if (!cache.has(key)) {
      cache.set(key, cloneBlocks(working));
    }
  };

  // Replace `working` in place with a clone of `snapshot`. Mutates the same
  // array reference so that StepContext.blocks consumers stay coherent.
  const restoreSnapshot = (snapshot: readonly LayoutBlock[]): void => {
    working.length = 0;
    for (const b of cloneBlocks(snapshot)) working.push(b);
  };

  const makeContext = (primaryId: string): StepContext => ({
    blocks: working,
    primaryId,
    gridColumns,
    constraints,
    options: operationOptions,
    session,
    emit,
    opId,
    stepIndex,
  });

  // Translate a footprint by one unit in the given direction.
  const translateFootprint = (
    footprint: { x: number; y: number; w: number; h: number },
    direction: Direction
  ): { x: number; y: number; w: number; h: number } => {
    switch (direction) {
      case "north":
        return { ...footprint, y: footprint.y - 1 };
      case "south":
        return { ...footprint, y: footprint.y + 1 };
      case "east":
        return { ...footprint, x: footprint.x + 1 };
      case "west":
        return { ...footprint, x: footprint.x - 1 };
    }
  };

  const runMoveStep = (primaryId: string, direction: Direction): StepOutcome => {
    const primary = findPrimary(working, primaryId);
    if (!primary) {
      throw new Error(`EngineSession.step: primary "${primaryId}" not found`);
    }

    // Record the current state before any mutation so we can return here later.
    cacheCurrent(primaryId);

    // Cache hit on the projected target footprint? Restore and emit.
    const target = translateFootprint(primary.position, direction);
    const targetKey = footprintKey(primaryId, target);
    const cached = cache.get(targetKey);
    if (cached) {
      restoreSnapshot(cached);
      emit({
        type: "session.restore",
        opId,
        stepIndex,
        primaryId,
        cacheKey: targetKey,
      });
      stepIndex += 1;
      return {
        accepted: true,
        affected: {
          moved: new Set(),
          shrunk: new Map(),
          wrapped: new Set(),
        },
      };
    }

    // Cache miss: run the resolution normally.
    const ctx = makeContext(primaryId);
    emit({ type: "step.start", opId, stepIndex, direction });
    const result = resolveMoveStep(ctx, direction);
    emit({ type: "step.end", opId, stepIndex, accepted: result.accepted });
    stepIndex += 1;
    return result;
  };

  const runResizeStep = (primaryId: string, edge: Direction, sign: 1 | -1): StepOutcome => {
    const primary = findPrimary(working, primaryId);
    if (!primary) {
      throw new Error(`EngineSession.resize: primary "${primaryId}" not found`);
    }

    cacheCurrent(primaryId);

    // For resize, the target footprint depends on the edge + sign:
    // grow east → w+1; shrink east → w-1; grow north → y-1, h+1; etc.
    const targetFootprint = ((): {
      x: number;
      y: number;
      w: number;
      h: number;
    } => {
      const p = primary.position;
      switch (edge) {
        case "east":
          return { ...p, w: p.w + sign };
        case "west":
          return { ...p, x: p.x - sign, w: p.w + sign };
        case "south":
          return { ...p, h: p.h + sign };
        case "north":
          return { ...p, y: p.y - sign, h: p.h + sign };
      }
    })();

    const targetKey = footprintKey(primaryId, targetFootprint);
    const cached = cache.get(targetKey);
    if (cached) {
      restoreSnapshot(cached);
      emit({
        type: "session.restore",
        opId,
        stepIndex,
        primaryId,
        cacheKey: targetKey,
      });
      stepIndex += 1;
      return {
        accepted: true,
        affected: {
          moved: new Set(),
          shrunk: new Map(),
          wrapped: new Set(),
        },
      };
    }

    const ctx = makeContext(primaryId);
    emit({ type: "step.start", opId, stepIndex, direction: edge });
    const result = resolveResizeStep(ctx, edge, sign);
    emit({ type: "step.end", opId, stepIndex, accepted: result.accepted });
    stepIndex += 1;
    return result;
  };

  return {
    getCurrentBlocks(): LayoutBlock[] {
      return cloneBlocks(working);
    },

    step(input: StepInput): StepOutcome {
      ensureOpen("step");
      const primary = findPrimary(working, input.blockId);
      if (!primary) {
        throw new Error(`EngineSession.step: primary "${input.blockId}" not found`);
      }
      return runMoveStep(input.blockId, input.direction);
    },

    moveTo(input: MoveToInput): MoveToOutcome {
      ensureOpen("moveTo");
      const primary = findPrimary(working, input.blockId);
      if (!primary) {
        throw new Error(`EngineSession.moveTo: primary "${input.blockId}" not found`);
      }

      // Aggregated outcome across all steps along the path.
      const aggregated: MoveToOutcome["affected"] = {
        moved: new Set<string>(),
        shrunk: new Map<string, { w: number; h: number }>(),
        wrapped: new Set<string>(),
      };
      let stepsApplied = 0;

      // Greedy path decomposition: at each iteration, pick the axis that needs
      // the larger remaining displacement and step one cell along it. This
      // mirrors the natural physical trajectory of a cursor moving toward the
      // target — predominantly horizontal motion produces mostly horizontal
      // steps before vertical ones.
      while (true) {
        const current = findPrimary(working, input.blockId);
        if (!current) break;
        const dx = input.x - current.position.x;
        const dy = input.y - current.position.y;
        if (dx === 0 && dy === 0) {
          return {
            stepsApplied,
            reachedTarget: true,
            affected: aggregated,
          };
        }

        const direction: Direction =
          Math.abs(dx) >= Math.abs(dy)
            ? dx < 0
              ? "west"
              : "east"
            : dy < 0
              ? "north"
              : "south";

        const result = runMoveStep(input.blockId, direction);
        if (!result.accepted) {
          return {
            stepsApplied,
            reachedTarget: false,
            affected: aggregated,
          };
        }

        stepsApplied += 1;
        for (const id of result.affected.moved) aggregated.moved.add(id);
        for (const [id, size] of result.affected.shrunk) {
          if (!aggregated.shrunk.has(id)) aggregated.shrunk.set(id, size);
        }
        for (const id of result.affected.wrapped) aggregated.wrapped.add(id);
      }

      // Unreachable; the loop returns from inside.
      return { stepsApplied, reachedTarget: true, affected: aggregated };
    },

    resize(input: ResizeInput): StepOutcome {
      ensureOpen("resize");
      const primary = findPrimary(working, input.blockId);
      if (!primary) {
        throw new Error(`EngineSession.resize: primary "${input.blockId}" not found`);
      }
      const sign: 1 | -1 = input.direction === "grow" ? 1 : -1;
      return runResizeStep(input.blockId, input.edge, sign);
    },

    setOperationOptions(next: OperationOptions): void {
      ensureOpen("setOperationOptions");
      if (next.allowWrap !== undefined) operationOptions.allowWrap = next.allowWrap;
      if (next.allowShrink !== undefined) operationOptions.allowShrink = next.allowShrink;
      if (next.compact !== undefined) operationOptions.compact = next.compact;
    },

    commit(): LayoutBlock[] {
      ensureOpen("commit");
      closed = true;
      return cloneBlocks(working);
    },

    cancel(): LayoutBlock[] {
      ensureOpen("cancel");
      closed = true;
      working = cloneBlocks(initial);
      return cloneBlocks(initial);
    },
  };
}
