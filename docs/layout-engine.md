# Layout Engine

The layout engine resolves user interactions (move, resize) against a 2D grid of blocks, applying collision rules deterministically.

It is **pure logic**: no React, no DOM. It takes an immutable input state plus an operation, and returns a new state plus a journal of events.

This document is the **contract**. Any consumer (mouse drag, keyboard, programmatic test) must respect it.

---

## Vocabulary

| Term | Definition |
|---|---|
| **Block** | A movable, resizable rectangle on the grid. Defined by `id`, `kind`, and `position = {x, y, w, h}`. |
| **Grid** | The shared 2D space. Width is fixed by the `GRID_COLUMNS` constant. Height is unbounded downward. Origin `(0, 0)` is top-left. |
| **Anchor** | The top-left cell of a block, i.e. `(position.x, position.y)`. |
| **Obstacle** | Either a grid edge (west `x=0`, east `x=GRID_COLUMNS`, north `y=0`) or another block. South has no edge. |
| **Collision** | Two blocks overlapping, or a block crossing a grid edge. |
| **Operation** | A user-initiated change: `move` (translate) or `resize` (grow/shrink one edge). |
| **Session** | The lifespan of a continuous interaction (mousedown → mouseup, or single keypress). Used to memoize initial sizes for wrap-restore. |
| **Step** | A unit slice of an operation (1 cell in 1 direction). Operations are decomposed into ordered steps. |
| **Chain** | The set of blocks transitively reachable from the manipulated block by contiguity in a given direction. |
| **Push** | Cascade-translating chain members in the operation's direction. |
| **Shrink** | Reducing a chain member's size along the operation's axis when push is blocked by an obstacle. |
| **Wrap** | Last-resort relocation of a chain member to the opposite side of the manipulated block, with its original size restored. |

---

## Directions and axis priority

```
Direction = "north" | "south" | "east" | "west"
Axis      = "vertical" (north/south) | "horizontal" (east/west)
```

**Priority rule**: when an operation has a non-zero `dx` and `dy`, the **vertical axis is resolved first**. All north/south steps are applied before any east/west step.

Diagonal operations are handled naturally by the step decomposition: see "Diagonal moves" below.

---

## Grid constants

| Constant | Source |
|---|---|
| `GRID_COLUMNS` | `src/components/sheets/sheet-grid.tsx` |
| Min height | 0 (top boundary) |
| Max height | ∞ (no south boundary) |

A block must satisfy `BlockConstraints`:

- `minW`, `minH`: hard floor; the engine never shrinks below.
- `maxW`, `maxH`: optional ceiling.
- `allowedResizeDirections`: which edges can be the target of a resize operation.

Constraints are passed per-block into the engine. They apply to **the manipulated block** (operation rejected if violated) and to **chain members** (shrink stops at min).

---

## Inputs

### Operation

```ts
type Operation =
  | { kind: "move";   blockId: string; dx: number; dy: number; options?: OperationOptions }
  | { kind: "resize"; blockId: string; edge: Direction; delta: number; options?: OperationOptions };
```

- `dx`, `dy` are signed deltas **in grid cells** (not pixels). Mouse drag must convert pixel deltas to cell deltas before invocation.
- `delta` is signed: positive = expand the edge outward, negative = shrink the edge inward.

### OperationOptions

```ts
type OperationOptions = {
  allowWrap?: boolean;    // default: true. When false, the operation is rejected if it requires wrapping a neighbor.
  allowShrink?: boolean;  // default: true. When false, the operation is rejected if it requires shrinking a neighbor.
  compact?: boolean;      // default: false. Resize-shrink only: pull opposite-side neighbors into freed space.
};
```

These flags are the **single abstraction** between input source (mouse/keyboard) and engine. The engine has no knowledge of who set them.

---

## Outputs

### OperationResult

