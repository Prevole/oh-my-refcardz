# Layout V2 Bug Fixes Plan

This document tracks the bugs and improvements identified during manual testing of the Layout V2 system.

> **Status note (Phase A audit, branch `feature/layout-v3`)**
>
> The canonical roadmap for finishing this work is now
> [`layout-v3-completion.md`](./layout-v3-completion.md). This document
> is preserved for historical context and the original bug numbering,
> but the per-bug tracking below has been updated to reflect what is
> actually done in `feature/layout-v3`.
>
> The V2 engine rewrite (commit `52c77fa`) replaced the `solver/`
> module entirely; references below to `src/lib/layout/solver/*.ts`
> are obsolete file paths. The semantics those files described now
> live in `src/lib/layout/engine/step.ts` and `wrap.ts`.

## Summary

| Phase | Description | Status |
|-------|-------------|--------|
| 1 | Solver core: push vs shrink behavior | Done — addressed at engine level (commits `143ef35`, `b415f5b`, `cd7d62e`, `cdc6a01`, `341b584`); bug 1.4 verified in Phase B (engine clamps to last valid state by design; integration tests added) |
| 2 | Snapshot & heading navigation | Pending — `feature/layout-v3` Phase C |
| 3 | Keyboard behavior overhaul | Pending — supersedes flat scheme with Zellij modal model (see [`layout-v3-completion.md`](./layout-v3-completion.md) Phase E and `docs/layout-actions.md`) |
| 4 | UI polish & persistence model | Partial — Save / Reset done in dev bar; buffer-vs-saved semantics, indicator, compact mode, focus near cursor pending (Phases D + E.5 + F) |

---

## Phase 1: Solver Core (Push vs Shrink)

### Problem Statement

The current solver shrinks blocks before attempting to push them. The expected behavior is:
1. **Push first** in the direction of movement
2. **Shrink only** if the block cannot be pushed (e.g., already at grid boundary)

### Bugs to Fix

| Bug | Description | Expected Behavior | Status |
|-----|-------------|-------------------|--------|
| 1.1 | Dragging card up resizes heading above | Heading should move up first, shrink only if at y=0 | Done — `341b584` ("shrinks a mid-chain member instead of wrapping the saturated tail") |
| 1.2 | Dragging card up moves card above to below | Card above should shrink first (if at y=0), then displaced | Done — `b415f5b` ("places shrunk-then-wrapped blocks on their initial X column"), `341b584` |
| 1.3 | Heading shrinks before moving when pushed down | Heading should move down first, shrink at grid bottom | Done — covered by the same engine ordering fixes |
| 1.4 | Resize resets when limit reached | UI should freeze at last valid state | Done — verified in Phase B. The engine's snapshot+recalc design means each pointer move replays from the initial snapshot with the cumulative delta, and `applyOperation` returns the largest partial application when the limit is hit. The UI consequently freezes at the last valid state and resumes seamlessly when the cursor backs off. Covered by two integration tests in `engine.integration.test.ts` ("Engine integration: resize against grid limit"). |
| 1.5 | Resize cascade doesn't work for multiple blocks | Chain of blocks should all resize/push correctly | Done — `143ef35`, `b415f5b`, `cd7d62e`, `cdc6a01`, `341b584` (8 integration tests in `engine.integration.test.ts`) |

### Root Cause Analysis

The `pushBlocks` function in `src/lib/layout/solver/push.ts` currently:
1. Tries to push blocks
2. If blocked by grid boundary, shrinks them

The issue is that shrinking happens too eagerly. The logic should be:
1. Compute impact set (all blocks that would be affected)
2. Sort by direction (furthest first)
3. For each block:
   - Try to push in direction
   - If at grid boundary AND cannot fit, shrink
   - If shrink reaches minSize AND still blocked, the move is blocked

### Files to Modify

- `src/lib/layout/solver/push.ts` — rewrite push logic
- `src/lib/layout/solver/solve-layout.ts` — handle blocked state properly (return last valid layout)
- `src/lib/layout/solver/push.test.ts` — update tests for new behavior

### Acceptance Criteria

- [x] Dragging a card into a heading pushes the heading up (if space) before shrinking — engine-level, covered by integration tests
- [x] Dragging a card into another card pushes/shrinks correctly based on available space
- [x] When resize limit is reached, UI freezes at last valid position — verified in Phase B (engine-level contract + integration tests)
- [x] Cascade resize works: A expands → B shrinks → C shrinks → ... until limits

---

## Phase 2: Snapshot & Heading Navigation

### Problem Statement

The heading navigation sidebar doesn't update when blocks are moved/resized.

### Bugs to Fix

| Bug | Description | Expected Behavior |
|-----|-------------|-------------------|
| 2.1 | Heading nav order doesn't update after move | Order should reflect current Y positions |

### Root Cause Analysis

Possible causes:
1. `LayoutSnapshotProvider` not wrapping the heading nav component
2. Heading nav not consuming `useLayoutSnapshot()`
3. Snapshot not being updated correctly during interactions

