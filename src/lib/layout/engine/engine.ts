/**
 * Engine orchestrator: `applyOperation`.
 *
 * Stateless facade over EngineSession. Opens an ephemeral session for the
 * duration of a single Operation, decomposes the operation into unit steps,
 * and returns the aggregated OperationResult.
 *
 * Move decomposition is dominant-axis greedy (see EngineSession.moveTo): at
 * each iteration, the axis with the larger remaining displacement is stepped
 * first. This avoids transient-only collisions that the previous
 * vertical-first decomposition could trigger on diagonal moves.
 *
 * Partial-progress semantics: when a unit step is rejected mid-operation,
 * the loop stops but the accepted steps are kept (the working set reflects
 * the partial result). `accepted` is true if at least one step succeeded.
 *
 * See docs/layout-engine.md, "Resolution pipeline".
 */

import { createEngineSession } from "./engine-session";
import type {
  EngineEvent,
  EngineEventEmitter,
  EngineOptions,
  LayoutBlock,
  Operation,
  OperationResult,
} from "./types";

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

const cloneBlocks = (blocks: readonly LayoutBlock[]): LayoutBlock[] =>
  blocks.map((b) => ({ id: b.id, kind: b.kind, position: { ...b.position } }));

const generateOpId = (): string =>
  `op-${Date.now().toString(36)}-${Math.floor(Math.random() * 1_000_000).toString(36)}`;

const makeEmit =
  (emitter: EngineEventEmitter | undefined) =>
  (event: EngineEvent): void => {
    if (emitter) emitter.emit(event);
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
  const initial = cloneBlocks(blocks);

  // No-op detection: emit a paired session.start / session.end with
  // accepted=false and reason="no-op". This matches the pre-session behavior
  // expected by existing call sites and tests.
  const isMoveNoop =
    operation.kind === "move" && operation.dx === 0 && operation.dy === 0;
  const isResizeNoop = operation.kind === "resize" && operation.delta === 0;
  if (isMoveNoop || isResizeNoop) {
    const working = cloneBlocks(blocks);
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

  // Open an ephemeral session. The session owns its own working copy and
  // forwards step.start / step.end / block.* events to the same emitter.
  const session = createEngineSession(blocks, {
    ...options,
    opId,
    operationOptions: operation.options,
  });

  // Aggregated result accumulators.
  const moved = new Set<string>();
  const shrunk = new Map<string, { w: number; h: number }>();
  const wrapped = new Set<string>();
  let appliedDx = 0;
  let appliedDy = 0;
  let appliedDelta = 0;
  let anyAccepted = false;
  let rejectionReason: string | undefined;

  if (operation.kind === "move") {
    // Dominant-axis greedy decomposition (see EngineSession.moveTo).
    // Stops at the first rejected step but keeps the accepted progress.
    const primaryPos = primary.position;
    const outcome = session.moveTo({
      blockId: operation.blockId,
      x: primaryPos.x + operation.dx,
      y: primaryPos.y + operation.dy,
    });
    anyAccepted = outcome.stepsApplied > 0;
    if (!outcome.reachedTarget && outcome.stepsApplied < Math.abs(operation.dx) + Math.abs(operation.dy)) {
      rejectionReason = "step-rejected";
    }
    // Recompute applied dx/dy from final position vs starting position.
    const finalPrimary = session
      .getCurrentBlocks()
      .find((b) => b.id === operation.blockId)!;
    appliedDx = finalPrimary.position.x - primaryPos.x;
    appliedDy = finalPrimary.position.y - primaryPos.y;
    for (const id of outcome.affected.moved) moved.add(id);
    for (const [id, size] of outcome.affected.shrunk) shrunk.set(id, size);
    for (const id of outcome.affected.wrapped) wrapped.add(id);
  } else {
    // Resize: one unit step per |delta|, stop on first rejection.
    const resizeDir: "grow" | "shrink" = operation.delta < 0 ? "shrink" : "grow";
    const totalSteps = Math.abs(operation.delta);
    for (let i = 0; i < totalSteps; i++) {
      const stepResult = session.resize({
        blockId: operation.blockId,
        edge: operation.edge,
        direction: resizeDir,
      });
      if (!stepResult.accepted) {
        /* c8 ignore next -- defensive: every step rejection carries a reason */
        rejectionReason = stepResult.reason ?? "step-rejected";
        break;
      }
      anyAccepted = true;
      for (const id of stepResult.affected.moved) moved.add(id);
      for (const [id, size] of stepResult.affected.shrunk) {
        if (!shrunk.has(id)) shrunk.set(id, size);
      }
      for (const id of stepResult.affected.wrapped) wrapped.add(id);
      appliedDelta += resizeDir === "grow" ? 1 : -1;
    }
  }

  const final = session.commit();
  emit({ type: "session.end", opId, accepted: anyAccepted, final: cloneBlocks(final) });

  const result: OperationResult = {
    blocks: final,
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
