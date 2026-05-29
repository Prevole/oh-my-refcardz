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
| **Session** | The lifespan of a continuous interaction. May span a single `applyOperation` call (one keystroke, one programmatic call) or many (a mouse drag from `pointerdown` to `pointerup`, or a full keyboard layout-mode lifetime). Sessions memoize initial sizes for wrap-restore and cache snapshots keyed by footprint for reversibility. See `EngineSession` in `engine-session.ts`. |
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

**Priority rule (dominant-axis greedy)**: when an operation has a non-zero `dx` and `dy`, the engine resolves steps **greedily along the dominant axis first** (the axis with the larger absolute delta), interleaving the other axis only after the dominant axis is exhausted or blocks. Ties (`|dx| == |dy|`) prefer the vertical axis. This replaces the older strict "vertical-then-horizontal" rule, which produced premature pushes when the user's intent was clearly horizontal.

Diagonal operations are handled naturally by this greedy decomposition: see "Diagonal moves" below.

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
  appliedDx: number;              // cells actually applied on the horizontal axis (move ops)
  appliedDy: number;              // cells actually applied on the vertical axis (move ops)
  appliedDelta: number;           // signed cells actually applied on the resize edge (resize ops)
  affected: {
    moved: Set<string>;           // ids of non-manipulated blocks that were pushed
    shrunk: Map<string, { w: number; h: number }>;  // ids → their initial size before shrink
    wrapped: Set<string>;         // ids that were wrapped
  };
  rejected?: { reason: string };  // present when accepted = false
};
```

`appliedDx`/`appliedDy` are populated for `move` operations only; `appliedDelta` is populated for `resize` operations. The unused field stays at `0`.

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
  | { type: "block.move";    opId: string; stepIndex: number; blockId: string; from: GridPosition; to: GridPosition; cause: EventCause }
  | { type: "block.shrink";  opId: string; stepIndex: number; blockId: string; fromSize: { w: number; h: number }; toSize: { w: number; h: number }; cause: EventCause }
  | { type: "block.wrap";    opId: string; stepIndex: number; blockId: string; from: GridPosition; to: GridPosition; restoredSize: { w: number; h: number }; cause: EventCause }
  | { type: "block.resize";  opId: string; stepIndex: number; blockId: string; from: GridPosition; to: GridPosition; fromSize: { w: number; h: number }; toSize: { w: number; h: number }; edge: Direction; delta: number; cause: EventCause }
  | { type: "block.reject";  opId: string; stepIndex: number; blockId: string; reason: string };

type EventCause =
  | { kind: "primary" }                          // the manipulated block itself
  | { kind: "push"; sourceId: string }           // pushed by another block in the chain
  | { kind: "shrink-cascade"; sourceId: string } // shrunk because pushed by another block
  | { kind: "wrap-fallback-south" }              // wrapped via south fallback
  | { kind: "wrap-axis"; axis: "x" | "y" }       // wrapped in main axis ("x" = horizontal, "y" = vertical)
  | { kind: "compact"; sourceId: string };       // moved by the compact pass
```

`block.resize` is emitted for the primary block on resize operations (one event per accepted unit step). `block.move`, `block.shrink`, `block.wrap` describe chain effects.

A consumer subscribes by providing an `EngineEventEmitter` in engine options. The default is a noop.

---

## Resolution pipeline

For every operation:

1. **Session start**. Snapshot all current block sizes into the session memory. Emit `session.start`.
2. **Decompose** the operation into an ordered list of unit steps:
   - For `move (dx, dy)`: decompose greedily along the dominant axis. At each iteration, emit one step along whichever axis still has remaining magnitude and is the current dominant; flip axes when the dominant axis is exhausted. Ties prefer the vertical axis.
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
   - Use the member's **initial-session X** as the target column — that is, the X the block had when the session started, *before* any shrink/move/wrap that occurred during the gesture. Using the current (shrunk) X would push the block past the grid right edge once its width is restored: a block squeezed from `(x=32, w=32)` down to `(x=58, w=6)` against the east edge must wrap back to `x=32`, not stay at `x=58`. The initial column is read from `SessionMemory.getInitialPosition`.
   - Compute new `y` such that the group's relative y-structure is preserved and the whole group lies just below the primary (starting at `primary.y + primary.h`).
   - Restore initial size.
   - Run a recursive resolution on the placement collisions (push/shrink/wrap on the south region).
   - Stabilize before placing the next member.
   - Emit `block.wrap` with `cause = { kind: "wrap-fallback-south" }`.