### Files to Investigate

- `src/app/cheatsheets/[slug]/sheet-heading-navigation.tsx`
- `src/components/sheets/sheet-renderer.tsx` — verify LayoutSnapshotProvider scope
- `src/lib/layout/layout-snapshot-context.tsx`

### Acceptance Criteria

- [ ] Heading nav updates order when headings are moved via drag
- [ ] Heading nav updates order when headings are moved via keyboard
- [ ] Order updates in real-time during drag (preview), not just on commit

---

## Phase 3: Keyboard Behavior Overhaul

### Problem Statement

The keyboard interaction model needs significant changes:
1. Preview mode instead of immediate commit ~~ — superseded
2. Proper viewport following
3. New keybinding scheme
4. Compact mode toggle

> **Decision update (`feature/layout-v3`)** : the flat keybinding
> scheme described below is **superseded** by the **Zellij modal
> model** specified in `docs/layout-actions.md`. The "preview with
> Enter=commit / Escape=cancel" interaction is also superseded by an
> **immediate-commit Vim-style** model. Bug numbering 3.1 → 3.6 is
> preserved but the resolution path is now Phase E of
> [`layout-v3-completion.md`](./layout-v3-completion.md).

### Bugs to Fix

| Bug | Description | Expected Behavior | Status |
|-----|-------------|-------------------|--------|
| 3.1 | Viewport doesn't follow keyboard navigation | View should scroll to focused card | Pending — Phase E.7 |
| 3.2 | Move doesn't push blocks back when reversed | ~~Preview should recompute from start state~~ Each keystroke commits; undo handled by history (Phase H) | Pending — Phase E + H |
| 3.3 | Escape doesn't cancel keyboard edit | `Escape` exits the active layout sub-mode | Pending — Phase E.1 |
| 3.4 | Resize keybindings are confusing | Zellij `r` sub-mode with `h/j/k/l` (+ `Shift` to shrink, `Alt` strict, `Ctrl` compact) | Pending — Phase E.2 |
| 3.5 | Enter doesn't validate keyboard changes | Obsolete: no commit boundary in immediate-commit model | Resolved by design |
| 3.6 | Focus should start near cursor position | Track mouse position for initial focus | Pending — Phase E.5 |

### New Keybinding Scheme (~~superseded by Zellij — kept for history~~)

| Action | Binding | Notes |
|--------|---------|-------|
| Navigate between cards | ~~`Shift + Arrow`~~ | Replaced by Zellij `n` sub-mode |
| Move card | ~~`Alt + Arrow`~~ | Replaced by Zellij `m` sub-mode |
| Grow card | ~~`Alt + Shift + Arrow`~~ | Replaced by Zellij `r` sub-mode (bare key = grow) |
| Shrink card | ~~`Cmd + Shift + Arrow`~~ | Replaced by Zellij `r` sub-mode (`Shift` flips sense) |
| Toggle compact mode | ~~`c`~~ | Replaced by `Ctrl` modifier in `r` sub-mode |
| Commit changes | ~~`Enter`~~ | Removed: immediate-commit model |
| Cancel changes | ~~`Escape`~~ | Repurposed: exits sub-mode (Phase H provides undo) |

See `docs/layout-actions.md` for the authoritative Zellij mapping.

### Keyboard Interaction Model

Current (broken):
```
Focus card → Each keystroke commits immediately → No preview → No cancel
```

~~Original new model (preview-based, superseded):~~
```
Focus card → Start interaction → Preview changes → Enter=commit / Escape=cancel
```

**Adopted model (Vim/Zellij):**
```
Ctrl+M → enter "layout" master mode
  n / m / r → enter sub-mode (navigation / move / resize)
  bare keys → drive the engine; each keystroke commits immediately
  Escape → exit sub-mode (or master mode)
  Ctrl+Z (Phase H) → undo last keystroke
```

### Files to Modify

- `src/lib/keybindings.ts` — replace `CARD_*` action IDs with `LAYOUT_*` set (see Phase E.2)
- ~~`src/components/sheets/layout/use-card-keyboard-v2.ts`~~ — to be **deleted** (Phase E.3); replaced by new modal hook
- `src/components/sheets/sheet-renderer.tsx` — wire master-mode entry and indicators (Phase E.6)
- `src/components/sheets/layout/use-layout-editor.ts` — expose imperative API for each commit (no preview)

### Acceptance Criteria (revised)

- [ ] Viewport scrolls to follow focused card (3.1)
- [ ] Moving card and then back returns to a structurally identical layout (3.2)
- [ ] Escape exits the current sub-mode without side-effects (3.3)
- [ ] Resize sub-mode `r` works with bare key = grow, `Shift` = shrink, `Alt` = strict, `Ctrl` = compact (3.4)
- [ ] No preview mode: each keystroke commits (3.5 resolved by design)
- [ ] First keyboard focus targets card nearest to cursor (3.6)
- [ ] Old `CARD_*` IDs removed, no leftover bindings in localStorage (Phase E.3)

