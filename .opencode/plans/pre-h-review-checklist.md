# Pre-Phase-H Manual Review Checklist

Working document. Tick items as you verify them. Append observations in
the "Findings" section per scope. After each section, I (assistant)
classify each finding as:

- `BUG` — broken behaviour, needs fix before Phase H
- `POLISH` — works but suboptimal UX/visual
- `KNOWN` — already tracked elsewhere (link to plan)
- `H` — naturally resolved by Phase H (undo/redo)
- `DEFER` — punt to post-H

Branch: `feature/layout-v3` @ `c44cefb`. Dev server: `npm run dev` →
`localhost:3000`. Test fixture content via `npm run dev:test` if needed.

## Conventions while testing

- Try each binding from BOTH defaults (e.g. `h` AND `ArrowLeft` where both exist).
- Repeat each scope test on at least 2 different cheatsheets to spot YAML-specific quirks.
- Resize viewport between 1080px and 720px to catch breakpoint regressions.
- Keep DevTools open: watch console for warnings/errors during every action.
- After every layout edit: refresh once and verify persistence survived.

---

## 1. Home page (scope: `home`)

- [ ] Page loads with hex board visible, search input present
- [ ] `h` / `ArrowLeft` — move selection left (cross-row at edges?)
- [ ] `l` / `ArrowRight` — move selection right
- [ ] `k` / `ArrowUp` — move selection up (cross-category at top edge)
- [ ] `j` / `ArrowDown` — move selection down (cross-category at bottom edge)
- [ ] `/` — focus search input
- [ ] `Escape` (while search focused) — clear + blur search
- [ ] `i` — show info modal for selected cheatsheet
- [ ] `Enter` — open selected cheatsheet
- [ ] Contextual inline help reads "Home" surface; updates if search focused (input scope inert here?)
- [ ] Settings (`,`) and Help (`?`) reachable from home
- [x] ~~Pre-existing flaky test: `home-navigation.spec.ts:137`~~ — verified 2025-05: 105/105 full suite + 10/10 isolated, no longer flaky

### Findings (home)

_(empty)_

---

## 2. Info modal (scope: `info`)

Opened with `i` from home.

- [ ] Modal opens centered, traps focus
- [ ] Modal scope active in inline help (or fallback to default — check)
- [ ] `Escape` — closes modal, returns focus to home selection
- [ ] Background scroll locked while open
- [ ] Click outside — closes? (verify intentional behavior)

### Findings (info)

_(empty)_

---

## 3. Cheatsheet page (scope: `sheet`)

Open any cheatsheet (e.g. `git`).

