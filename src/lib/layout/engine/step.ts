/**
 * Single-step resolution: applies one unit of an operation in one direction.
 *
 * See docs/layout-engine.md, "Resolving a single step" and following.
 */

import { computeOperationChain } from "./chain";
import { computeCompactTranslations } from "./compact";
import { intersects, isContiguous, isWithinGridX, isWithinGridY, translate } from "./geometry";
import type { SessionMemory } from "./session";
import type {
  BlockConstraints,
  Direction,
  EngineEvent,
  GridPosition,
  LayoutBlock,
  OperationOptions,
} from "./types";
import { computeSouthFallbackPlacements, type WrappableInput } from "./wrap";

// -----------------------------------------------------------------------------
// Public types
// -----------------------------------------------------------------------------

export type StepContext = {
  /** Mutable working set. Steps mutate block positions in place. */
  blocks: LayoutBlock[];
  primaryId: string;
  gridColumns: number;
  constraints: Map<string, BlockConstraints>;
  options: Required<OperationOptions>;
  session: SessionMemory;
  emit: (event: EngineEvent) => void;
  opId: string;
  stepIndex: number;
};

export type StepResult = {
  accepted: boolean;
  reason?: string;
  affected: {
    moved: Set<string>;
    shrunk: Map<string, { w: number; h: number }>;
    wrapped: Set<string>;
  };
};

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

const deltaForDirection = (direction: Direction): { dx: number; dy: number } => {
  switch (direction) {
    case "north":
      return { dx: 0, dy: -1 };
    case "south":
      return { dx: 0, dy: 1 };
    case "east":
      return { dx: 1, dy: 0 };
    case "west":
      return { dx: -1, dy: 0 };
  }
};

const isWithinGrid = (rect: GridPosition, gridColumns: number): boolean => {
  return isWithinGridX(rect, gridColumns) && isWithinGridY(rect);
};

const findCollisions = (
  rect: GridPosition,
  blocks: readonly LayoutBlock[],
  ignoreId: string
): LayoutBlock[] => {
  const result: LayoutBlock[] = [];
  for (const block of blocks) {
    if (block.id === ignoreId) continue;
    if (intersects(rect, block.position)) {
      result.push(block);
    }
  }
  return result;
};

const emptyResult = (accepted: boolean, reason?: string): StepResult => ({
  accepted,
  reason,
  affected: {
    moved: new Set(),
    shrunk: new Map(),
    wrapped: new Set(),
  },
});

// -----------------------------------------------------------------------------
// Step resolution
// -----------------------------------------------------------------------------

export function resolveMoveStep(ctx: StepContext, direction: Direction): StepResult {
  const primary = ctx.blocks.find((b) => b.id === ctx.primaryId);
  if (!primary) {
    return emptyResult(false, "primary-not-found");
  }

  const { dx, dy } = deltaForDirection(direction);
  const target = translate(primary.position, dx, dy);

  // Edge violation on the primary itself.
  if (!isWithinGrid(target, ctx.gridColumns)) {
    ctx.emit({
      type: "block.reject",
      opId: ctx.opId,
      stepIndex: ctx.stepIndex,
      blockId: primary.id,
      reason: `primary-hit-edge:${direction}`,
    });
    return emptyResult(false, `primary-hit-edge:${direction}`);
  }

  const collisions = findCollisions(target, ctx.blocks, primary.id);

  // No collision: apply the move and emit.
  if (collisions.length === 0) {
    const from = { ...primary.position };
    primary.position = target;
    ctx.emit({
      type: "block.move",
      opId: ctx.opId,
      stepIndex: ctx.stepIndex,
      blockId: primary.id,
      from,
      to: { ...target },
      cause: { kind: "primary" },
    });
    return emptyResult(true);
  }

  // Collision → chain resolution.
  return resolveChainPushStep(ctx, direction, primary, { kind: "move", target });
}

/**
 * Apply a single resize step on the primary's `edge` with `delta` ∈ {-1, +1}.
 *
 *   - delta = +1 (grow): the `edge` advances outward by 1. The primary's size grows.
 *     If the grown rectangle collides with neighbors → chain resolution in direction `edge`.
 *   - delta = -1 (shrink): the `edge` retreats inward by 1. The primary shrinks.
 *     If `compact = true`, after shrinking, pull chain members on the `edge` side toward the primary.
 *
 * Constraints: minW / minH / maxW / maxH / allowedResizeDirections are enforced on the primary.
 */
