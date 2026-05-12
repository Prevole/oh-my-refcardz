# Layout System V2 Specification

## 1. Overview

The current layout system already provides:

- grid-based positioning
- drag & resize interactions
- keyboard interactions
- persistence
- layout editing mode
- heading navigation integration

However, the current implementation is based on sequential reflow and incremental placement.

The new system must support:

- deterministic constraint propagation
- transitive collision resolution
- push / compact / resize interactions
- reversible preview during interaction
- layout-driven heading ordering
- strong separation between layout engine and UI consumers

The new layout engine must therefore be rewritten from scratch.

The existing visual design, styling, persistence concepts and integration patterns may be reused.

---

# 2. Rewrite Strategy

## 2.1 From scratch rewrite

The current layout engine must not be incrementally extended.

The following parts must be rewritten:

```txt
- layout-algorithms.ts
- resize-calculations.ts
- use-card-drag.ts
- use-card-resize.ts
- layout inference logic
- keyboard move/resize logic
- current resolveBlockLayout behavior
```

The current implementation is based on sequential placement and slot resolution.

The new implementation must instead rely on:

```txt
- constraint propagation
- deterministic collision solving
- layout snapshots
- immutable solving
- preview recomputation from interaction start state
```

---

## 2.2 Elements to reuse

The following parts should be reused whenever possible:

```txt
- card visual design
- heading visual design
- overlay styles
- coordinate/size badges
- dimmed blocks behavior
- focused/manipulating styles
- layout toolbar
- visible grid styling
- block type registry
- block constraints model
- local storage persistence concepts
- dev save/reset flow
- keybinding configuration system
```

---

# 3. Grid Model

The layout is grid-based.

```ts
type GridPosition = {
  x: number;
  y: number;
  w: number;
  h: number;
};
```

Coordinates are:

```txt
0-indexed
```

Origin:

```txt
0,0 is top-left
```

The coordinate system is half-open.

```txt
left   = x
right  = x + w
top    = y
bottom = y + h
```

Collision detection:

```ts
function intersects(a, b) {
  return (
    a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
  );
}
```

---

# 4. Grid Constraints

```txt
Column count: fixed (currently 36)
Row count: unlimited downward
```

Every block must satisfy:

```txt
x >= 0
y >= 0
x + w <= columnCount
w >= minW
h >= minH
w <= maxW
h <= maxH (if defined)
```

---

# 5. Block Constraints

Each block type may define:

```ts
type BlockConstraints = {
  minW: number;
  minH: number;
  maxW?: number;
  maxH?: number;
  allowedResizeDirections: ResizeDirection[];
};
```

Default behavior:

```txt
maxW = columnCount
maxH = undefined
```

Supported resize directions:

```txt
north
east
south
west
```

Diagonal resizing is intentionally excluded from the UI.

The solver may support diagonals later internally.

If diagonals are ever supported:

```txt
resolution order must be deterministic:
horizontal first, then vertical
```

---

# 6. Deterministic Ordering

The system must always behave deterministically.

Default visual reading order:

```txt
Top → Bottom
Then Left → Right
```

Equivalent sort:

```ts
sortBy(blocks, [y ASC, x ASC, id ASC])
```

Directional solving order:

```txt
Push right  → process right-most first
Push left   → process left-most first
Push down   → process bottom-most first
Push up     → process top-most first
```

Tie breaker:

```txt
y ASC → x ASC → id ASC
```

---

# 7. Impact Set and Constraint Propagation

## 7.1 Overview

The layout engine does not operate on direct neighbors only.

Constraint propagation is transitive.

A block impacted by another block may itself impact additional blocks.

---

## 7.2 Definition

The impact set is defined as:

```txt
The transitive closure of blocks affected by collisions and constraint resolution.
```

Pseudo-definition:

```txt
impactSet = closure(initialImpacts, propagatedCollisions)
```

---

## 7.3 Propagation Rules

### Horizontal operations

Propagation occurs through:

```txt
shared rows
then propagated collisions
```

### Vertical operations

Propagation occurs through:

```txt
shared columns
then propagated collisions
```

---

## 7.4 Example

```txt
A pushes B
B is wider than A
B collides with C
C becomes part of the impact set
```

Even if:

```txt
A never directly intersected C
```

---

## 7.5 Stability Requirements

Impact propagation must:

```txt
- be deterministic
- avoid infinite loops
- avoid oscillation
- use visited sets
```

---

# 8. Resize Behavior

## 8.1 Resize Expansion

When a block grows:

