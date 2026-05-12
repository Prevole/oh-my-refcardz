# Layout V2 Bug Fixes Plan

This document tracks the bugs and improvements identified during manual testing of the Layout V2 system.

## Summary

| Phase | Description | Status |
|-------|-------------|--------|
| 1 | Solver core: push vs shrink behavior | Pending |
| 2 | Snapshot & heading navigation | Pending |
| 3 | Keyboard behavior overhaul | Pending |
| 4 | UI polish & persistence model | Pending |

---

## Phase 1: Solver Core (Push vs Shrink)

### Problem Statement

The current solver shrinks blocks before attempting to push them. The expected behavior is:
1. **Push first** in the direction of movement
2. **Shrink only** if the block cannot be pushed (e.g., already at grid boundary)

### Bugs to Fix

| Bug | Description | Expected Behavior |
|-----|-------------|-------------------|
| 1.1 | Dragging card up resizes heading above | Heading should move up first, shrink only if at y=0 |
| 1.2 | Dragging card up moves card above to below | Card above should shrink first (if at y=0), then displaced |
| 1.3 | Heading shrinks before moving when pushed down | Heading should move down first, shrink at grid bottom |
| 1.4 | Resize resets when limit reached | UI should freeze at last valid state |
| 1.5 | Resize cascade doesn't work for multiple blocks | Chain of blocks should all resize/push correctly |

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

- [ ] Dragging a card into a heading pushes the heading up (if space) before shrinking
- [ ] Dragging a card into another card pushes/shrinks correctly based on available space
- [ ] When resize limit is reached, UI freezes at last valid position
- [ ] Cascade resize works: A expands → B shrinks → C shrinks → ... until limits

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
1. Preview mode instead of immediate commit
2. Proper viewport following
3. New keybinding scheme
4. Compact mode toggle

### Bugs to Fix

| Bug | Description | Expected Behavior |
|-----|-------------|-------------------|
| 3.1 | Viewport doesn't follow keyboard navigation | View should scroll to focused card |
| 3.2 | Move doesn't push blocks back when reversed | Preview should recompute from start state |
| 3.3 | Escape doesn't cancel keyboard edit | Should cancel and revert to start state |
| 3.4 | Resize keybindings are confusing | Need 4 directional grow + 4 directional shrink |
| 3.5 | Enter doesn't validate keyboard changes | Should commit and exit edit mode |
| 3.6 | Focus should start near cursor position | Track mouse position for initial focus |

### New Keybinding Scheme

| Action | Binding | Notes |
|--------|---------|-------|
| Navigate between cards | `Shift + Arrow` | Existing, keep |
| Move card | `Alt + Arrow` | Existing, keep |
| Grow card | `Alt + Shift + Arrow` | New: grow in arrow direction |
| Shrink card | `Cmd + Shift + Arrow` | New: shrink from arrow direction |
| Toggle compact mode | `c` | New: visual indicator needed |
| Commit changes | `Enter` | New |
| Cancel changes | `Escape` | Fix: should actually cancel |

### Keyboard Interaction Model

Current (broken):
```
Focus card → Each keystroke commits immediately → No preview → No cancel
```

New model:
```
Focus card → Start interaction → Preview changes → Enter=commit / Escape=cancel
```

### Files to Modify

- `src/lib/keybindings.ts` — update ACTION_IDS and DEFAULT_KEYBINDINGS
- `src/components/sheets/layout/use-card-keyboard-v2.ts` — implement preview mode
- `src/components/sheets/sheet-renderer.tsx` — add compact mode indicator
- `src/components/sheets/layout/use-layout-editor.ts` — keyboard interaction support

### Acceptance Criteria

- [ ] Viewport scrolls to follow focused card
- [ ] Moving card down then up returns to original position
- [ ] Escape reverts all pending keyboard changes
- [ ] Enter commits pending keyboard changes
- [ ] New keybindings work as specified
- [ ] Compact mode toggle works with visual indicator
- [ ] First keyboard focus targets card nearest to cursor

---

## Phase 4: UI Polish & Persistence Model

### Problem Statement

The current persistence model auto-saves to localStorage. The spec requires:
- **Explicit Save button** to persist layout to `.layout.json` files
- **localStorage as buffer** for temporary changes
- **Reset button** to reload from JSON files and clear buffer

### 4.1 New Persistence Model

**Current behavior (to change):**
```
Edit → Auto-save to localStorage → No explicit save
```

**New behavior:**
```
Edit → Buffer in localStorage → Save button commits to .layout.json
                              → Reset button reloads JSON + clears localStorage
```

**Key changes:**
1. Remove auto-save to localStorage on every edit
2. Add explicit "Save Layout" button (dev only: writes to .layout.json)
3. Keep "Reset Layout" button (reloads from JSON, clears localStorage)
4. localStorage used only as temporary buffer (survives page reload)
5. Indicator showing "unsaved changes" when localStorage differs from JSON

### 4.2 Compact Mode Indicator

Visual feedback when compact mode is active:
- Badge or icon in toolbar
- Different highlight color on focused card
- Reset on Enter/Escape

### 4.3 Focus Near Cursor

Track mouse position and use it to determine which card to focus when entering keyboard mode.

### Files to Modify

- `src/components/sheets/layout/use-layout-persistence.ts` — remove auto-save, add explicit save
- `src/components/sheets/sheet-renderer.tsx` — add save button, unsaved indicator, compact indicator
- `src/components/sheets/layout/use-card-keyboard-v2.ts` — cursor position tracking
- `src/components/sheets/cheatsheet-rendering.module.css` — compact mode styles, unsaved indicator styles

### Acceptance Criteria

- [ ] No auto-save to localStorage on each edit
- [ ] Save button visible and functional (dev only)
- [ ] Reset button clears localStorage and reloads JSON
- [ ] "Unsaved changes" indicator when buffer differs from saved
- [ ] Compact mode shows visual indicator
- [ ] First focus targets card nearest cursor

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