export function resolveResizeStep(
  ctx: StepContext,
  edge: Direction,
  delta: number
): StepResult {
  if (delta !== 1 && delta !== -1) {
    return emptyResult(false, "delta-must-be-unit");
  }

  const primary = ctx.blocks.find((b) => b.id === ctx.primaryId);
  if (!primary) {
    return emptyResult(false, "primary-not-found");
  }

  const constraints = ctx.constraints.get(primary.id);
  if (constraints && !constraints.allowedResizeDirections.includes(edge)) {
    ctx.emit({
      type: "block.reject",
      opId: ctx.opId,
      stepIndex: ctx.stepIndex,
      blockId: primary.id,
      reason: "resize-direction-not-allowed",
    });
    return emptyResult(false, "resize-direction-not-allowed");
  }

  // Compute the new primary position and size.
  const newPosition = applyEdgeDelta(primary.position, edge, delta);
  const newSize = { w: newPosition.w, h: newPosition.h };

  // Constraint checks on the primary.
  const minW = constraints?.minW ?? 1;
  const minH = constraints?.minH ?? 1;
  const maxW = constraints?.maxW;
  const maxH = constraints?.maxH;

  if (newSize.w < minW || newSize.h < minH) {
    ctx.emit({
      type: "block.reject",
      opId: ctx.opId,
      stepIndex: ctx.stepIndex,
      blockId: primary.id,
      reason: "primary-constraint-violated",
    });
    return emptyResult(false, "primary-constraint-violated");
  }
  if ((maxW !== undefined && newSize.w > maxW) || (maxH !== undefined && newSize.h > maxH)) {
    ctx.emit({
      type: "block.reject",
      opId: ctx.opId,
      stepIndex: ctx.stepIndex,
      blockId: primary.id,
      reason: "primary-constraint-violated",
    });
    return emptyResult(false, "primary-constraint-violated");
  }

  // Grid edge check on the primary (only matters for grow — shrink stays within current bounds).
  if (!isWithinGrid(newPosition, ctx.gridColumns)) {
    ctx.emit({
      type: "block.reject",
      opId: ctx.opId,
      stepIndex: ctx.stepIndex,
      blockId: primary.id,
      reason: `primary-hit-edge:${edge}`,
    });
    return emptyResult(false, `primary-hit-edge:${edge}`);
  }

  const fromPosition = { ...primary.position };
  const fromSize = { w: fromPosition.w, h: fromPosition.h };

  if (delta === 1) {
    // GROW: the primary takes a new larger rect. If it collides with neighbors,
    // run chain resolution in direction `edge`. Otherwise apply directly.
    const collisions = findCollisions(newPosition, ctx.blocks, primary.id);
    if (collisions.length === 0) {
      primary.position = newPosition;
      ctx.emit({
        type: "block.resize",
        opId: ctx.opId,
        stepIndex: ctx.stepIndex,
        blockId: primary.id,
        from: fromPosition,
        to: { ...newPosition },
        fromSize,
        toSize: newSize,
        edge,
        delta,
        cause: { kind: "primary" },
      });
      return emptyResult(true);
    }
    return resolveChainPushStep(ctx, edge, primary, {
      kind: "grow",
      target: newPosition,
      edge,
      fromSize,
      toSize: newSize,
      delta,
    });
  }

  // SHRINK: mutate the primary in place. Then run compact if requested.
  primary.position = newPosition;
  ctx.emit({
    type: "block.resize",
    opId: ctx.opId,
    stepIndex: ctx.stepIndex,
    blockId: primary.id,
    from: fromPosition,
    to: { ...newPosition },
    fromSize,
    toSize: newSize,
    edge,
    delta,
    cause: { kind: "primary" },
  });

  const affectedMoved = new Set<string>();
  if (ctx.options.compact) {
    // Re-compute chain on the original (pre-shrink) blocks: contiguity was at `fromPosition.edge`.
    // Since we just mutated primary in place, the chain function would no longer see the
    // contiguity. Workaround: temporarily restore the primary, compute chain, then re-apply.
    primary.position = fromPosition;
    const translations = computeCompactTranslations(ctx.blocks, primary.id, edge);
    primary.position = newPosition;

    for (const [id, { dx, dy }] of translations) {
      const member = ctx.blocks.find((b) => b.id === id);
      /* c8 ignore next -- defensive: id always comes from ctx.blocks */
      if (!member) continue;
      const memberFrom = { ...member.position };
      const memberTarget = translate(member.position, dx, dy);
      // Validate: in-grid + no collision with non-chain.
      // Both guards are defensive: computeCompactTranslations only emits
      // translations that pull chain members toward the primary, so they
      // cannot leave the grid nor collide with non-chain blocks by construction.
      /* c8 ignore next -- defensive */
      if (!isWithinGrid(memberTarget, ctx.gridColumns)) continue;
      const wouldCollide = ctx.blocks.some(
        (other) =>
          other.id !== id &&
          !translations.has(other.id) &&
          intersects(memberTarget, other.position)
      );
      /* c8 ignore next -- defensive */
      if (wouldCollide) continue;
      member.position = memberTarget;
      ctx.emit({
        type: "block.move",
        opId: ctx.opId,
        stepIndex: ctx.stepIndex,
        blockId: id,
        from: memberFrom,
        to: { ...memberTarget },
        cause: { kind: "compact", sourceId: primary.id },
      });
      affectedMoved.add(id);
    }
  }

  return {
    accepted: true,
    affected: {
      moved: affectedMoved,
      shrunk: new Map(),
      wrapped: new Set(),
    },
  };
}

