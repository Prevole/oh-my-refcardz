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
 * Cache semantics (see docs/layout-engine.md, future "Session cache" section):
 *   - The key is the primary's full footprint `${id}:${x}:${y}:${w}:${h}`.
 *   - On cache hit: restore the cached snapshot of the entire working set.
 *   - On cache miss: run the unit resolution and store the resulting snapshot.
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
  const operationOptions = resolveOperationOptions(options.operationOptions);
  const session = createSessionMemory(working);
  const constraints: Map<string, BlockConstraints> = options.constraints;
  const gridColumns = options.gridColumns;

  // stepIndex is a session-wide monotonic counter, incremented on every
  // unit-step attempt (accepted or rejected).
  let stepIndex = 0;

  const ensureOpen = (action: string): void => {
    if (closed) {
      throw new Error(`EngineSession: cannot ${action} after commit/cancel`);
    }
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

  const runMoveStep = (primaryId: string, direction: Direction): StepOutcome => {
    const ctx = makeContext(primaryId);
    emit({ type: "step.start", opId, stepIndex, direction });
    const result = resolveMoveStep(ctx, direction);
    emit({ type: "step.end", opId, stepIndex, accepted: result.accepted });
    stepIndex += 1;
    return result;
  };

  const runResizeStep = (primaryId: string, edge: Direction, sign: 1 | -1): StepOutcome => {
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
