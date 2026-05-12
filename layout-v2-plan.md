# Layout System V2 — Implementation Plan

This document tracks the implementation plan for the Layout V2 rewrite.

**Spec**: [layout-v2-specs.md](./layout-v2-specs.md)

---

## Context

The current layout system uses sequential placement and slot resolution.
The new system requires:

- Constraint propagation (transitive)
- Deterministic collision solving
- Immutable snapshots
- Preview recomputation from interaction start state
- Clean separation: solver (pure logic) vs UI (React hooks)

### Approach

- **Incremental implementation** — work in milestones with validation points
- **Parallel code** — new code lives alongside old code until cutover
- **No intermediate breakage expected** — tests/build may fail during development
- **Real data first** — migrate layout format early to test with real cheatsheets

---

## Architecture Overview

### Current Architecture

```
sheet-renderer.tsx
    ├── useLayoutPersistence()     → blockLayouts state
    ├── useCardDrag()              → mutates blockLayouts directly
    ├── useCardResize()            → mutates blockLayouts directly
    ├── useCardKeyboard()          → mutates blockLayouts directly
    └── BlockRenderer              → renders blocks
```

### New Architecture

```
sheet-renderer.tsx
    ├── useLayoutPersistence()     → blockLayouts state (adapted for new format)
    ├── useLayoutEditor()          → orchestrates editing session
    │       ├── produces intents
    │       ├── calls solver
    │       └── publishes snapshots
    ├── useCardDragV2()            → produces move intents
    ├── useCardResizeV2()          → produces resize intents
    ├── useCardKeyboardV2()        → produces move/resize intents
    └── BlockRenderer              → renders blocks (reused)

src/lib/layout/solver/            → pure solver (no React/DOM)
    ├── types.ts
    ├── geometry.ts
    ├── constraints.ts
    ├── collision.ts
    ├── impact-set.ts
    ├── push.ts
    ├── compact.ts
    └── solve-layout.ts
```

---

## Milestone 1: Types & Data Migration

**Goal**: New coordinate format working end-to-end with real data.

### 1.1 Create New Types

**File**: `src/lib/layout/solver/types.ts`

```typescript
// Grid coordinates (0-indexed, half-open)
type GridPosition = { x: number; y: number; w: number; h: number };

// Block with position
type LayoutBlock = {
  id: string;
  kind: "heading" | "card";
  position: GridPosition;
};

// Block constraints (from registry)
type BlockConstraints = {
  minW: number;
  minH: number;
  maxW?: number;
  maxH?: number;
  allowedResizeDirections: ResizeDirection[];
};

type ResizeDirection = "north" | "south" | "east" | "west";

// Intents
type MoveIntent = {
  type: "move";
  blockId: string;
  x: number;
  y: number;
};

type ResizeIntent = {
  type: "resize";
  blockId: string;
  direction: ResizeDirection;
  delta: number; // positive = expand, negative = shrink
  compact: boolean;
};

type LayoutIntent = MoveIntent | ResizeIntent;

// Solver result
type LayoutCandidate = {
  layout: LayoutBlock[];
  accepted: boolean;
  blockedReason?: string;
};

// Snapshot for consumers
type LayoutSnapshot = {
  blocks: Record<string, GridPosition>;
  phase: "preview" | "commit";
  source: "initial" | "drag" | "resize" | "keyboard" | "reset" | "load";
};
```

### 1.2 Create Migration Utilities

**File**: `src/lib/layout/migration.ts`

```typescript
// Convert old format to new format
function migrateBlockLayout(old: OldBlockLayoutState): LayoutBlock {
  return {
    id: old.id,
    kind: old.kind,
    position: {
      x: old.colStart - 1,
      y: old.rowStart - 1,
      w: old.colSpan,
      h: old.rowSpan,
    },
  };
}

// Convert new format back to old (for gradual migration)
function toOldFormat(block: LayoutBlock): OldBlockLayoutState { ... }

// Migrate localStorage data
function migrateStoredLayout(stored: unknown): LayoutBlock[] | null { ... }
```

### 1.3 Update Schema & Migrate YAML Files

**Files to update**:
- `src/lib/yaml-cheatsheets.ts` — accept new format in `savedBlockLayout`
- `content/cheatsheets/**/*.layout.json` — migrate all files