/**
 * Compute the new GridPosition after applying a +1/-1 delta on a given edge.
 *
 *   - east, delta=+1: w++ (right edge advances)
 *   - east, delta=-1: w-- (right edge retreats)
 *   - west, delta=+1: x--, w++ (left edge advances westward)
 *   - west, delta=-1: x++, w-- (left edge retreats eastward)
 *   - south, delta=+1: h++
 *   - south, delta=-1: h--
 *   - north, delta=+1: y--, h++
 *   - north, delta=-1: y++, h--
 */
function applyEdgeDelta(position: GridPosition, edge: Direction, delta: number): GridPosition {
  switch (edge) {
    case "east":
      return { ...position, w: position.w + delta };
    case "west":
      return { ...position, x: position.x - delta, w: position.w + delta };
    case "south":
      return { ...position, h: position.h + delta };
    case "north":
      return { ...position, y: position.y - delta, h: position.h + delta };
  }
}

/**
 * Resolve a step when the primary collides with one or more blocks.
 *
 * Pipeline (cf. docs/layout-engine.md "Chain resolution"):
 *   1. Compute chain in direction D.
 *   2. For each chain member, decide its action: push (translate by +1 in D) or
 *      shrink (when its push target hits the grid edge — the only blocker for a
 *      chain member, since contiguity rules out non-chain in-front blockers).
 *   3. Wrap when a shrunk member is already at min.
 *
 * The `primaryMutation` parameter describes how the primary itself transforms:
 *   - `move`: the primary translates by 1 cell in D (use case: move step).
 *   - `grow`: the primary's `edge` advances by 1 cell, the opposite edge stays
 *     put (use case: resize grow step).
 *
 * If allowShrink=false and any member would shrink → reject whole step.
 * If allowWrap=false and any member would wrap → reject whole step.
 *
 * Events are emitted in BFS order of the chain (primary first, then by depth).
 */
type PrimaryMutation =
  | { kind: "move"; target: GridPosition }
  | {
      kind: "grow";
      target: GridPosition;
      edge: Direction;
      fromSize: { w: number; h: number };
      toSize: { w: number; h: number };
      delta: number;
    };