---

## Phase 4: UI Polish & Persistence Model

### Problem Statement

The current persistence model auto-saves to localStorage. The spec requires:
- **Explicit Save button** to persist layout to `.layout.json` files
- **localStorage as buffer** for temporary changes
- **Reset button** to reload from JSON files and clear buffer

### 4.1 New Persistence Model

**Current behavior (`feature/layout-v3`):**
```
Edit → Auto-save to localStorage (buffer) → Save (Ctrl+Shift+S) writes to .layout.json
                                          → Reset reloads YAML + clears buffer
```

> **Decision update (`feature/layout-v3`)** : the original spec asked
> to *remove* auto-save to localStorage. The adopted model is
> **Vim-style** instead: every change writes to localStorage
> immediately (buffer = transient state). The "Save" button (already
> implemented as `LAYOUT_DEV_SAVE` / `Ctrl+Shift+S`) writes to
> `.layout.json` explicitly. This matches both user expectations
> (survive page close without effort) and the new keyboard model
> (each keystroke commits).

**Key changes:**
1. ~~Remove auto-save to localStorage on every edit~~ — keep it (Vim model)
2. Add explicit "Save Layout" button — Done (in dev bar, `LAYOUT_DEV_SAVE`)
3. Keep "Reset Layout" button — Done (in dev bar)
4. localStorage acts as a persistent buffer
5. Indicator showing "unsaved changes" when buffer differs from JSON — **Pending (Phase D.2)**

### 4.2 Compact Mode Indicator

Visual feedback when compact mode is active:
- Badge or icon in toolbar
- Different highlight color on focused card
- ~~Reset on Enter/Escape~~ — not applicable in immediate-commit model

Pending — handled within Phase E.6 (keyboard).

### 4.3 Focus Near Cursor

Track mouse position and use it to determine which card to focus when entering keyboard mode.

Pending — Phase E.5.

### Files to Modify

- `src/components/sheets/layout/use-layout-persistence.ts` — rename `hasSavedLayout` → `hasUnsavedChanges` (Phase D.1); add debounce during active drag if needed (D.4)
- `src/components/sheets/sheet-renderer.tsx` — add unsaved indicator (D.2), compact indicator (Phase E.6)
- ~~`src/components/sheets/layout/use-card-keyboard-v2.ts`~~ — replaced by new modal hook (Phase E)
- `src/components/sheets/cheatsheet-rendering.module.css` — compact mode + unsaved indicator styles

### Acceptance Criteria

- [x] ~~No auto-save to localStorage on each edit~~ → superseded: auto-save kept (Vim model)
- [x] Save button visible and functional (dev only) — done in dev bar
- [x] Reset button clears localStorage and reloads JSON — done in dev bar
- [ ] "Unsaved changes" indicator when buffer differs from saved (Phase D.2)
- [ ] Compact mode shows visual indicator (Phase E.6)
- [ ] First focus targets card nearest cursor (Phase E.5)

---

## Implementation Order

1. **Phase 1** (highest priority): Fix solver core behavior
   - This affects all interactions (mouse and keyboard)
   - Must be fixed before other phases make sense

2. **Phase 2**: Fix heading navigation
   - Quick win, isolated fix
   - Improves UX immediately

3. **Phase 3**: Keyboard overhaul
   - Largest scope
   - Can be done incrementally

4. **Phase 4**: Polish & Persistence
   - Persistence model change
   - Nice-to-have improvements

---

## Testing Strategy

### Phase 1 Tests
- Unit tests for push.ts with new behavior
- Integration tests for resize cascade
- Manual: drag card into heading at y=0

### Phase 2 Tests
- Manual: move headings, verify nav updates

### Phase 3 Tests
- Unit tests for new keybinding matches
- Manual: full keyboard workflow

### Phase 4 Tests
- Manual: save button, unsaved indicator, compact indicator
- Manual: reset clears localStorage

---

## Decisions Made

| Question | Decision |
|----------|----------|
| Push vs Shrink | Push first in direction, shrink only at grid boundary |
| Resize blocked | Return last valid layout, freeze UI |
| Keyboard mode | Preview mode with Enter=commit, Escape=cancel |
| Nav keybinding | Keep Shift+Arrow for navigation |
| Move keybinding | Keep Alt+Arrow for move |
| Grow keybinding | Alt+Shift+Arrow (grow in arrow direction) |
| Shrink keybinding | Cmd+Shift+Arrow (shrink from arrow direction) |
| Compact toggle | 'c' key with visual indicator |
| Persistence | localStorage as buffer, explicit Save button for files |
| Focus start | Near cursor position (must-have) |

---

## Notes

- The `syncLayoutToDev` function exists for saving to files in dev mode
- All changes should maintain backward compatibility with existing saved layouts
- localStorage buffer allows recovering work after accidental page close
