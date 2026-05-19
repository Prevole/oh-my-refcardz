/**
 * Engine orchestrator: `applyOperation`.
 *
 * Decomposes an Operation into ordered unit steps (vertical-first for moves),
 * runs `resolveMoveStep` / `resolveResizeStep` for each, and aggregates results.
 *
 * See docs/layout-engine.md, "Resolution pipeline".
 */

import { createSessionMemory } from "./session";
import { resolveMoveStep, resolveResizeStep, type StepContext } from "./step";
import type {
  Direction,
  EngineEvent,
  EngineEventEmitter,
  EngineOptions,
  LayoutBlock,
  Operation,
  OperationOptions,
  OperationResult,
} from "./types";

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

const directionsForMove = (dx: number, dy: number): Direction[] => {
  const steps: Direction[] = [];
  // Vertical first.
  const vDir: Direction = dy < 0 ? "north" : "south";
  for (let i = 0; i < Math.abs(dy); i++) steps.push(vDir);
  // Horizontal second.
  const hDir: Direction = dx < 0 ? "west" : "east";
  for (let i = 0; i < Math.abs(dx); i++) steps.push(hDir);
  return steps;
};

// -----------------------------------------------------------------------------
// Public API
// -----------------------------------------------------------------------------

export function applyOperation(
  blocks: readonly LayoutBlock[],
  operation: Operation,
  options: EngineOptions
): OperationResult {
  const primary = blocks.find((b) => b.id === operation.blockId);
  if (!primary) {
    throw new Error(`applyOperation: primary block "${operation.blockId}" not found`);
  }

  const opId = options.opId ?? generateOpId();
  const emit = makeEmit(options.emitter);
  const operationOptions = resolveOperationOptions(operation.options);

  // Working copy: mutations stay local until we return.
  const working = cloneBlocks(blocks);
  const initial = cloneBlocks(blocks);

  // Session memory captures sizes at session.start time.
  const session = createSessionMemory(working);

  // Detect immediate no-op (move with dx=0, dy=0).
  if (operation.kind === "move" && operation.dx === 0 && operation.dy === 0) {
    emit({ type: "session.start", opId, operation, initial });
    emit({ type: "session.end", opId, accepted: false, final: cloneBlocks(working) });
    return {
      blocks: working,
      accepted: false,
      appliedDx: 0,
      appliedDy: 0,
      appliedDelta: 0,
      affected: { moved: new Set(), shrunk: new Map(), wrapped: new Set() },
      rejected: { reason: "no-op" },
    };
  }
  if (operation.kind === "resize" && operation.delta === 0) {
    emit({ type: "session.start", opId, operation, initial });
    emit({ type: "session.end", opId, accepted: false, final: cloneBlocks(working) });
    return {
      blocks: working,
      accepted: false,
      appliedDx: 0,
      appliedDy: 0,
      appliedDelta: 0,
      affected: { moved: new Set(), shrunk: new Map(), wrapped: new Set() },
      rejected: { reason: "no-op" },
    };
  }

  emit({ type: "session.start", opId, operation, initial });

  // Build the step program.
  const stepDirections: Direction[] =
    operation.kind === "move"
      ? directionsForMove(operation.dx, operation.dy)
      : Array.from(
          { length: Math.abs(operation.delta) },
          () => operation.edge
        );

  // Aggregated result accumulators.
  const moved = new Set<string>();
  const shrunk = new Map<string, { w: number; h: number }>();
  const wrapped = new Set<string>();
  let appliedDx = 0;
  let appliedDy = 0;
  let appliedDelta = 0;
  let anyAccepted = false;
  let rejectionReason: string | undefined;

  const resizeStepSign = operation.kind === "resize" ? Math.sign(operation.delta) : 0;

  // Run steps in order, aborting on first rejection.
  for (let stepIndex = 0; stepIndex < stepDirections.length; stepIndex++) {
    const direction = stepDirections[stepIndex];

    emit({ type: "step.start", opId, stepIndex, direction });

    const ctx: StepContext = {
      blocks: working,
      primaryId: operation.blockId,
      gridColumns: options.gridColumns,
      constraints: options.constraints,
      options: operationOptions,
      session,
      emit,
      opId,
      stepIndex,
    };

    const stepResult =
      operation.kind === "move"
        ? resolveMoveStep(ctx, direction)
        : resolveResizeStep(ctx, direction, resizeStepSign);

    emit({ type: "step.end", opId, stepIndex, accepted: stepResult.accepted });

    if (!stepResult.accepted) {
      /* c8 ignore next -- defensive: every step rejection carries a reason */
      rejectionReason = stepResult.reason ?? "step-rejected";
      break;
    }

    anyAccepted = true;

    // Aggregate affected.
    for (const id of stepResult.affected.moved) moved.add(id);
    for (const [id, size] of stepResult.affected.shrunk) {
      if (!shrunk.has(id)) shrunk.set(id, size);
    }
    for (const id of stepResult.affected.wrapped) wrapped.add(id);

    // Update applied deltas.
    if (operation.kind === "move") {
      if (direction === "north") appliedDy -= 1;
      else if (direction === "south") appliedDy += 1;
      else if (direction === "east") appliedDx += 1;
      else if (direction === "west") appliedDx -= 1;
    } else {
      appliedDelta += resizeStepSign;
    }
  }

  const final = cloneBlocks(working);
  emit({ type: "session.end", opId, accepted: anyAccepted, final });

  const result: OperationResult = {
    blocks: working,
    accepted: anyAccepted,
    appliedDx,
    appliedDy,
    appliedDelta,
    affected: { moved, shrunk, wrapped },
  };
  if (!anyAccepted && rejectionReason) {
    result.rejected = { reason: rejectionReason };
  }
  return result;
}