```txt
1. Apply requested resize
2. Compute impact set
3. Push impacted blocks
4. Reduce impacted blocks if necessary
5. Clamp resize if no valid solution exists
```

Reduction order:

```txt
Most distant impacted blocks first
```

---

## 8.2 Resize Toward Bottom

Rows are unlimited downward.

Therefore:

```txt
Growing downward must never require shrinking blocks.
```

Only pushing is needed.

---

## 8.3 Shrink Without Compacting

Mouse shrink without modifiers:

```txt
- shrink active block
- keep other blocks fixed
- gaps are allowed
```

---

## 8.4 Shrink With Compacting

Mouse shrink with Shift:

```txt
- shrink active block
- pull neighboring blocks toward freed space
- reduce gaps where possible
```

Keyboard equivalent:

```txt
Alt + Shift + Ctrl + direction
```

---

## 8.5 Reversibility

During interaction:

```txt
Every frame is recomputed from interaction start state.
```

Meaning:

```txt
- reduced blocks may grow back
- pushes may revert
- no intermediate mutation accumulation exists
```

---

# 9. Move Behavior

Blocks may move freely within grid constraints.

Constraints:

```txt
x >= 0
y >= 0
x + w <= columnCount
```

---

## 9.1 Collision-Free Move

If no collision exists:

```txt
The block simply takes the requested position.
```

---

## 9.2 Move With Collision

When collisions occur:

```txt
1. Active block keeps requested target position
2. Compute impact set
3. Push impacted blocks
4. Prefer rightward resolution
5. Then downward resolution
6. Cascade movement transitively
7. Apply compacting pass
```

---

## 9.3 Wrapping Behavior

If rightward pushing is impossible:

```txt
Blocks may be moved below the active area.
```

The system must preserve visual ordering as much as possible.

---

## 9.4 Drag Limits

Upward movement:

```txt
Minimum row = 0
```

Downward movement:

```txt
No real limit
```

Interaction limit:

```ts
maxDragDistanceY = block.h * dragVerticalFactor;
```

Default:

```ts
dragVerticalFactor = 3;
```

---

# 10. Compacting

Compacting occurs automatically after move operations.

Goals:

```txt
- reduce unnecessary gaps
- preserve determinism
- preserve constraints
- preserve block sizes
```

Compacting:

```txt
MAY move blocks
MUST NOT resize blocks
```

Compacting itself may trigger propagation.

Gaps remain allowed after validation.

The system attempts compacting but does not guarantee a gap-free layout.

---

# 11. Preview System

During drag/resize:

```txt
The displayed layout is a candidate layout.
```

Pipeline:

```txt
interactionStartLayout
  + user intent
  → solver
  → candidateLayout
```

The candidate layout is recomputed continuously.

The solver must be stateless relative to interaction frames.

---

# 12. Visual Behavior

During layout mode:

```txt
- grid becomes visible
- active block keeps normal appearance
- non-active blocks become semi-transparent
- pushes/resizes/moves update immediately
- impacted blocks animate/update immediately
- block coordinates and size are visible
- layout metrics are visible
```

Layout metrics include:

```txt
- column count
- current used row count
- pixel width of a column
```

These metrics remain visible while scrolling.

---

## 12.1 Resize Handles

Visible handles:

```txt
north
south
east
west
```

Diagonal handles are not displayed.

Rules:

```txt
- hidden if resize direction is forbidden
- correct cursor per direction
- no special cursor when forbidden
```

Keyboard mode:

```txt
All allowed handles remain visible
```

---

# 13. Keyboard Mode

Keyboard interactions follow the exact same constraints as mouse interactions.

Keybindings:

```txt
Shift + arrows / hjkl
  → move focus between blocks

Alt + arrows / hjkl
  → move active block

Alt + Shift + arrows / hjkl
  → resize active block

Alt + Shift + Ctrl + arrows / hjkl
  → resize active block with compacting

Esc
  → cancel layout session

Enter
  → validate layout session
```

Keybindings must be configurable.

---

# 14. Layout States

The system distinguishes several layout states.

```ts
defaultLayout;
localDraftLayout;
editingLayout;
candidateLayout;
interactionStartLayout;
```

Definitions:

```txt
defaultLayout
  → backend or JSON layout

localDraftLayout
  → localStorage persisted layout

editingLayout
  → mutable layout during layout mode

candidateLayout
  → preview layout during interaction

interactionStartLayout
  → immutable snapshot at interaction start
```

---

## 14.1 State Transitions

Entering layout mode:

```txt
editingLayout = localDraftLayout ?? defaultLayout
```

Starting interaction:

```txt
interactionStartLayout = editingLayout
```

During interaction:

```txt
candidateLayout = solve(interactionStartLayout, intent)
```

Interaction end:

```txt
editingLayout = candidateLayout
```

Esc:

```txt
discard editingLayout
```

Enter:

```txt
localDraftLayout = editingLayout
exit layout mode
```

---

# 15. Persistence

## 15.1 Local Persistence

Validated layouts are persisted in:

```txt
localStorage
```

Persistence remains enabled in development mode.

---

## 15.2 Developer Mode

Developer mode provides:

```txt
- explicit Save Layout button
- explicit Reset Layout button
```

Behavior:

```txt
Save
  → persist current layout to backend

Reset
  → reload backend/JSON layout
```

No automatic backend persistence exists.

localStorage acts as:

```txt
- local persistence
- temporary save buffer
```

---

# 16. Layout Migration

The current layout format:

```ts
{
  colStart;
  rowStart;
  colSpan;
  rowSpan;
}
```

New format:

```ts
{
  x;
  y;
  w;
  h;
}
```

Migration:

```ts
x = colStart - 1;
y = rowStart - 1;
w = colSpan;
h = rowSpan;
```

Storage version must be incremented.

---

# 17. Layout Engine Architecture

The solver must live independently from React.

Recommended structure:

```txt
layout/solver/
  types.ts
  geometry.ts
  constraints.ts
  collision.ts
  impact-set.ts
  push.ts
  resize.ts
  move.ts
  compact.ts
  solve-layout.ts
```

---

## 17.1 Solver API

```ts
function solveLayout(initialLayout, intent, options): LayoutCandidate;
```

Candidate:

```ts
type LayoutCandidate = {
  layout;
  accepted;
  partial;
  blockedReason?;
};
```

---

## 17.2 Intents

```ts
type LayoutIntent =
  | {
      type: "move";
      blockId: string;
      x: number;
      y: number;
    }
  | {
      type: "resize";
      blockId: string;
      direction: ResizeDirection;
      deltaW: number;
      deltaH: number;
      compact: boolean;
    };
```

---

## 17.3 Solver Requirements

The solver must be:

```txt
- deterministic
- immutable
- testable independently
- reversible during interaction
- independent from DOM
- independent from React
```

---

# 18. UI / Solver Separation

React components must not directly resolve layout logic.

UI responsibilities:

```txt
- capture interactions
- produce intents
- render snapshots
```

Solver responsibilities:

```txt
- constraint propagation
- collision solving
- pushing
- compacting
- validation
```

---

# 19. Heading Navigation Synchronization

The page contains a pinned heading navigation.

The navigation order must reflect:

```txt
visual layout order
```

Not YAML/source order.

Ordering:

```txt
Top → Bottom
Then Left → Right
```

Equivalent sort:

```ts
sortBy(headings, [y ASC, x ASC, id ASC])
```

---

## 19.1 Live Synchronization

During layout interaction:

```txt
Heading navigation must update live.
```

Meaning:

```txt
moving a heading upward
  → heading moves upward in navigation
```

The navigation must always reflect:

```txt
candidateLayout if present
editingLayout otherwise
localDraftLayout otherwise
defaultLayout as fallback
```

---

# 20. Decoupling Between Layout and Navigation

The layout system must not know about the navigation system.

The navigation system must not manipulate layout internals.

Responsibilities:

```txt
Layout system
  → compute and publish layout state

Navigation system
  → consume layout state and render headings
```

Communication must occur through:

```txt
- events
- snapshots
- hooks
- providers
- subscriptions
```

The coupling must remain minimal.

---

## 20.1 Shared Contract

Recommended shared structure:

```ts
type LayoutSnapshot = {
  blocks: Record<string, GridPosition>;
  phase: "preview" | "commit";
  source: "initial" | "drag" | "resize" | "keyboard" | "reset" | "load";
};
```

Consumers may include:

```txt
- heading navigation
- minimap
- overlays
- debug panels
- analytics
```

---

## 20.2 Recommended Integration

Recommended architecture:

```txt
Layout System
  ↓
Layout Snapshot Provider / Event Bus
  ↓
Consumers
```

The navigation consumes snapshots only.

It must not depend on:

```txt
- drag hooks
- resize hooks
- persistence internals
- solver internals
```

---

# 21. Existing Codebase Audit

The current layout implementation already provides a strong visual and integration foundation.

Key existing modules:

```txt
src/components/sheets/layout/
```

Notable files:

```txt
layout-types.ts
layout-algorithms.ts
resiz
```