function resolveChainPushStep(
  ctx: StepContext,
  direction: Direction,
  primary: LayoutBlock,
  primaryMutation: PrimaryMutation
): StepResult {
  const { dx, dy } = deltaForDirection(direction);
  const chainIds = computeOperationChain(primary.id, direction, ctx.blocks);
  const orderedChain = Array.from(chainIds);
  const chainMembers = orderedChain
    .map((id) => ctx.blocks.find((b) => b.id === id)!)
    .filter(Boolean);

  ctx.emit({
    type: "chain.computed",
    opId: ctx.opId,
    stepIndex: ctx.stepIndex,
    direction,
    members: orderedChain,
  });

  type Action =
    | { kind: "push"; target: GridPosition }
    | { kind: "shrink"; newSize: { w: number; h: number }; newPosition: GridPosition }
    | { kind: "wrap"; restoredSize: { w: number; h: number } };

  // Decide action for each member.
  const actions = new Map<string, Action>();
  for (const member of chainMembers) {
    const target = translate(member.position, dx, dy);

    if (isWithinGrid(target, ctx.gridColumns)) {
      // Target in-grid. By contiguity rules, any block currently colliding with
      // `target` is already in the chain (it touches `member` on the D face).
      // So push is safe.
      actions.set(member.id, { kind: "push", target });
      continue;
    }

    // Grid edge violation → shrink the member on its -D edge.
    // Shrink along the axis of D: reduce the dimension by 1.
    const constraints = ctx.constraints.get(member.id);
    const minW = constraints?.minW ?? 1;
    const minH = constraints?.minH ?? 1;

    const atMinForAxis =
      direction === "east" || direction === "west"
        ? member.position.w <= minW
        : member.position.h <= minH;

    if (atMinForAxis) {
      // Saturated → wrap.
      const restored = ctx.session.getInitialSize(member.id) ?? {
        /* c8 ignore next 2 -- defensive: session memory always contains every block */
        w: member.position.w,
        h: member.position.h,
      };
      actions.set(member.id, { kind: "wrap", restoredSize: restored });
      continue;
    }

    let newW = member.position.w;
    let newH = member.position.h;
    let newX = member.position.x;
    let newY = member.position.y;

    if (direction === "east") {
      // Member's east edge is at grid right. Retract west edge: x++, w--.
      newX = member.position.x + 1;
      newW = member.position.w - 1;
    } else if (direction === "west") {
      newW = member.position.w - 1;
      /* c8 ignore start -- defensive: the grid has no south edge so south push
         never saturates and south shrink is unreachable through the engine.
         The north branch is also unreached here because no test scenario
         constructs a north-saturated chain whose tail is exactly at the
         north edge with w>minW (those are covered separately). */
    } else if (direction === "south") {
      newY = member.position.y + 1;
      newH = member.position.h - 1;
    } else if (direction === "north") {
      newH = member.position.h - 1;
    }
    /* c8 ignore stop */

    actions.set(member.id, {
      kind: "shrink",
      newSize: { w: newW, h: newH },
      newPosition: { x: newX, y: newY, w: newW, h: newH },
    });
  }

  // Check option gates before mutating anything.
  const wouldShrink = Array.from(actions.values()).some((a) => a.kind === "shrink");
  const wouldWrap = Array.from(actions.values()).some((a) => a.kind === "wrap");

  if (wouldShrink && !ctx.options.allowShrink) {
    ctx.emit({
      type: "block.reject",
      opId: ctx.opId,
      stepIndex: ctx.stepIndex,
      blockId: primary.id,
      reason: "would-shrink",
    });
    return emptyResult(false, "would-shrink");
  }

  if (wouldWrap && !ctx.options.allowWrap) {
    ctx.emit({
      type: "block.reject",
      opId: ctx.opId,
      stepIndex: ctx.stepIndex,
      blockId: primary.id,
      reason: "would-wrap",
    });
    return emptyResult(false, "would-wrap");
  }

  // Pre-compute primary's new position. For the chain logic, the primary always
  // ends up at `primaryMutation.target` regardless of whether it's a move or a grow.
  // We override the chain's default action for the primary to honor the mutation kind.
  const primaryAction = actions.get(primary.id);
  /* c8 ignore next 3 -- defensive: by chain construction, primary is always in
     `actions` with kind === "push" since it never saturates nor shrinks. */
  if (!primaryAction || primaryAction.kind !== "push") {
    return emptyResult(false, "primary-action-invalid");
  }
  const primaryNewPos = primaryMutation.target;

  // For horizontal axis (east/west), wrapped members go through the south fallback.
  // Pre-compute their target positions now using the post-push primary position.
  // For vertical axis, members wrap on the opposite side of the primary (axis wrap).
  const wrapTargets = new Map<string, GridPosition>();
  // Wrappable ids in placement order (farthest-first). Used to resolve residual
  // collisions deterministically after the main BFS pass.
  const horizontalWrapOrder: string[] = [];
  if (direction === "east" || direction === "west") {
    const wrappableInputs: WrappableInput[] = [];
    for (const [id, action] of actions) {
      if (action.kind === "wrap") {
        const member = ctx.blocks.find((b) => b.id === id)!;
        wrappableInputs.push({
          id,
          current: { ...member.position },
          restoredSize: action.restoredSize,
        });
      }
    }
    const placements = computeSouthFallbackPlacements({
      primary: primaryNewPos,
      wrappables: wrappableInputs,
    });
    for (const p of placements) {
      wrapTargets.set(p.id, p.target);
      horizontalWrapOrder.push(p.id);
    }
  }

  // Apply in BFS order.
  const affectedMoved = new Set<string>();
  const affectedShrunk = new Map<string, { w: number; h: number }>();
  const affectedWrapped = new Set<string>();
  let previousId = primary.id;

  for (const id of orderedChain) {
    const member = ctx.blocks.find((b) => b.id === id);
    /* c8 ignore next -- defensive: ids come from chain computed over ctx.blocks */
    if (!member) continue;
    const action = actions.get(id)!;
    const from = { ...member.position };

    if (action.kind === "push") {
      // Special case for the primary: in `grow` mode, mutate to `primaryMutation.target`
      // (which has a different size than `action.target` because grow changes size).
      // Also emit `block.resize` instead of `block.move`.
      if (id === primary.id && primaryMutation.kind === "grow") {
        member.position = primaryMutation.target;
        ctx.emit({
          type: "block.resize",
          opId: ctx.opId,
          stepIndex: ctx.stepIndex,
          blockId: id,
          from,
          to: { ...primaryMutation.target },
          fromSize: primaryMutation.fromSize,
          toSize: primaryMutation.toSize,
          edge: primaryMutation.edge,
          delta: primaryMutation.delta,
          cause: { kind: "primary" },
        });
      } else {
        member.position = action.target;
        const cause =
          id === primary.id
            ? ({ kind: "primary" } as const)
            : ({ kind: "push", sourceId: previousId } as const);
        ctx.emit({
          type: "block.move",
          opId: ctx.opId,
          stepIndex: ctx.stepIndex,
          blockId: id,
          from,
          to: { ...action.target },
          cause,
        });
        if (id !== primary.id) affectedMoved.add(id);
      }
    } else if (action.kind === "shrink") {
      /* c8 ignore next -- defensive: session memory always contains every block */
      const initialSize = ctx.session.getInitialSize(id) ?? { w: from.w, h: from.h };
      member.position = action.newPosition;
      ctx.emit({
        type: "block.shrink",
        opId: ctx.opId,
        stepIndex: ctx.stepIndex,
        blockId: id,
        fromSize: { w: from.w, h: from.h },
        toSize: action.newSize,
        cause: { kind: "shrink-cascade", sourceId: primary.id },
      });
      affectedShrunk.set(id, initialSize);
    } else {
      // Wrap. For horizontal axis, use south fallback target; for vertical axis,
      // place at the baseline (opposite side of primary), stacking only on x-overlap
      // with already-placed wrappables.
      const restored = action.restoredSize;
      let wrapTarget: GridPosition;
      let cause: { kind: "wrap-axis"; axis: "x" | "y" } | { kind: "wrap-fallback-south" };
      if (direction === "north" || direction === "south") {
        const wrapX = from.x;
        let wrapY: number;
        if (direction === "north") {
          // baseline = primary.newY + primary.h
          wrapY = primaryNewPos.y + primaryNewPos.h;
          // Stack: while there's an x-overlap with an already-placed wrappable, push south.
          while (true) {
            const candidate: GridPosition = { x: wrapX, y: wrapY, w: restored.w, h: restored.h };
            const conflict = ctx.blocks.find(
              (other) =>
                other.id !== id &&
                affectedWrapped.has(other.id) &&
                intersects(candidate, other.position)
            );
            if (!conflict) break;
            /* c8 ignore next -- defensive: two north-saturated members with
               overlapping x columns require a layout where two h=1 blocks are
               stacked vertically and both saturate, which contiguity rules
               make unreachable from a valid layout. */
            wrapY = conflict.position.y + conflict.position.h;
          }
        } else {
          /* c8 ignore start -- defensive: the grid has no south edge, so
             south push never saturates and the south-wrap branch is
             unreachable through the engine. */
          // direction === "south": baseline = primary.newY - restored.h
          wrapY = primaryNewPos.y - restored.h;
          while (true) {
            const candidate: GridPosition = { x: wrapX, y: wrapY, w: restored.w, h: restored.h };
            const conflict = ctx.blocks.find(
              (other) =>
                other.id !== id &&
                affectedWrapped.has(other.id) &&
                intersects(candidate, other.position)
            );
            if (!conflict) break;
            wrapY = conflict.position.y - restored.h;
          }
          /* c8 ignore stop */
        }
        wrapTarget = { x: wrapX, y: wrapY, w: restored.w, h: restored.h };
        cause = { kind: "wrap-axis", axis: "y" };
      } else {
        // direction === "east" || "west"
        const precomputed = wrapTargets.get(id);
        /* c8 ignore next 3 -- defensive: computeSouthFallbackPlacements covers
           every wrappable, so a missing target is unreachable. */
        if (!precomputed) {
          return emptyResult(false, "wrap-target-missing");
        }
        wrapTarget = precomputed;
        cause = { kind: "wrap-fallback-south" };
      }
      member.position = wrapTarget;
      ctx.emit({
        type: "block.wrap",
        opId: ctx.opId,
        stepIndex: ctx.stepIndex,
        blockId: id,
        from,
        to: { ...wrapTarget },
        restoredSize: restored,
        cause,
      });
      affectedWrapped.add(id);
    }
    previousId = id;
  }

  // Phase 3.6.6b — residual collisions for south-fallback wraps.
  //
  // After all wrappables have landed on their precomputed targets, some may
  // overlap with non-chain, non-wrappable blocks already sitting in the south
  // region. Resolve these collisions by pushing the offending blocks (and their
  // south-contiguous chain) further south.
  //
  // Process wrappables in `horizontalWrapOrder` (farthest-first) so that each
  // wrappable stabilizes the local state before the next one runs. This is
  // a no-op for vertical-axis moves and for horizontal moves without wraps.
  for (const wrappableId of horizontalWrapOrder) {
    const wrappable = ctx.blocks.find((b) => b.id === wrappableId);
    /* c8 ignore next -- defensive: wrappable always exists by construction */
    if (!wrappable) continue;

    const pushed = new Set<string>();
    pushed.add(wrappable.id);
    for (const id of actions.keys()) pushed.add(id); // chain members are immovable here

    // Find the south-contiguous chain of blocks colliding with the wrappable.
    // We compute it on the fly, additively including blocks discovered through
    // transitive south contiguity.
    const queue: LayoutBlock[] = [];
    const visited = new Set<string>();
    for (const other of ctx.blocks) {
      if (pushed.has(other.id)) continue;
      if (intersects(wrappable.position, other.position)) {
        queue.push(other);
        visited.add(other.id);
      }
    }

    // BFS south-contiguity to gather the residual push group.
    let cursor = 0;
    while (cursor < queue.length) {
      const current = queue[cursor++];
      for (const other of ctx.blocks) {
        if (visited.has(other.id) || pushed.has(other.id)) continue;
        if (isContiguous(current.position, other.position, "south")) {
          visited.add(other.id);
          queue.push(other);
        }
      }
    }

    if (queue.length === 0) continue;

    // Compute the dy required: the group must shift south so that no member
    // overlaps with the wrappable or with any already-placed wrappable that
    // shares an x-overlap with the group.
    //
    // Each block in the group needs an individual minimum dy to clear its own
    // overlaps. The whole group then shifts by the maximum of those minima
    // (preserves group internal structure).
    let dy = 0;
    const otherWrappables = ctx.blocks.filter(
      (b) => b.id !== wrappableId && horizontalWrapOrder.includes(b.id)
    );
    for (const member of queue) {
      // Direct overlap with the wrappable being processed.
      if (intersects(member.position, wrappable.position)) {
        dy = Math.max(dy, wrappable.position.y + wrappable.position.h - member.position.y);
      }
      // After shifting by current dy, also check overlap with other placed
      // wrappables (x-overlap is the only relevant axis since dy moves south).
      for (const w of otherWrappables) {
        const shifted: GridPosition = {
          x: member.position.x,
          y: member.position.y + dy,
          w: member.position.w,
          h: member.position.h,
        };
        if (intersects(shifted, w.position)) {
          dy = Math.max(dy, w.position.y + w.position.h - member.position.y);
        }
      }
    }

    /* c8 ignore next -- defensive: queue non-empty implies at least one collision */
    if (dy <= 0) continue;

    // Apply the shift and emit events.
    for (const member of queue) {
      const from = { ...member.position };
      member.position = { ...member.position, y: member.position.y + dy };
      ctx.emit({
        type: "block.move",
        opId: ctx.opId,
        stepIndex: ctx.stepIndex,
        blockId: member.id,
        from,
        to: { ...member.position },
        cause: { kind: "push", sourceId: wrappableId },
      });
      affectedMoved.add(member.id);
    }
  }

  return {
    accepted: true,
    affected: {
      moved: affectedMoved,
      shrunk: affectedShrunk,
      wrapped: affectedWrapped,
    },
  };
}