```ts
type OperationResult = {
  blocks: LayoutBlock[];          // new full state
  accepted: boolean;              // did anything change?
  appliedDelta: { dx: number; dy: number } | number;  // what was actually applied
  affected: {
    moved: Set<string>;           // ids of non-manipulated blocks that were pushed
    shrunk: Map<string, GridPosition>;  // ids → their initial size before shrink
    wrapped: Set<string>;         // ids that were wrapped
  };
  rejected?: { reason: string };  // present when accepted = false
};
```

The `shrunk` map carries each shrunken block's size **at the start of the current session**, so the engine can restore it during wrap.

### Engine events

The engine emits typed events for every state transition. Events are the **sole observability channel**.

```ts
type EngineEvent =
  | { type: "session.start"; opId: string; operation: Operation; initial: LayoutBlock[] }
  | { type: "session.end";   opId: string; accepted: boolean; final: LayoutBlock[] }
  | { type: "step.start";    opId: string; stepIndex: number; direction: Direction }
  | { type: "step.end";      opId: string; stepIndex: number; accepted: boolean }
  | { type: "chain.computed";opId: string; stepIndex: number; direction: Direction; members: string[] }
  | { type: "block.move";    opId: string; stepIndex: number; blockId: string; from: GridPosition; to: GridPosition; cause: Cause }
  | { type: "block.shrink";  opId: string; stepIndex: number; blockId: string; fromSize: { w: number; h: number }; toSize: { w: number; h: number }; cause: Cause }
  | { type: "block.wrap";    opId: string; stepIndex: number; blockId: string; from: GridPosition; to: GridPosition; restoredSize: { w: number; h: number }; cause: Cause }
  | { type: "block.reject";  opId: string; stepIndex: number; blockId: string; reason: string };

type Cause =
  | { kind: "primary" }                          // the manipulated block itself
  | { kind: "push"; sourceId: string }           // pushed by another block in the chain
  | { kind: "shrink-cascade"; sourceId: string } // shrunk because pushed by another block
  | { kind: "wrap-fallback-south" }              // wrapped via south fallback
  | { kind: "wrap-axis"; axis: Axis };           // wrapped in main axis
```

A consumer subscribes by providing an `EngineEventEmitter` in engine options. The default is a noop.

---

## Resolution pipeline

For every operation:

1. **Session start**. Snapshot all current block sizes into the session memory. Emit `session.start`.
2. **Decompose** the operation into an ordered list of unit steps:
   - For `move (dx, dy)`: `|dy|` steps along the vertical axis first, then `|dx|` steps along the horizontal axis.
   - For `resize (edge, delta)`: `|delta|` steps along `edge`.
3. **For each step**, in order:
   - Emit `step.start`.
   - Resolve the step (see below).
   - Emit `step.end`. If the step is rejected, **abort the remainder of the operation** and emit `session.end` with `accepted = false`.
4. **Session end**. Emit `session.end` with the final state.

### Resolving a single step

A step is a unit movement of the manipulated block in one direction `D` (move case) or a unit edge displacement (resize case).

1. **Compute the target rectangle** of the manipulated block after the step.
2. **Detect obstacles** on the target:
   - Grid edge violation: north `y < 0`, west `x < 0`, east `x + w > GRID_COLUMNS`. No south edge.
   - Collisions with other blocks.
3. **No obstacle** → apply the move/resize, emit `block.move` (or for resize: emit nothing on the primary at this granularity, see resize section), step accepted.
4. **Obstacle = grid edge** on the primary block → step rejected. Emit `block.reject` with reason `"primary-hit-edge:<direction>"`.
5. **Obstacle = collision** with one or more other blocks → enter chain resolution.

### Chain resolution

Triggered when the primary collides with one or more blocks during a step.

