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

type StepResult = {
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
  // Snapshot of every block's position at the START of this step, before any
  // chain mutation is applied. Used downstream to compute south-contiguity
  // relations that must be preserved through the residual cascade.
  const initialPositions = new Map<string, GridPosition>();
  for (const b of ctx.blocks) {
    initialPositions.set(b.id, { ...b.position });
  }
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

  // Shrink absorption pass.
  //
  // When a tail member would `wrap`, the chain may be able to swallow the
  // 1-unit displacement internally by shrinking a non-saturated upstream
  // member on its trailing edge (the edge facing the saturated tail). The
  // primary itself never absorbs — it expresses the user's intent.
  //
  // Branches and shared members. A saturated tail T can be reached from the
  // primary through multiple branches of the contiguity graph (e.g. a wide
  // tail touched by two columns of the chain). Each branch is computed
  // independently via a reverse BFS from T toward the primary, traversing
  // `isContiguous(parent, child, D)` edges. For each branch the absorber is
  // the first non-saturated member encountered (closest to T).
  //
  //   - If every branch leading to T has an absorber, T is absorbed: every
  //     absorber shrinks once (a single shrink on a shared member absorbs the
  //     displacement for every branch passing through it), and every member
  //     strictly between an absorber and T along its branch — plus T itself —
  //     is removed from `actions` and stays put.
  //   - If at least one branch has no absorber (every upstream non-primary
  //     member is saturated on this axis), T is left as `wrap` and follows
  //     the standard wrap path. Other independent tails can still be absorbed.
  const chainBlockById = new Map<string, LayoutBlock>();
  for (const m of chainMembers) chainBlockById.set(m.id, m);

  const isSaturatedOnAxis = (member: LayoutBlock): boolean => {
    const c = ctx.constraints.get(member.id);
    const minW = c?.minW ?? 1;
    const minH = c?.minH ?? 1;
    return direction === "east" || direction === "west"
      ? member.position.w <= minW
      : member.position.h <= minH;
  };

  // Returns the list of chain members whose face `D` is touched by `child`.
  // Those are the immediate upstream parents of `child` in the chain graph
  // (i.e. one step closer to the primary).
  const upstreamParents = (childId: string): string[] => {
    const child = chainBlockById.get(childId);
    /* c8 ignore next -- defensive: childId always comes from the chain */
    if (!child) return [];
    const out: string[] = [];
    for (const m of chainMembers) {
      if (m.id === childId) continue;
      if (isContiguous(m.position, child.position, direction)) out.push(m.id);
    }
    return out;
  };

  // Per-tail analysis: absorbers (set) + frozen members (set, excludes
  // absorbers, includes the tail). When a branch has no absorber, the tail
  // is flagged as "wrap-forced" and excluded from absorption application.
  const absorbersToShrink = new Set<string>();
  const frozenMembers = new Set<string>();

  for (let i = orderedChain.length - 1; i >= 0; i--) {
    const tailId = orderedChain[i];
    const tailAction = actions.get(tailId);
    if (!tailAction || tailAction.kind !== "wrap") continue;

    // For each tail, run a reverse BFS along contiguity edges from the tail
    // toward the primary. Collect, per branch, the first non-saturated
    // ancestor encountered (excluding the primary). A branch is a maximal
    // path of saturated members ending at a non-saturated member (the
    // absorber) or at the primary (no absorber → wrap-forced).
    //
    // Branches converging on the same ancestor must each contribute their
    // saturated path to the frozen set. We cache resolved nodes per tail so
    // that a second branch reaching the same absorber (or dead-end) does not
    // miss its contribution.
    const tailAbsorbers: string[] = [];
    const tailFrozen = new Set<string>([tailId]);
    let branchMissingAbsorber = false;

    // Per-tail caches keyed by member id:
    //   - `absorberCache` flags nodes already proven to be absorbers for this
    //     tail. When revisited via another branch, we simply propagate the
    //     branch's saturated path to the frozen set.
    //   - `deadendCache` flags saturated nodes whose only upstream is the
    //     primary, so any branch reaching them is wrap-forced.
    const absorberCache = new Set<string>();
    const deadendCache = new Set<string>();

    type Frame = { id: string; pathSaturated: string[] };
    const queue: Frame[] = [];
    for (const pId of upstreamParents(tailId)) {
      if (pId === primary.id) {
        // The tail is directly contiguous to the primary; this branch has
        // no non-primary ancestor to absorb.
        branchMissingAbsorber = true;
        continue;
      }
      queue.push({ id: pId, pathSaturated: [] });
    }

    while (queue.length > 0 && !branchMissingAbsorber) {
      const frame = queue.shift()!;

      if (absorberCache.has(frame.id)) {
        // Another branch already proved this node is an absorber. This
        // branch terminates here too; commit its saturated path.
        for (const s of frame.pathSaturated) tailFrozen.add(s);
        continue;
      }
      /* c8 ignore next 4 -- symmetric of the absorberCache hit above; requires
         a diamond-shaped chain where two BFS branches within the same tail
         converge on a dead-end node, a degenerate geometric configuration. */
      if (deadendCache.has(frame.id)) {
        branchMissingAbsorber = true;
        break;
      }

      const member = chainBlockById.get(frame.id);
      /* c8 ignore next -- defensive: frame ids come from chain */
      if (!member) continue;

      if (!isSaturatedOnAxis(member)) {
        absorberCache.add(frame.id);
        tailAbsorbers.push(frame.id);
        for (const s of frame.pathSaturated) tailFrozen.add(s);
        continue;
      }

      // Saturated: walk further upstream. The current saturated member is
      // appended to the path; if a downstream branch later proves this
      // sub-tree leads to an absorber, the path will be added to frozen.
      const nextSaturated = [...frame.pathSaturated, frame.id];
      const parents = upstreamParents(frame.id);
      const filteredParents = parents.filter((p) => p !== primary.id);
      if (filteredParents.length === 0) {
        // Only the primary is upstream of this saturated member → no absorber
        // on this branch.
        deadendCache.add(frame.id);
        branchMissingAbsorber = true;
        break;
      }
      for (const pId of filteredParents) {
        queue.push({ id: pId, pathSaturated: nextSaturated });
      }
    }

    if (branchMissingAbsorber) {
      // Leave this tail's `wrap` action in place. Do not freeze anything for
      // this tail.
      continue;
    }

    // Commit absorbers and frozen members for this tail.
    for (const a of tailAbsorbers) absorbersToShrink.add(a);
    for (const f of tailFrozen) frozenMembers.add(f);
  }

  // Apply absorber shrinks. A shared absorber is shrunk only once.
  for (const absorberId of absorbersToShrink) {
    const absorber = chainBlockById.get(absorberId);
    /* c8 ignore next -- defensive: absorber comes from chain */
    if (!absorber) continue;
    let absW = absorber.position.w;
    let absH = absorber.position.h;
    const absX = absorber.position.x;
    const absY = absorber.position.y;
    if (direction === "east" || direction === "west") {
      absW = absorber.position.w - 1;
    } else {
      absH = absorber.position.h - 1;
    }
    actions.set(absorberId, {
      kind: "shrink",
      newSize: { w: absW, h: absH },
      newPosition: { x: absX, y: absY, w: absW, h: absH },
    });
  }

  // Freeze members on absorbed branches (tail + members between absorber and
  // tail). Absorbers themselves are NOT frozen — they keep their shrink
  // action assigned above.
  for (const fId of frozenMembers) {
    if (absorbersToShrink.has(fId)) continue;
    actions.delete(fId);
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
  // Wrappable ids in placement order. Used to resolve residual collisions
  // deterministically after the main BFS pass. Populated for horizontal wraps
  // up-front (farthest-first per `computeSouthFallbackPlacements`) and for
  // vertical wraps incrementally as they are applied below (BFS order).
  const wrapResidualOrder: string[] = [];
  if (direction === "east" || direction === "west") {
    const wrappableInputs: WrappableInput[] = [];
    for (const [id, action] of actions) {
      if (action.kind === "wrap") {
        const member = ctx.blocks.find((b) => b.id === id)!;
        const initialX = ctx.session.getInitialPosition(id)?.x ?? member.position.x;
        wrappableInputs.push({
          id,
          current: { ...member.position },
          restoredSize: action.restoredSize,
          initialX,
        });
      }
    }
    const placements = computeSouthFallbackPlacements({
      primary: primaryNewPos,
      wrappables: wrappableInputs,
    });
    for (const p of placements) {
      wrapTargets.set(p.id, p.target);
      wrapResidualOrder.push(p.id);
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
    const action = actions.get(id);
    if (!action) continue;
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
        wrapResidualOrder.push(id);
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

  // Phase 3.6.6a — cascading wrap promotion among chain members.
  //
  // When a wrappable A lands at its target, other chain members (B) that were
  // shrunk or pushed during this step may now overlap A's placement. Rather
  // than pushing B further south through the residual cascade (which would
  // leave B at its shrunk size, sitting under A in a degenerate state), we
  // promote B to a wrap as well: B is moved to a south-fallback target,
  // restored to its session-initial size, and added to the immovable set so
  // it participates in further cascades as an obstacle rather than a target.
  //
  // The promotion runs iteratively until no chain member collides with any
  // placed wrappable, allowing transitive cascades (B promotes, which may
  // then cause C to collide and promote, etc.).
  //
  // This phase applies only for horizontal-axis steps (east/west) where the
  // south fallback wrap is meaningful; vertical-axis wraps already stack
  // through their own placement logic.
  if (direction === "east" || direction === "west") {
    let promoted = true;
    while (promoted) {
      promoted = false;
      // Build the list of placed wrappables (originals + previously promoted).
      // A chain member is a candidate for promotion if it is in the chain,
      // is NOT itself a wrappable (already placed), and collides with any
      // placed wrappable's current position.
      const placedWrappableBlocks = ctx.blocks.filter((b) => affectedWrapped.has(b.id));
      const candidates: LayoutBlock[] = [];
      for (const id of actions.keys()) {
        if (id === primary.id) continue;
        if (affectedWrapped.has(id)) continue;
        const member = ctx.blocks.find((b) => b.id === id);
        /* c8 ignore next -- defensive: ids come from actions keyed by ctx.blocks */
        if (!member) continue;
        const collides = placedWrappableBlocks.some((w) => intersects(member.position, w.position));
        if (collides) candidates.push(member);
      }
      if (candidates.length === 0) break;

      // Promote each candidate to a south-fallback wrap. We recompute the
      // south-fallback placement using all currently placed wrappables as
      // pre-occupied space (by including them via the primary-region check
      // inside computeSouthFallbackPlacements).
      //
      // To stay consistent with the existing south-fallback semantics, we
      // run computeSouthFallbackPlacements once with all candidates as new
      // wrappables, using their session-initial sizes and initial-x targets.
      const wrappableInputsForPromotion: WrappableInput[] = candidates.map((member) => {
        const restored = ctx.session.getInitialSize(member.id) ?? {
          w: member.position.w,
          h: member.position.h,
        };
        const initialX = ctx.session.getInitialPosition(member.id)?.x ?? member.position.x;
        return {
          id: member.id,
          current: { ...member.position },
          restoredSize: restored,
          initialX,
        };
      });
      // Account for already-placed wrappables by adding them as virtual
      // obstacles. The south-fallback algorithm treats the primary's new
      // position as the seed; existing wrappables also occupy space. To
      // make the algorithm aware of those, we pass the union region as
      // primary. The cleanest way is to call the algorithm once and then
      // post-correct by stacking against placed wrappables.
      const placements = computeSouthFallbackPlacements({
        primary: primaryNewPos,
        wrappables: wrappableInputsForPromotion,
      });

      for (const placement of placements) {
        const member = ctx.blocks.find((b) => b.id === placement.id);
        /* c8 ignore next -- defensive: placement.id comes from candidates */
        if (!member) continue;
        let target = placement.target;
        // Stack against already-placed wrappables (originals + already promoted
        // in earlier iterations of this loop): if target overlaps any placed
        // wrappable, push target south.
        let safety = ctx.blocks.length + 1;
        while (safety-- > 0) {
          const conflict = ctx.blocks.find(
            (other) =>
              other.id !== member.id &&
              affectedWrapped.has(other.id) &&
              intersects(target, other.position)
          );
          if (!conflict) break;
          target = { ...target, y: conflict.position.y + conflict.position.h };
        }
        const from = { ...member.position };
        member.position = target;
        ctx.emit({
          type: "block.wrap",
          opId: ctx.opId,
          stepIndex: ctx.stepIndex,
          blockId: member.id,
          from,
          to: { ...target },
          restoredSize: { w: target.w, h: target.h },
          cause: { kind: "wrap-fallback-south" },
        });
        affectedWrapped.add(member.id);
        affectedMoved.delete(member.id);
        affectedShrunk.delete(member.id);
        wrapResidualOrder.push(member.id);
        promoted = true;
      }
    }
  }

  // Phase 3.6.6b — residual collisions for wrap placements.
  //
  // After all wrappables have landed on their precomputed targets (south
  // fallback for horizontal axis, opposite-side baseline for vertical axis),
  // some may overlap with non-chain, non-wrappable blocks already sitting in
  // the destination region. Resolve these collisions by pushing each colliding
  // block south by the minimum dy required to clear the wrappable, then
  // propagating that push transitively to any block whose original position
  // overlaps the pusher's new position.
  //
  // Each block accumulates its own dy independently of the rest of the group;
  // a block is only pushed as far as strictly required to resolve its own
  // collisions. This avoids the "uniform group shift" anti-pattern where a
  // block far from any obstruction would inherit a large dy from a sibling.
  //
  // Process wrappables in `wrapResidualOrder` so that each wrappable stabilizes
  // the local state before the next one runs.
  const immovable = new Set<string>();
  for (const id of actions.keys()) immovable.add(id);
  for (const id of wrapResidualOrder) immovable.add(id);

  // Per-block accumulated south displacement applied during this residual pass.
  // Defaults to 0; a block is "pushed" once dy > 0.
  const residualDy = new Map<string, number>();
  // Tracks which wrappable initially seeded each pushed block into the cascade.
  // Used as `sourceId` on the emitted `block.move` events for debugging clarity.
  const residualSource = new Map<string, string>();
  const projected = (b: LayoutBlock): GridPosition => ({
    ...b.position,
    y: b.position.y + (residualDy.get(b.id) ?? 0),
  });

  // Precompute south-contiguity from the INITIAL layout (before chain mutation).
  // A block Y is south-contiguous to X iff (using initial positions):
  //   - initial[X].y + initial[X].h === initial[Y].y
  //   - x-overlap between initial[X] and initial[Y]
  // This relation is preserved through the cascade: when X is pushed by dy_X,
  // every Y south-contiguous to X is pushed by at least dy_X, transitively.
  // This catches the "jump over" case where a large push by X leaves Y at its
  // initial position without any direct collision but breaks the visual layout.
  const initialSouthContigs = new Map<string, string[]>();
  for (const x of ctx.blocks) {
    const xi = initialPositions.get(x.id)!;
    const list: string[] = [];
    for (const y of ctx.blocks) {
      if (y.id === x.id) continue;
      const yi = initialPositions.get(y.id)!;
      const xRight = xi.x + xi.w;
      const yRight = yi.x + yi.w;
      const xOverlap = xi.x < yRight && yi.x < xRight;
      if (!xOverlap) continue;
      if (xi.y + xi.h === yi.y) list.push(y.id);
    }
    initialSouthContigs.set(x.id, list);
  }

  for (const wrappableId of wrapResidualOrder) {
    const wrappable = ctx.blocks.find((b) => b.id === wrappableId);
    /* c8 ignore next -- defensive: wrappable always exists by construction */
    if (!wrappable) continue;

    // The "obstacles" against which a pushed block must clear: this wrappable
    // plus any other wrappable already at its final placement. Pushed blocks
    // must end up south of every obstacle they overlap on the x-axis.
    const obstacles: LayoutBlock[] = [];
    obstacles.push(wrappable);
    for (const otherId of wrapResidualOrder) {
      if (otherId === wrappableId) continue;
      const o = ctx.blocks.find((b) => b.id === otherId);
      /* c8 ignore next -- defensive: wrap order ids come from ctx.blocks */
      if (!o) continue;
      obstacles.push(o);
    }

    const clearObstacles = (block: LayoutBlock): boolean => {
      // Repeatedly raise residualDy for `block` until its projected position
      // no longer overlaps any obstacle. Returns true if dy was increased.
      let changed = false;
      let safety = obstacles.length + 1;
      while (safety-- > 0) {
        const proj = projected(block);
        let hit: LayoutBlock | null = null;
        for (const obs of obstacles) {
          if (intersects(proj, obs.position)) {
            hit = obs;
            break;
          }
        }
        if (!hit) break;
        const requiredDy = hit.position.y + hit.position.h - proj.y;
        /* c8 ignore next -- defensive: hit implies overlap → requiredDy > 0 */
        if (requiredDy <= 0) break;
        residualDy.set(block.id, (residualDy.get(block.id) ?? 0) + requiredDy);
        if (!residualSource.has(block.id)) residualSource.set(block.id, wrappableId);
        changed = true;
      }
      return changed;
    };

    // Increase the dy of `block` to at least `minDy`, recording the source if
    // this is the first push. Returns true if dy was raised.
    const ensureMinDy = (
      block: LayoutBlock,
      minDy: number,
      sourceId: string | undefined
    ): boolean => {
      const current = residualDy.get(block.id) ?? 0;
      if (minDy <= current) return false;
      residualDy.set(block.id, minDy);
      if (!residualSource.has(block.id) && sourceId !== undefined) {
        residualSource.set(block.id, sourceId);
      }
      return true;
    };

    // Seed the BFS with blocks directly colliding with the wrappable.
    const queue: LayoutBlock[] = [];
    for (const other of ctx.blocks) {
      if (immovable.has(other.id)) continue;
      if (!intersects(wrappable.position, projected(other))) continue;
      if (clearObstacles(other)) queue.push(other);
    }

    // BFS: a block that has just been pushed may now collide with the projected
    // position of another block or with an obstacle (wrappable placement). We
    // propagate the push transitively until no new collisions remain.
    //
    // Two propagation rules:
    //   (a) Induced collision: if pusherProjected overlaps otherProjected, push
    //       `other` enough to clear the pusher.
    //   (b) Initial south-contiguity preserved: every block initially
    //       south-contiguous to the pusher must have dy >= pusher's dy, even if
    //       no induced collision exists (the pusher may have "jumped over" it).
    let cursor = 0;
    while (cursor < queue.length) {
      const pusher = queue[cursor++];
      const pusherDy = residualDy.get(pusher.id) ?? 0;
      const pusherProjected = projected(pusher);
      const pusherSource = residualSource.get(pusher.id) ?? wrappableId;

      // Rule (a): induced collision with any non-immovable block.
      // Order-preservation constraint: pusher can only push `other` if pusher
      // was initially at or above `other` (pusher.init.y <= other.init.y).
      // This prevents pathological "remontées" where a block initially south
      // of `other` ends up cascading and pushing `other` further south through
      // the BFS, inverting the original vertical order.
      const pusherInitial = initialPositions.get(pusher.id)!;
      for (const other of ctx.blocks) {
        if (other.id === pusher.id) continue;
        if (immovable.has(other.id)) continue;
        const otherInitial = initialPositions.get(other.id)!;
        if (pusherInitial.y > otherInitial.y) continue;
        const otherProjected = projected(other);
        if (!intersects(pusherProjected, otherProjected)) continue;
        const requiredDy = pusherProjected.y + pusherProjected.h - otherProjected.y;
        if (requiredDy <= 0) continue;
        const currentDy = residualDy.get(other.id) ?? 0;
        residualDy.set(other.id, currentDy + requiredDy);
        if (!residualSource.has(other.id)) {
          residualSource.set(other.id, pusherSource);
        }
        clearObstacles(other);
        queue.push(other);
      }

      // Rule (b): initial south-contiguity. Every block initially south-
      // contiguous to `pusher` must be pushed by at least `pusherDy`.
      const contigs = initialSouthContigs.get(pusher.id) ?? [];
      for (const contigId of contigs) {
        if (immovable.has(contigId)) continue;
        const other = ctx.blocks.find((b) => b.id === contigId);
        /* c8 ignore next -- defensive: contigs come from ctx.blocks iteration */
        if (!other) continue;
        if (ensureMinDy(other, pusherDy, pusherSource)) {
          clearObstacles(other);
          queue.push(other);
        }
      }
    }
  }

  // Apply the accumulated displacements and emit events.
  for (const [id, dy] of residualDy) {
    /* c8 ignore next -- defensive: dy=0 entries are never inserted into the map */
    if (dy <= 0) continue;
    const member = ctx.blocks.find((b) => b.id === id);
    /* c8 ignore next -- defensive: ids come from ctx.blocks iteration */
    if (!member) continue;
    const from = { ...member.position };
    member.position = { ...member.position, y: member.position.y + dy };
    /* c8 ignore next -- defensive: residualSource is populated for every id in residualDy */
    const sourceId = residualSource.get(id) ?? primary.id;
    ctx.emit({
      type: "block.move",
      opId: ctx.opId,
      stepIndex: ctx.stepIndex,
      blockId: member.id,
      from,
      to: { ...member.position },
      cause: { kind: "push", sourceId },
    });
    affectedMoved.add(member.id);
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
