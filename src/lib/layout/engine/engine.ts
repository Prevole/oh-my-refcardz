/**
 * Engine orchestrator: `applyOperation`.
 *
 * Stateless facade over EngineSession. Decomposes a multi-cell Operation into
 * an ordered sequence of unit steps and feeds them to an ephemeral session.
 *
 * The decomposition for `move` operations is vertical-first (all dy steps
 * before all dx steps). This legacy order is preserved here intentionally;
 * `EngineSession.moveTo` uses a different (dominant-axis-greedy) decomposition
 * that will replace this one in a later step.
 *
 * See docs/layout-engine.md, "Resolution pipeline".
 */

import { createEngineSession } from "./engine-session";
import type {
  Direction,
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

/**
 * Vertical-first decomposition of a (dx, dy) move into unit directions.
 *
 * TODO(step 2): remove this in favor of `EngineSession.moveTo` (dominant-axis
 * greedy), which produces interleaved sequences that avoid transient-only
 * collisions during diagonal moves.
 */
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

  // Build the unit-step program.
  const stepDirections: Direction[] =
    operation.kind === "move"
      ? directionsForMove(operation.dx, operation.dy)
      : Array.from(
          { length: Math.abs(operation.delta) },
          () => operation.edge
        );
  const resizeDir: "grow" | "shrink" =
    operation.kind === "resize" && operation.delta < 0 ? "shrink" : "grow";

  // Aggregated result accumulators.
  const moved = new Set<string>();
  const shrunk = new Map<string, { w: number; h: number }>();
  const wrapped = new Set<string>();
  let appliedDx = 0;
  let appliedDy = 0;
  let appliedDelta = 0;
  let anyAccepted = false;
  let rejectionReason: string | undefined;

  // Run steps in order, aborting on first rejection.
  for (const direction of stepDirections) {
    const stepResult =
      operation.kind === "move"
        ? session.step({ blockId: operation.blockId, direction })
        : session.resize({
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