**Migration script**: Create a one-time script to convert all `.layout.json` files.

### 1.4 Adapt Persistence Hook

**File**: `src/components/sheets/layout/use-layout-persistence.ts`

- Read: accept both old and new format, normalize to new
- Write: save in new format only
- Increment storage version to v4

### Validation Point

- [ ] App starts without errors
- [ ] Cheatsheets display correctly
- [ ] localStorage migration works (old data → new format)
- [ ] New layouts saved in new format

---

## Milestone 2: Solver Core

**Goal**: Pure solver that computes valid layouts, fully tested.

### 2.1 Geometry Utilities

**File**: `src/lib/layout/solver/geometry.ts`

```typescript
function intersects(a: GridPosition, b: GridPosition): boolean;
function contains(outer: GridPosition, inner: GridPosition): boolean;
function getBounds(blocks: LayoutBlock[]): GridPosition;
function sortByReadingOrder(blocks: LayoutBlock[]): LayoutBlock[];
function sortByDirection(blocks: LayoutBlock[], direction: ResizeDirection): LayoutBlock[];
```

### 2.2 Constraints

**File**: `src/lib/layout/solver/constraints.ts`

```typescript
const GRID_COLUMNS = 36;

function validatePosition(pos: GridPosition, constraints: BlockConstraints): boolean;
function clampToGrid(pos: GridPosition): GridPosition;
function clampToConstraints(pos: GridPosition, constraints: BlockConstraints): GridPosition;
```

### 2.3 Collision Detection

**File**: `src/lib/layout/solver/collision.ts`

```typescript
function findCollisions(block: LayoutBlock, others: LayoutBlock[]): LayoutBlock[];
function hasAnyCollision(blocks: LayoutBlock[]): boolean;
```

### 2.4 Impact Set

**File**: `src/lib/layout/solver/impact-set.ts`

```typescript
// Compute transitive closure of impacted blocks
function computeImpactSet(
  source: LayoutBlock,
  direction: ResizeDirection | "move",
  allBlocks: LayoutBlock[]
): Set<string>;
```

### 2.5 Push Resolution

**File**: `src/lib/layout/solver/push.ts`

```typescript
// Push blocks away from source in given direction
function pushBlocks(
  source: LayoutBlock,
  direction: ResizeDirection,
  blocks: LayoutBlock[],
  constraints: Map<string, BlockConstraints>
): { blocks: LayoutBlock[]; success: boolean };
```

### 2.6 Compact

**File**: `src/lib/layout/solver/compact.ts`

```typescript
// Reduce gaps by pulling blocks toward freed space
function compactLayout(
  blocks: LayoutBlock[],
  direction: ResizeDirection,
  constraints: Map<string, BlockConstraints>
): LayoutBlock[];
```

### 2.7 Main Solver

**File**: `src/lib/layout/solver/solve-layout.ts`

```typescript
type SolverOptions = {
  gridColumns: number;
  constraints: Map<string, BlockConstraints>;
};

function solveLayout(
  initialLayout: LayoutBlock[],
  intent: LayoutIntent,
  options: SolverOptions
): LayoutCandidate;
```

### Validation Point

- [ ] All solver unit tests pass
- [ ] Deterministic: same input → same output
- [ ] Handles edge cases: corner blocks, full rows, cascading pushes

---

## Milestone 3: UI Integration

**Goal**: Connect solver to interactions, live preview works.

### 3.1 Layout Editor Hook

**File**: `src/components/sheets/layout/use-layout-editor.ts`

```typescript
function useLayoutEditor(initialLayout: LayoutBlock[]) {
  // Manages editing session
  // - editingLayout: current mutable state
  // - interactionStartLayout: snapshot at drag/resize start
  // - candidateLayout: preview from solver
  // - commit/cancel functions
}
```

### 3.2 Snapshot Provider

**File**: `src/lib/layout/layout-snapshot-context.tsx`

```typescript
// Publish snapshots for consumers (heading nav, etc.)
const LayoutSnapshotContext = createContext<LayoutSnapshot | null>(null);

function LayoutSnapshotProvider({ children, snapshot }) { ... }
function useLayoutSnapshot(): LayoutSnapshot | null { ... }
```

### 3.3 New Drag Hook

**File**: `src/components/sheets/layout/use-card-drag-v2.ts`