**Note**: this may create holes in the south region. That is accepted; holes resolve naturally when the user moves blocks back.

### Shrink absorption before wrap

A chain push may saturate one or more tail members against the grid edge. The default action for a saturated tail is **wrap**. However, if **every** branch of the chain leading to that tail contains at least one non-saturated member that can shrink on its trailing axis, the engine prefers to **absorb** the 1-unit displacement internally rather than push the tail off the grid.

The absorption pass runs after every chain member has been assigned a tentative action (push, shrink, or wrap), and before option gates and event emission.

**Branches.** A saturated tail T can be reached from the primary through multiple paths in the contiguity graph (typical case: a wide heading at the grid edge is touched by two columns of the chain). For each tail flagged for wrap, the engine runs a reverse BFS from T toward the primary along `isContiguous(parent, child, D)` edges. Every distinct path from T to a non-saturated upstream member (closest first) yields one **branch** for that tail.

**Per-branch absorber.** On each branch, the **first non-saturated member encountered** (closest to T) is the absorber for that branch. The primary itself is never an absorber: it expresses the user's intent and must keep moving.

**Shared members.** A single chain member can lie on multiple branches (e.g. a member that is an ancestor of two saturated tails, or a shared upstream absorber for two branches that converge). When the same member is chosen as absorber by several branches, it shrinks **once**: a single h-- (or w--) on a shared member absorbs the displacement for every branch passing through it.

**Converging branches.** When two branches reach the same upstream ancestor (e.g. two saturated tails B and C both have E as their parent), both branches contribute their saturated paths to the frozen set, even if the absorber itself is only shrunk once. This prevents the second-visited branch from being silently ignored, which would let its saturated members push on top of the tail in subsequent steps.

**Outcome per tail.**

- **Absorbed tail.** Every branch reaching T has an absorber. T's `wrap` action is removed. Every absorber shrinks 1 unit on its trailing edge (the edge facing T). Every member strictly between any absorber and T along its branch — plus T itself — is removed from the action set and stays at its current position.
- **Wrap-forced tail.** At least one branch reaching T has no absorber (every upstream non-primary member on that branch is saturated, or the tail is directly contiguous to the primary). T's `wrap` action is kept and follows the standard wrap path. No member is frozen for this tail.

**Independent tails.** Multiple saturated tails are analysed independently. A wrap-forced tail does not prevent other tails from being absorbed.

This unified branch-aware design avoids the regression where a single absorber on one branch would let other branches push their tail off-grid, creating overlaps with the saturated tail on subsequent steps.

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

There is no special diagonal handling. A `move (dx=-2, dy=-3)` decomposes greedily along the dominant axis (here vertical, `|dy| > |dx|`): the engine emits north steps as long as that axis is dominant and unblocked, interleaving west steps when the vertical pressure has been absorbed. A pure `move (dx=-3, dy=-2)` would start with west steps for the same reason.

The greedy interleaving is partial-progress friendly: if a step is rejected mid-operation (e.g. `allowWrap=false` and a wrap would be required), the engine aborts the remainder but **keeps every accepted step** in the final state. This applies uniformly to mouse drags (sub-cell accumulation) and to multi-step keyboard operations.

---

## Session memory and snapshot cache

A long-lived session (`EngineSession`, `engine-session.ts`) retains two pieces of state across calls:

- **Initial-size memory**: for every block, its `position.w` and `position.h` at session start. Used by wrap to restore size. A new session starts a fresh memory.
- **Snapshot cache**: a map keyed by the primary block's full footprint `${primaryId}:${x}:${y}:${w}:${h}`. When the primary returns to a previously visited footprint within the same session, the engine restores the corresponding snapshot verbatim (emitting `session.restore` instead of re-resolving). This guarantees geometric reversibility: `Right Right Left Left` returns to the exact starting state, even after pushes/wraps that would not be perfectly reversible step-by-step.

A session corresponds to one user-perceived editing context:

- Mouse drag: from `pointerdown` to `pointerup` (one session, many internal `step` calls).
- Keyboard layout mode: from `Ctrl+M` (`enterMode`) to commit/discard (one session, many keystrokes — see `KeyboardSession` below).
- One-shot programmatic call (`applyOperation`): an ephemeral session created and torn down per call.

---

## Undo/redo

Phase H adds an undo/redo pile that sits outside the engine and is shared by
both interaction modes (mouse gestures and the buffered keyboard editor). The
pile is **not** part of the engine contract — it consumes engine events and
relies on the engine's hard immutability contract (snapshots passed to
`applyOperation` are never mutated) so it can store snapshots by reference.

### Module layout

| Module | Role |
|---|---|
| `src/lib/layout/history.ts` | Pure cursor-based pile (`LayoutHistory`). No React. |
| `src/components/sheets/layout/use-layout-history.ts` | React hook that wires the pile to the editor and the buffered keyboard hook. |
| `src/components/sheets/layout/layout-action-group.tsx` | Floating Undo / Redo / Reset capsule (3 buttons). |

### Pile model

```
past: [e0, e1, ..., e(n-1)]   present: en    future: [e(n+1), ...]
```

Each entry carries `{ snapshot: readonly LayoutBlock[]; source: "mouse" | "keyboard" }`. The pile is anchored on mount with the initial committed layout pushed as a mouse-sourced entry so the very first user mutation enables undo.

- `push(snapshot, source)` drops `future`, moves `present` into `past`, makes a new entry the present.
- `undo()` / `redo()` shift along the cursor and return the new `present` entry (or `null`).
- `canUndo()` / `canRedo()` are also exposed as **reactive booleans** by the hook (`useLayoutHistory` mirrors them into React state), so consumers like the action-group buttons re-render when availability flips.
- `clear()` drops everything (used on slug change).
- `capacity` (default 100) caps `past`; oldest entries are evicted.

### Push policy

- **Mouse gestures** push a single entry per gesture, via `useLayoutEditor.onInteractionCommit` (fired from `commitInteraction`, the sole mouse funnel). Per-gesture granularity regardless of intermediate `applyOperation` calls during the drag.
- **Keyboard keystrokes** push one entry per effective mutation, via `useLayoutKeyboard.onKeyboardMutation`. The buffer reports `ApplyOutcome.changed`; no-ops never push.
- **`LAYOUT_RESET` inside layout mode** pushes the buffer's initial snapshot as a keyboard entry so the reset itself is undoable.

### Undo / redo routing

| Mode | Undo target | Persistence |
|---|---|---|
| Mouse (layout mode inactive) | `editor.commitLayout(snapshot)` | Immediate (`onCommit` write-back to `localStorage`). |
| Keyboard buffered session active | `bufferState.replaceContents(snapshot, ±1)` | Deferred to session commit. **Exception:** if the restored entry's `source` is `"mouse"` (cross-mode), `commitLayout` is also called to keep the persisted state consistent with the post-session world. |

An anti-loop guard (`isApplyingHistoryRef`) is flipped around `commitLayout` calls so the renderer's persistence-sync effect bails out instead of re-pushing the history-driven write back into the editor.

### Session pins (H4.4)

A buffered keyboard session has its own boundary: the user can either commit (Enter) or discard (Esc, with the 5-change modal threshold). The history must track that boundary so:

- **Discard** drops every in-session entry from the pile (the user cannot undo into states they explicitly rejected and which were never persisted).
- **Commit** relabels every in-session entry as `"mouse"` so subsequent cross-mode undo writes back through `commitLayout` and persists immediately.

The pile exposes three primitives for this:

- `pin(): LayoutHistoryCursor` — captures the current cursor as an opaque `{ epoch, entry }` token.
- `restoreTo(cursor)` — truncates `past` to the pinned entry, restores it as `present`, clears `future`. Used on discard.
- `relabelAfter(cursor, source)` — rewrites the `source` of every entry strictly after the pin (preserves the pinned entry itself). Used on commit.

A cursor is invalidated by `clear()` (epoch bump) or by capacity eviction; in both cases `restoreTo` / `relabelAfter` throw. Pins are intentionally identity-based (not snapshot-based) to make stale-cursor bugs loud.

The hook exposes these as `pinSession()` / `discardSession(pin)` / `commitSession(pin)`, which `useLayoutKeyboard` calls in `enterMode` / `discardMode` / `commitMode` respectively. The cursor is stored in a ref local to the keyboard hook so a single session can hand it back at exit time without leaking through component props.

### Keybindings

- `LAYOUT_UNDO` (`u`) and `LAYOUT_REDO` (`z`) are bound on both the `sheet` and `layout` scopes so the same shortcuts work in mouse mode and inside the buffered keyboard session.
- `Ctrl+Shift+Z` is **not** used for redo: macOS intercepts it at OS level. The Vim convention `z` is the default redo combo.
- `Ctrl+R` / `Ctrl+Shift+R` are never bound (browser reload).

### Persistence semantics summary

| Action | Push? | Persists? |
|---|---|---|
| Mouse gesture commit | yes (`mouse`) | yes |
| Keyboard mutation inside session | yes (`keyboard`) | no, until commit |
| Keyboard mutation undo (single-mode) | no (cursor shift) | no |
| Keyboard mutation undo of a `"mouse"` entry (cross-mode) | no | yes |
| `LAYOUT_RESET` inside session | yes (`keyboard`) | no |
| Session commit (Enter) | no | yes; in-session entries relabeled `"mouse"` |
| Session discard (Esc silent / modal-confirmed) | no | no; in-session entries dropped via `restoreTo` |
| `clear()` (slug change) | resets entire pile | n/a |

---

## Keyboard session (buffered editor)

The keyboard layout mode runs a **long-lived `KeyboardSession`** on top of a long-lived `EngineSession`. Together they form a buffered editor: every move/resize/strict operation lands in an in-memory snapshot, and the user either commits (`Enter`) or discards (`Esc`, mouse click, or the confirmation modal at the 5-change threshold). This eliminates the dual-driver ambiguity that arose when mouse and keyboard interleaved writes to the persistent state, and the snapshot cache of the underlying `EngineSession` guarantees that any sequence of keystrokes ending on a previously visited footprint restores the exact corresponding layout.

### Vocabulary

- **Buffer**: the live `LayoutBlock[]` snapshot held inside the `KeyboardSession`. Never touches `localStorage`.
- **Entry snapshot**: the persisted layout at the moment `Ctrl+M` is pressed. Captured once and reused by `Shift+R` to rewind.
- **Commit**: apply the buffer over the persisted layout through the same path mouse-driven edits take (`useLayoutPersistence.setBlockLayouts`), then exit the mode.
- **Discard**: throw away the buffer. Persisted layout is unchanged. Silent below the threshold, gated by `LayoutDiscardConfirm` otherwise.
- **Changes count**: number of buffer mutations the user has produced since entering the mode. Drives the pill counter, the floating reset button visibility, and the discard-confirm threshold.

### Lifecycle

1. **Entry** (`Ctrl+M`, `LAYOUT_ENTER_MODE` on `sheet` scope):
   - Take the entry snapshot from `editor.committedBlocks`.
   - Create a fresh `EngineSession` and wrap it in a new `KeyboardSession`.
   - Initialise `currentBuffer = entrySnapshot`, `changesCount = 0`.
   - Push the `layout` scope + the initial `layout-navigation` sub-scope.
   - Pill appears (`Navigation`, no counter yet).