1. **Compute the chain** in direction `D` via `computeOperationChain(primary, D)`.
   - Breadth-first traversal starting from `primary`.
   - For each visited member, add its neighbors that are **contiguous in `D`** (touching the member's `D` face, with strict overlap > 0 on the perpendicular axis).
   - The recursion includes every block transitively contiguous, regardless of whether it is directly collided with.
   - Emit `chain.computed`.
2. **Push phase**. Translate every chain member by 1 cell in `D`. For each:
   - If the target is in-bounds and collision-free with non-chain blocks → apply, emit `block.move` with `cause = { kind: "push", sourceId: <previous in chain> }`.
   - If the target hits a grid edge or a non-chain block → that chain member is **blocked**, move to phase 2.
3. **Shrink phase**. For every chain member that could not be pushed:
   - Reduce its size by 1 along the axis of `D`, on the edge **opposite to `D`** (so the member's far edge stays put and its near edge retreats).
   - If size is already at min → that member is **saturated**, move to phase 3.
   - Otherwise: emit `block.shrink` with `cause = { kind: "shrink-cascade", sourceId: <primary> }`. Step succeeds.
4. **Wrap phase**. For every saturated chain member:
   - **Identify wrappable set**: all saturated members.
   - **If `allowShrink = false`** and any chain member would have been shrunk → reject the whole step here. Emit `block.reject`.
   - **If `allowWrap = false`** → reject. Emit `block.reject`.
   - Otherwise apply wrap (see below).

### Wrap rules

For each wrappable block, the engine:

1. **Restores its initial size** from the session memory.
2. **Repositions it** based on the operation's axis:
   - **Vertical axis** (D = north or south): wrap to the opposite side of the primary along the same axis.
   - **Horizontal axis** (D = east or west) **and** there is room to wrap to the opposite side: wrap there.
   - **Horizontal axis** with no room on the opposite side: **south fallback** (see below).

### South fallback for horizontal wrap

When the primary moves east/west and the chain saturates, the engine cannot wrap east/west members on the opposite east/west side (no room). It then drops the wrappable members **below the primary**.

Determining the order of placement:

1. **Normalize row positions** of wrappable members: translate the wrappable group so the member closest in y to the primary's anchor row aligns with the primary's anchor row. The same `dy` translation is applied uniformly to all wrappable members. **Columns (x) are not modified at this stage.**
2. **Compute euclidean distance** from each normalized member's anchor to the primary's anchor, using the member's **initial-session X** for the horizontal coordinate (see step 4 below for the rationale).
3. **Sort by distance, descending**: farthest first.
4. **Place each in turn**:
   - Use the member's **initial-session X** as the target column — that is, the X the block had when the session started, *before* any shrink/move/wrap that occurred during the gesture. Using the current (shrunk) X would push the block past the grid right edge once its width is restored: a block squeezed from `(x=18, w=18)` down to `(x=30, w=6)` against the east edge must wrap back to `x=18`, not stay at `x=30`. The initial column is read from `SessionMemory.getInitialPosition`.
   - Compute new `y` such that the group's relative y-structure is preserved and the whole group lies just below the primary (starting at `primary.y + primary.h`).
   - Restore initial size.
   - Run a recursive resolution on the placement collisions (push/shrink/wrap on the south region).
   - Stabilize before placing the next member.
   - Emit `block.wrap` with `cause = { kind: "wrap-fallback-south" }`.

**Note**: this may create holes in the south region. That is accepted; holes resolve naturally when the user moves blocks back.

### Cascading wrap among chain members

When a wrappable A lands at its south-fallback target, other members of the same chain (shrunk, moved, or otherwise still occupying their pre-step rows) may now collide with A's new placement. Pushing them further south with the residual cascade would leave them at their shrunk size, sitting under A in a degenerate state.

To avoid this, a **wrap-promotion pass** runs *before* the residual cascade (horizontal-axis steps only). For every chain member B (not the primary, not already wrapped) whose current position overlaps any placed wrappable, B is **promoted to a wrap**:

- B is moved to a south-fallback target computed against the primary's new position.
- B is restored to its **session-initial size** (`SessionMemory.getInitialSize`).
- B is stacked against already-placed wrappables (originals or earlier promotions in the same step) by pushing its target south as long as it overlaps any of them.
- B is added to the set of placed wrappables (immovable for the residual cascade).
- A `block.wrap` event is emitted with `cause = { kind: "wrap-fallback-south" }`.

The pass runs iteratively until no candidate remains, so promotions cascade transitively: if B's promotion creates a new collision for C, C is promoted on the next iteration.

The promotion criterion is purely positional: *any* chain member in collision with a wrappable's placement is eligible, regardless of whether it was previously shrunk, pushed, or just moved. A non-chain block in the same situation is handled by the residual cascade instead (it is pushed south, not wrapped, because it never participated in the chain).

### Residual cascade after wrap

After every wrappable member has landed on its target (south-fallback for horizontal axis, opposite-side baseline for vertical axis), the destination region may still contain non-chain, non-wrappable blocks that collide with the wrappable's new placement. The **residual cascade** resolves these post-wrap collisions by pushing the offending blocks south.

The cascade follows two propagation rules; both are evaluated in a single BFS that runs until no `dy` changes:

1. **Induced collision.** If a pushed block X (or a wrappable freshly placed) overlaps another block Y at its current projected position, Y is pushed south by the minimum `dy` required to clear X. This rule fires **only when `X.initial.y <= Y.initial.y`** — that is, X was at or above Y in the layout at the start of the step. This *order-preservation constraint* prevents pathological "remontées" where a block initially south of Y cascades downward and ends up pushing Y further south through transitive collisions, inverting the original vertical order and creating large empty gaps.
2. **Initial south-contiguity preserved.** If Y was south-contiguous to X in the layout *as it was at the start of the step* (X.y + X.h = Y.y, with x-overlap), then once X is pushed by `dy_X`, Y is pushed by at least `dy_X` — even if X's new position no longer collides with Y. This avoids the "jump over" pathology where a large push by X leaves Y orphaned in place.

Per-block `dy` is accumulated independently; the cascade never applies a uniform group shift. Each block descends only as far as strictly required by the two rules above. The seeded source (wrappable id that first pushed each block) is recorded for event emission.

Each pushed block also runs against the set of placed wrappables as **obstacles**: if a block's projected position overlaps a wrappable's placement, its `dy` is raised to clear that obstacle. This stabilises the multi-wrappable case where wrappables are placed in farthest-first order.

The cascade emits a `block.move` event per pushed block with `cause = { kind: "push", sourceId: <wrappable> }`.

### Resize specifics

A resize operation is conceptually a sequence of edge displacements. For each unit step:

- **Expand (`delta > 0`)**: the edge `edge` moves outward by 1 cell. Geometrically equivalent to the primary growing on that side. Chain resolution runs in direction `edge` if a collision occurs.
- **Shrink (`delta < 0`)**: the edge `edge` moves inward by 1 cell. The primary shrinks; the opposite edge stays put. No collision is produced by the primary itself.
  - If `compact = true`: after shrinking, run a **compact pass** (inverse of push) on the direction `edge`. Pull chain members from the opposite side toward the freed space.
  - If `compact = false`: nothing else happens. The freed cells become empty.

The primary block's own constraints (`minW`, `minH`, `maxW`, `maxH`, `allowedResizeDirections`) are checked first. A resize that would violate them is rejected immediately as `block.reject` with reason `"primary-constraint-violated"`.

### Compact (resize shrink + compact flag)

`compact` mirrors `push` symmetrically:

1. Compute the chain in direction **opposite** to the shrink edge (i.e., the side toward which neighbors will be pulled).
   - For shrink east (the east edge of the primary retreats westward), compact pulls blocks east of the primary toward the west, so direction = west… wait, let me restate:
   - **The direction of the chain computation is the direction the primary is "creating room toward"**. After a `resize east -1` (east edge moves west), the freed cells are east of the primary's new east edge. The chain to compact is blocks east of the primary, pulled west.
2. Translate every chain member by 1 cell **toward the primary** (opposite of the shrink edge).
3. Stop when a member can no longer be moved (collision with non-chain, grid edge).
4. Compact does **not** wrap, does **not** shrink.

### Diagonal moves

There is no special diagonal handling. A `move (dx=-2, dy=-3)` decomposes into:
1. Three north steps.
2. Two west steps.

The vertical resolution runs to completion (with all its cascades, wraps, fallbacks) before any horizontal step begins. The horizontal phase sees the post-vertical state and resolves independently.

This guarantees: if a vertical step pushed a wide block out of the way, subsequent horizontal steps do not need to interact with it.

---

## Session memory

The session retains, for every block, its `position.w` and `position.h` at the moment `session.start` is emitted.

- Used by wrap to restore size.
- Used **only within the session**: a new operation starts a fresh session memory.
- One session = one user-perceived gesture (a drag from mousedown to mouseup; a single keypress; one programmatic engine call).

---

## Undo/redo (future)

The session model naturally supports an undo/redo stack outside the engine:

- Each completed session corresponds to one undoable unit.
- A consumer can store, for every `session.end` event, the pair `(initial, final)` from the session's `session.start` and `session.end` events.
- Undo = restore `initial`; redo = restore `final`.
- This is **not part of the engine** but is enabled by its event model.

Implementation is deferred to a later step. The engine contract is sufficient: it emits the right events for any consumer to build undo/redo on top.

---

## Engine API (public)

```ts
function applyOperation(
  blocks: LayoutBlock[],
  operation: Operation,
  options: EngineOptions
): OperationResult;

type EngineOptions = {
  gridColumns: number;                          // typically GRID_COLUMNS = 36
  constraints: Map<string, BlockConstraints>;   // per-block constraints
  emitter?: EngineEventEmitter;                 // optional, defaults to noop
};
```

Pure function. Same inputs always produce the same outputs and the same event sequence.

---

## Determinism guarantees

1. **Identical inputs produce identical outputs.** No randomness, no implicit time, no global state.
2. **Identical inputs produce identical event sequences** in the same order.
3. **Step order is fixed**: vertical-then-horizontal for moves; in-order for resize delta.
4. **Chain traversal order is fixed**: breadth-first from the primary, ties broken by `(y, x)` ascending then by `id` lexicographic.
5. **Wrap fallback order is fixed**: euclidean distance descending (farthest first), ties broken by `id` lexicographic.

---

## Edge cases

| Case | Behavior |
|---|---|
| `dx = 0` and `dy = 0` | No-op. `accepted = false`, `appliedDelta = {dx:0, dy:0}`. |
| Primary not found in `blocks` | Throw. Programmer error. |
| Primary already at minimum size + shrink resize | Reject with `primary-constraint-violated`. |
| Wide block (full grid width) in chain during compact | Chain absorbs everything south or north of it. Big-bang acceptable. |
| `allowWrap = false` and step would require wrap | Step rejected, operation aborts. Partial moves already applied are kept. |
| Multiple chain members saturate simultaneously | All processed in wrap phase; farthest first per south-fallback rules. |
| Resize step into a hole (no collision) | Pure expansion, no chain involvement. |

---

## File layout

```
src/lib/layout/engine/
  types.ts        # Operation, OperationResult, EngineEvent, LayoutBlock, etc.
  events.ts       # EngineEventEmitter
  geometry.ts     # rectangle math, contiguity tests, distance
  session.ts      # initial-size memory
  chain.ts        # computeOperationChain
  step.ts         # single-step resolution (push / shrink / wrap dispatch)
  wrap.ts         # wrap rules, south fallback
  compact.ts      # compact pass
  engine.ts       # applyOperation, step decomposition
  index.ts        # public surface
```

Dependencies are strictly linear: `engine → step → {wrap, compact, chain} → geometry`. No cycles.

---

## Testing strategy

Each module has colocated unit tests (`*.test.ts`). The engine itself is tested via:

- **Pipeline tests**: assert on the final `OperationResult.blocks` and on the event sequence for canonical scenarios.
- **Property tests** (where useful): invariants like "no two blocks overlap after any operation", "no block goes outside the grid in x".
- **Performance guard**: `engine.perf.test.ts` runs an operation on 100 blocks and asserts < 50ms.

See [`layout-actions.md`](./layout-actions.md) for the mapping of input modifiers (Alt, Shift, etc.) to `OperationOptions`.