- Captures pointer events
- Converts to grid coordinates
- Produces `MoveIntent`
- Calls solver
- Publishes candidate snapshot

### 3.4 New Resize Hook

**File**: `src/components/sheets/layout/use-card-resize-v2.ts`

- Detects resize direction from handle
- Tracks delta
- Produces `ResizeIntent` (with `compact` from Shift key)
- Calls solver
- Publishes candidate snapshot

### 3.5 New Keyboard Hook

**File**: `src/components/sheets/layout/use-card-keyboard-v2.ts`

- Handles existing keybindings
- Produces intents for move/resize
- Calls solver

### 3.6 Adapt Heading Navigation

**File**: `src/components/sheets/heading-nav.tsx` (or similar)

- Consume `useLayoutSnapshot()`
- Sort headings by snapshot positions
- Update live during interactions

### Validation Point

- [ ] Drag preview shows correct layout
- [ ] Resize preview shows pushes/compacts
- [ ] Keyboard move/resize works
- [ ] Heading nav updates live
- [ ] Interactions are reversible (preview recomputes from start)

---

## Milestone 4: Cutover & Cleanup

**Goal**: Remove old code, all tests pass, production ready.

### 4.1 Remove Old Files

Files to delete:
- `src/components/sheets/layout/layout-algorithms.ts`
- `src/components/sheets/layout/resize-calculations.ts`
- `src/components/sheets/layout/use-card-drag.ts`
- `src/components/sheets/layout/use-card-resize.ts`
- `src/components/sheets/layout/use-card-keyboard.ts`

### 4.2 Rename V2 Files

- `use-card-drag-v2.ts` → `use-card-drag.ts`
- `use-card-resize-v2.ts` → `use-card-resize.ts`
- `use-card-keyboard-v2.ts` → `use-card-keyboard.ts`

### 4.3 Update Exports

- Update `src/components/sheets/layout/index.ts`
- Remove old type exports, add new ones

### 4.4 Update Tests

- Remove tests for deleted files
- Ensure solver tests cover all edge cases
- Update E2E tests for new behavior

### 4.5 Final Verification

- [ ] `npm run build` succeeds
- [ ] `npm run lint` passes
- [ ] `npm run test` passes
- [ ] `npm run test:e2e` passes
- [ ] Manual testing: drag, resize, keyboard, persistence

---

## File Mapping

| Old File | Action | New File |
|----------|--------|----------|
| `layout-types.ts` | Keep + extend | Add `LayoutBlock`, `GridPosition` |
| `layout-algorithms.ts` | Delete | Replaced by `solver/*` |
| `resize-calculations.ts` | Delete | Replaced by `solver/push.ts`, `solver/compact.ts` |
| `layout-inference.ts` | Keep | Still needed for initial layouts |
| `layout-persistence.ts` | Adapt | Support new format, v4 migration |
| `use-layout-persistence.ts` | Adapt | Use new types |
| `use-card-drag.ts` | Delete | `use-card-drag-v2.ts` |
| `use-card-resize.ts` | Delete | `use-card-resize-v2.ts` |
| `use-card-keyboard.ts` | Delete | `use-card-keyboard-v2.ts` |
| `card-navigation.ts` | Keep | Reuse for focus navigation |
| `auto-scroll.ts` | Keep | Reuse for drag scrolling |
| `block-types/*` | Keep | Reuse renderers, adapt constraints |

---

## Test Strategy

### Milestone 1
- Unit tests for migration functions
- Manual: app loads, displays correctly

### Milestone 2
- Unit tests for each solver module
- Property tests: determinism, idempotence
- Edge cases: boundaries, full grid, cascading

### Milestone 3
- Integration tests: hooks produce correct intents
- Manual: interactions work as expected

### Milestone 4
- Full test suite passes
- E2E tests cover key scenarios

---

## Decisions Made

| Question | Decision |
|----------|----------|
| Resize intent format | Option A: single `delta` + `direction` |
| Solver location | `src/lib/layout/solver/` |
| Diagonal resize | Not supported in UI, maybe later internally |
| Compacting during resize | Only when Shift held (mouse) or Ctrl+Shift (keyboard) |
| Blocked state | Stop at max achievable position, don't fail |
| Drag vertical limit | Relative to start position (`block.h * 3`) |
| Coexistence | V2 code lives in parallel until cutover |