2. **Buffered op** (keyboard move/resize/strict, scopes `layout-move` / `layout-resize`):
   - The `KeyboardSession` resolves the op against the current buffer via its underlying `EngineSession` (snapshot cache active across keystrokes).
   - Per-keystroke `OperationOptions` are fully resolved before each call to prevent strict-mode leakage from one keystroke to the next.
   - If the engine returns a structurally distinct layout (id+kind+x/y/w/h equality), the buffer advances and `changesCount` is incremented by 1.
   - Engine no-ops (rejection by constraints, identical result, cache restore to the same footprint) do NOT increment.
   - The sheet renders `currentBuffer`, not the persisted layout.
3. **Reset** (`Shift+R`, `LAYOUT_RESET` on `layout`):
   - Replace `currentBuffer` with `entrySnapshot`, set `changesCount = 0`.
   - Stay in the mode; the user keeps editing from the entry state.
4. **Commit** (`Enter`, `LAYOUT_COMMIT` on `layout`):
   - Persist `currentBuffer` via `editor.commitLayout(blocks)`.
   - Clear the buffer, exit the mode (pop the `layout-*` scopes, hide the pill).
5. **Discard** (`Esc`, mouse click on any card / on the empty grid):
   - If `changesCount < 5`: silent. Clear buffer, exit mode.
   - If `changesCount >= 5`: open `LayoutDiscardConfirm` (modal scope `layout-discard-confirm`). `Enter` inside the modal confirms the discard; `Esc` cancels and returns to the editing session with the buffer intact.

### Counter semantics

- **Granularity**: 1 increment per user-perceived action, not per engine displacement. A `compact` op that moves several neighbours still counts as `1`.
- **No net-diff tracking**: an op that perfectly undoes a previous one still increments (the counter tracks user effort, not net distance from the entry snapshot).
- **No-ops**: when the engine rejects the op or returns the exact same layout, the counter is unchanged. This keeps "pressed a key that did nothing" off the counter.

### Mouse interaction during a buffered session

Drag and resize via mouse are disabled while the buffer is active. `handleHeaderPointerDown` and `handleResizePointerDown` route any pointer-down to the discard path (silent or modal-gated per the threshold) and return early before the manipulation handlers can start. The grid's empty area triggers the same path through `onEmptyPointerDown`. This enforces "no mouse/keyboard mixing during a buffered session" at the entry point: the user is in keyboard mode by deliberate choice.

### Scope stack interaction

The scope stack is driven by an imperative `ScopeStackManager` (`src/lib/scope-stack-manager.ts`) shared between the React provider and the keyboard dispatcher. Children's `useKeyboardScope` effects push their scope before the parent's mount effect runs; the manager exposes `current` as a synchronous getter so the dispatcher reads the live stack on every keydown rather than a closed-over React state value. This is what makes the modal-confirm Enter route to `LAYOUT_DISCARD_CONFIRM` instead of falling through to `LAYOUT_COMMIT` on the parent `layout` scope.

### Files

- `src/lib/layout/engine/engine-session.ts` — `EngineSession`, the long-lived stateful wrapper around the pure engine. Holds the snapshot cache and the initial-size memory across many `step` / `moveTo` / `resize` calls.
- `src/components/sheets/layout/keyboard-session.ts` — pure `KeyboardSession` module (`createKeyboardSession`, `apply`, `reset`, `replaceContents`). Owns the buffer, change counter, and per-keystroke option resolution. Testable in isolation.
- `src/components/sheets/layout/use-layout-buffer-state.ts` — thin React shell around `createKeyboardSession`; exposes `start / apply / commit / clear / reset / bufferBlocks / changesCount / isActive`.
- `src/components/sheets/layout/use-layout-keyboard.ts` — keyboard hook wiring entry/commit/discard/reset to the buffer state.
- `src/components/sheets/layout/layout-discard-confirm.tsx` — modal component, scope `layout-discard-confirm`.
- `src/components/sheets/layout/layout-mode-pill.tsx` — pill with optional `changesCount` suffix.
- `src/components/sheets/layout/layout-buffer-reset-button.tsx` — floating reset button shown while the buffer is dirty.
- `src/lib/scope-stack-manager.ts` — imperative scope stack used by `use-keyboard-context` and `KeyboardDispatcher`.