- [ ] Layout renders, headings visible, no flash of unstyled content
- [ ] `h/j/k/l` and arrows — move selection across cards
- [ ] Heading nav sidebar order matches visual Y order
- [ ] `b` — back to home
- [ ] `c` — copy command (does it require selection? what's copied?)
- [ ] `e` — show example (modal opens?)
- [ ] `Escape` — clear command focus / exit current state
- [ ] `Shift+R` — reset layout (floating button appears only when modified)
- [ ] `?` — opens help modal
- [ ] `s` — opens settings panel
- [ ] `Ctrl+M` — enters layout mode (verify `LayoutModePill` appears top-right)
- [ ] `Ctrl+Shift+D` — toggles dev mode (dev bar appears)
- [ ] Floating reset button: only visible when layout differs from original
- [ ] Heading navigation reflects live order after a layout edit (drag a heading, check sidebar)

### Findings (sheet)

_(empty)_

---

## 4. Drag & resize (mouse, in `sheet` scope without layout mode)

- [ ] Drag card by handle — block moves, others reflow according to engine rules
- [ ] Drag card UP into heading — heading shifts up (push) before shrinking
- [ ] Drag card UP into another card — card above shrinks/pushes correctly
- [ ] Drag heading DOWN — pushes blocks down; if grid bottom reached, wraps south
- [ ] Resize handle E/W/N/S — block grows/shrinks; chain blocks respond
- [ ] Resize against grid limit — UI freezes at last valid state, no reset
- [ ] Release mouse mid-drag — final position commits, no orphan preview
- [ ] Quick successive drags — no scope race, no missed events
- [ ] Refresh after drag — layout persisted

### Findings (drag-resize)

_(empty)_

---

## 5. Layout mode — master (scope: `layout`)

Enter with `Ctrl+M`.

- [ ] `LayoutModePill` shows current sub-mode (initial: navigation)
- [ ] Focused card highlight color matches sub-mode
- [ ] First focus = card nearest cursor at entry
- [ ] `n` — switch to navigation sub-mode
- [ ] `m` — switch to move sub-mode
- [ ] `b` — switch to resize sub-mode
- [ ] `Escape` — exits layout mode entirely (or exits sub-mode first then master? verify)
- [ ] `Enter` — commits buffered changes (Phase FA)
- [ ] `Shift+R` (or LAYOUT_RESET combo) — resets to original
- [ ] Settings/help still reachable from layout mode (Phase FA polish `c5b327f`)
- [ ] Inline help shows correct scope (`layout` or active sub-scope)
- [ ] Pill change counter (`d0b0c66`) increments on each commit

### Findings (layout-master)

_(empty)_

---

## 6. Layout navigation sub-mode (scope: `layout-navigation`)

- [ ] `h/j/k/l` and arrows — move focus across cards
- [ ] No move/resize happens (purely focus shift)
- [ ] Viewport scrolls to follow focused card (`scrollIntoView nearest smooth`)
- [ ] `m` / `b` switches sub-mode without losing focus
- [ ] `Escape` — exit
- [ ] Inline help reflects nav scope

### Findings (layout-nav)

_(empty)_

---

## 7. Layout move sub-mode (scope: `layout-move`)

- [ ] `h/j/k/l` — move focused card by 1 grid unit
- [ ] `Alt+h/j/k/l` (strict) — move without pushing neighbors? Verify exact semantics
- [ ] Move into a heading — heading pushes correctly
- [ ] Move into wall — block freezes at limit
- [ ] South wrap triggers when moving past grid bottom
- [ ] `n` / `b` switches sub-mode
- [ ] Visual feedback distinct from navigation sub-mode
- [ ] Each keystroke commits to buffer (FA model)

### Findings (layout-move)

_(empty)_

---

## 8. Layout resize sub-mode (scope: `layout-resize`)

Note: post-`2250169`, the arrow indicates the EDGE that moves.

- [ ] `h/j/k/l` (grow) — edge moves in arrow direction, block grows
- [ ] `Shift+h/j/k/l` (shrink) — edge moves in arrow direction, block shrinks (inverted post-`2250169`)
- [ ] `Alt+...` (strict grow) — no neighbor push, block stops at neighbor edge
- [ ] `Alt+Shift+...` (strict shrink) — verify exists
- [ ] `Ctrl+Shift+...` (shrink compact) — block shrinks AND neighbors absorb the freed space
- [ ] Resize against grid limit — engine clamps, no reset
- [ ] Cascade resize: A grows → B shrinks → C shrinks until limits
- [ ] `n` / `m` switches sub-mode

### Findings (layout-resize)

_(empty)_

---

## 9. Buffered keyboard (Phase FA) — interplay with layout mode

- [ ] Enter layout mode, make several edits — pill shows pending count
- [ ] `Enter` commits buffer to saved state
- [ ] `Escape` — silent discard (Phase FA4)
- [ ] `Escape` after explicit "dirty" threshold — `LayoutDiscardConfirm` modal appears (verify trigger condition)
- [ ] Modal: confirm discards buffer; cancel returns to layout mode
- [ ] Mouse click outside layout mode while buffered — discards buffer (Phase FA6 `9a442b5`)
- [ ] Refresh during buffered state — verify what persists vs discards (spec says buffer is transient)

### Findings (buffered)

_(empty)_

---

## 10. Developer mode (scope: `dev`)

Toggle with `Ctrl+Shift+D`. Internal `Debug*` recorder, UI `Dev*` bar.

- [ ] Dev bar appears at top/bottom of viewport
- [ ] `s` — save layout to `.layout.json` (action `DEV_SAVE_LAYOUT`)
- [ ] `r` — reset layout (dev action, NOT recording — verify no clash)
- [ ] Toggle recording — which combo? Verify against keybindings.ts:725
- [ ] `l` — toggle logs sub-mode (verify)
- [ ] `x` or similar — enter axes sub-mode (verify)
- [ ] `Ctrl+Shift+D` — exits dev mode entirely

### Findings (dev)

_(empty)_

---

## 11. Dev logs sub-mode (scope: `dev-logs`)

- [ ] Panel opens listing recorded sessions
- [ ] `j/k` and arrows — cursor down/up
- [ ] `c` — copy filename
- [ ] `d` — delete entry (verify combo)
- [ ] Delete-all binding works and confirms?
- [ ] `r` — refresh list
- [ ] `Escape` — close logs

### Findings (dev-logs)

_(empty)_

---

## 12. Dev axes sub-mode (scope: `dev-axes`)

- [ ] Grid axes overlay visible
- [ ] `h/j/k/l` and arrows — cursor movement on axes
- [ ] `Space` / `Enter` — toggle column pin
- [ ] `Shift+Space` / `Shift+Enter` — toggle row pin
- [ ] `c` — clear all pinned
- [ ] `Escape` — exit axes

### Findings (dev-axes)

_(empty)_

---

## 13. Settings panel (scope: `settings`)

Open with `s` from home or sheet.

- [ ] Slide-in from right, ~66vw, full height
- [ ] At 1080px: 3-col layout for UI fields
- [ ] At 720px: drops to fewer cols (verify breakpoints 3/2/1)
- [ ] Tabs: UI | Keybindings
- [ ] Keybindings sub-tabs: Global, Home, Cheatsheet, Layout Mode, Developer (verify section-based editor)
- [ ] Active tab + sub-tab persist across reload
- [ ] UI reset button works (per-section?)
- [ ] Keybindings reset button works; intentional overlaps preserved (`9ec1326`, `c146d4a`)
- [ ] Bulk `resetActions` brute void; single `resetAction` works
- [ ] Record a new combo: capture works, conflicts reported with scope-local detection
- [ ] Intentional intra-scope overlap NOT reported as conflict
- [ ] Tab navigation (Tab/Shift+Tab) cycles through fields
- [ ] Arrow keys navigate between tabs
- [ ] `Escape` — close panel

### Findings (settings)

_(empty)_

---

## 14. Help modal (scope: `help`)

Open with `?`.

- [ ] Modal centered, traps focus
- [ ] Tabs: Shortcuts | Layout | Developer | Legend
- [ ] Layout tab has nested sub-tabs (Enter/Nav/Move/Resize/Reset per `cb95ab8`)
- [ ] Developer tab has nested sub-tabs (top-level / logs / axes)
- [ ] Arrows / Tab navigate tabs
- [ ] `Enter` activates focused tab
- [ ] `KeybindingChart` rows display combos correctly (no stale customizations)
- [ ] After changing a binding in settings, help reflects the new value
- [ ] Legend tab shows symbol explanations
- [ ] `Escape` — closes

### Findings (help)

_(empty)_

---

## 15. Cheat command modals (`cheat-info-modal`, `cheat-copy-modal`)

Triggered from sheet card `e` / `c` (?) — verify entry points.

- [ ] Info modal: `j/k` move, `c` copy, `Escape` close
- [ ] Copy modal with placeholders: `j/k` move between fields, Enter submit, Escape cancel
- [ ] Placeholder escaping (see `docs/placeholders.md`)
- [ ] Background sheet remains inert while modal open

### Findings (cheat-modals)

_(empty)_

---

## 16. Cross-cutting concerns

- [ ] No `Ctrl+Shift+R` collisions (reserved by browser)
- [ ] All inline hints show ONLY primary combo; `Shift+Click` promotes alternates
- [ ] Inline hint separator is `, ` and `or` (e.g. `A, B, C or D`)
- [ ] Section titles lowercase modifier ("Move strict", not "Move Strict")
- [ ] No emoji anywhere in UI (project convention)
- [ ] Console warnings/errors absent during normal flows
- [ ] Pre-existing TS errors only in `yaml-cheatsheets.integration.test.ts` and `keyboard-dispatch.test.ts`
- [ ] No layout overlap reported by `findConflict` for intentional overlaps
- [ ] Browser back/forward preserves state correctly
- [ ] LocalStorage keys: `oh-my-refcardz:keybindings`, `oh-my-refcardz:ui-settings`, layouts

### Findings (cross-cutting)

_(empty)_

---

## 17. Visual polish & responsiveness

- [ ] Color modes (light/dark) — every scope tested
- [ ] Border on/off setting affects all relevant blocks
- [ ] Direction setting (LTR/RTL?) — verify if exists
- [ ] Random feature works as documented
- [ ] Hex board on home renders correctly across sizes
- [ ] No CSS shifts on hydration
- [ ] Font/spacing consistent in `KeybindingChart` cells

### Findings (visual)

_(empty)_

---

## Triage summary

Filled by assistant after you complete a section. Format:

| ID | Scope | Description | Class | Action |
|----|-------|-------------|-------|--------|
|    |       |             |       |        |