---

## Engine API (public)

Two entry points cover the two interaction shapes.

### One-shot

```ts
function applyOperation(
  blocks: LayoutBlock[],
  operation: Operation,
  options: EngineOptions
): OperationResult;
```

Thin wrapper around `createEngineSession`: spins up an ephemeral session, runs the operation, returns the result. Pure: same inputs always produce the same outputs and the same event sequence. Used by tests and any non-interactive caller.

### Stateful session

```ts
function createEngineSession(
  initial: LayoutBlock[],
  options: EngineSessionOptions
): EngineSession;

type EngineSession = {
  step(input: StepInput): StepOutcome;
  moveTo(input: MoveToInput): MoveToOutcome;
  resize(input: ResizeInput): OperationResult;
  setOperationOptions(options: Partial<OperationOptions>): void;
  current(): readonly LayoutBlock[];
  commit(): readonly LayoutBlock[];
  cancel(): void;
};
```

`EngineSession` is the long-lived counterpart used by mouse drags and the keyboard session. It holds the initial-size memory and the snapshot cache across calls so that geometric reversibility (e.g. `Right Right Left Left → starting state`) is preserved within the session boundary. `setOperationOptions` merges into the current option set (undefined fields preserve the prior value); the keyboard layer resolves the full option set per keystroke to avoid strict-mode leakage.

### Shared options

```ts
type EngineOptions = {
  gridColumns: number;                          // typically GRID_COLUMNS = 64
  constraints: Map<string, BlockConstraints>;   // per-block constraints
  emitter?: EngineEventEmitter;                 // optional, defaults to noop
  emitterProvider?: () => EngineEventEmitter;   // optional, invoked on every emission (allows mid-session swap)
  opId?: string;                                // optional explicit session id; auto-generated otherwise
};
```

`EngineSessionOptions` extends `EngineOptions` with the session-level option defaults.

---

## Determinism guarantees

1. **Identical inputs produce identical outputs.** No randomness, no implicit time, no global state.
2. **Identical inputs produce identical event sequences** in the same order.
3. **Step order is fixed**: dominant-axis greedy for moves (ties favour vertical); in-order for resize delta.
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
  types.ts          # Operation, OperationResult, EngineEvent, LayoutBlock, etc.
  events.ts         # EngineEventEmitter
  geometry.ts       # rectangle math, contiguity tests, distance
  session.ts        # initial-size memory
  chain.ts          # computeOperationChain
  step.ts           # single-step resolution (push / shrink / wrap dispatch)
  wrap.ts           # wrap rules, south fallback
  compact.ts        # compact pass
  engine.ts         # applyOperation (thin wrapper over engine-session)
  engine-session.ts # createEngineSession: stateful long-lived session + snapshot cache
  index.ts          # public surface
```

Dependencies are strictly linear: `engine → step → {wrap, compact, chain} → geometry`. No cycles.

---

## Testing strategy

Each module has colocated unit tests (`*.test.ts`). The engine itself is tested via:

- **Pipeline tests**: assert on the final `OperationResult.blocks` and on the event sequence for canonical scenarios.
- **Property tests** (where useful): invariants like "no two blocks overlap after any operation", "no block goes outside the grid in x".
- **Performance guard**: `engine.perf.test.ts` runs an operation on 100 blocks and asserts < 50ms.

See [`layout-actions.md`](./layout-actions.md) for the mapping of input modifiers (Alt, Shift, etc.) to `OperationOptions`.
