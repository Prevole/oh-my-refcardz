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

- [x] Page loads with hex board visible, search input present
- [x] `h` / `ArrowLeft` — move selection left (cross-row at edges?)
- [x] `l` / `ArrowRight` — move selection right
- [x] `k` / `ArrowUp` — move selection up (cross-category at top edge)
- [x] `j` / `ArrowDown` — move selection down (cross-category at bottom edge)
- [x] `/` — focus search input
- [x] `Escape` (while search focused) — clear + blur search
- [x] `i` — show info modal for selected cheatsheet
- [x] `Enter` — open selected cheatsheet
- [x] Contextual inline help reads "Home" surface; updates if search focused (input scope inert here?)
- [x] Settings (`,`) and Help (`?`) reachable from home
- [x] ~~Pre-existing flaky test: `home-navigation.spec.ts:137`~~ — verified 2025-05: 105/105 full suite + 10/10 isolated, no longer flaky

### Findings (home)

- H-1 (POLISH, fixed): browser focus ring on hex cards replaced by [data-selected] affordance via onFocus → setSelectedIndex + outline:none on .hexCard:focus-visible
- H-2 (KNOWN, resolved): legacy flaky test note removed — no longer reproduces

---

## 2. Info modal (scope: `info`)

Opened with `i` from home.

- [x] Modal opens centered, traps focus
- [x] Modal scope active in inline help (or fallback to default — check)
- [x] `Escape` — closes modal, returns focus to home selection
- [x] Background scroll locked while open
- [x] Click outside — closes? (verify intentional behavior)

### Findings (info)

- All checks green. `i` and `Escape` both close (combos defined together for INFO_CLOSE). Backdrop click closes via Modal.tsx onClick on outer div.

---

## 3. Cheatsheet page (scope: `sheet`)

Open any cheatsheet (e.g. `git`).

- [x] Layout renders, headings visible, no flash of unstyled content
- [x] `h/j/k/l` and arrows — move selection across cards
- [x] Heading nav sidebar order matches visual Y order
- [x] `Backspace` / `Escape` — back to home (action `BACK_TO_HOME`)
- [x] `y` — copy command (vim yank; needs a focused command card?)
- [x] `i` — show example / details (modal opens?)
- [x] `Escape` — clear command focus / exit current state (also bound to back-to-home; intentional overlap)
- [x] `Shift+R` — reset layout (floating button appears only when modified)
- [x] `?` — opens help modal
- [x] `,` — opens settings panel
- [x] `Ctrl+M` — enters layout mode (verify `LayoutModePill` appears top-right)
- [x] `Ctrl+Shift+D` — toggles dev mode (dev bar appears)
- [x] Floating reset button: only visible when layout differs from original
- [x] Heading navigation reflects live order after a layout edit (drag a heading, check sidebar)

### Findings (sheet)

- **Fix S-1 (applied)** — `?` and `,` did not work from inside `dev` mode because the `dev` scope is modal and shadows the `global` bindings. Implemented **piste A** in `src/lib/keyboard-dispatch.ts`: new `UNIVERSAL_ACTION_IDS = [TOGGLE_HELP, TOGGLE_SETTINGS]` resolved in a pre-pass before the scope cascade. Unit tests added in `src/lib/keyboard-dispatch.test.ts` (5 new tests, 21/21 green). Docs updated in `docs/keybindings.md` ("Universal actions" subsection). `dev` scope stays `modal: true` so `Escape` still closes dev cleanly instead of cascading to `BACK_TO_HOME`.
- **Fix S-1b (applied)** — Side-effect of S-1: opening Help (`?`) from inside `cheat-info-modal`/`cheat-copy-modal` rendered Help **behind** the info/copy overlay. Root cause: shared `Modal` (used by Help) had Tailwind `z-30` while cheat command modals use `--z-modal` (=100). Promoted the shared `Modal` overlay to `--z-popover` (=150) via a new `.overlay` class in `src/components/ui/modal.module.css` so Help always layers above any open `--z-modal` surface. Behavior of `,` reaching Settings into an existing modal is acceptable as-is (Settings overlay uses `--z-toast` and was already above).
- **Fix S-1c (applied)** — Side-effect of S-1: Help and Settings could be open simultaneously, with Settings (`--z-toast` = 200) always rendering above Help (`--z-popover` = 150) regardless of which was opened last. Resolution: `TOGGLE_HELP` and `TOGGLE_SETTINGS` handlers now close the other panel before toggling. Also switched both handlers from `setX(true)` to `setX(prev => !prev)` so a second press of `?` (or `,`) closes the panel from anywhere, including from within a modal scope reached via the universal pre-pass. Applied symmetrically in `src/app/home-client.tsx` and `src/app/cheatsheets/[slug]/sheet-shortcuts.tsx`.
- **Regression coverage (applied)** — Added `e2e/help-settings-interaction.spec.ts` (8 tests) covering S-1 (universal pre-pass: `?` from item-detail modal), S-1b (z-index: Help layers above cheat command modals — asserted via computed `z-index` comparison), and S-1c (mutual exclusion + re-toggle, on both home and sheet pages). Full E2E suite: 113 passed, 8 skipped (105 → 113, no regressions).
- **Fix S-2 (applied)** — Dev mode bar "Save layout to server" button used `var(--accent)` (sheet-tinted) instead of the fixed DEV pill yellow. Changed `.toolbarButtonPrimary` in `src/components/sheets/dev-overlay/dev-overlay.module.css` to `var(--warning)` for border/color/hover. The button now stays visually consistent across sheets regardless of accent color.
- Checklist combo corrections applied (none of these were bugs, just doc drift in the checklist itself):
  - `BACK_TO_HOME` = `Backspace` / `Escape` (not `b`).
  - `TOGGLE_SETTINGS` = `,` (not `s`).
  - `COPY_COMMAND` = `y` (not `c`).
  - `SHOW_EXAMPLE` = `i` (not `e`).
  - `CLEAR_COMMAND_FOCUS` = `Escape` (intentional overlap with `BACK_TO_HOME`).

---

## 4. Drag & resize (mouse, in `sheet` scope without layout mode)

- [x] Drag card by handle — block moves, others reflow according to engine rules
- [x] Drag card UP into heading — heading shifts up (push) before shrinking
- [x] Drag card UP into another card — card above shrinks/pushes correctly
- [x] Drag heading DOWN — pushes blocks down; if grid bottom reached, wraps south
- [x] Resize handle E/W/N/S — block grows/shrinks; chain blocks respond
- [x] Resize against grid limit — UI freezes at last valid state, no reset
- [x] Release mouse mid-drag — final position commits, no orphan preview
- [x] Quick successive drags — no scope race, no missed events
- [x] Refresh after drag — layout persisted

### Findings (drag-resize)

- All checks green. No issues found.

---

## 5. Layout mode — master (scope: `layout`)

Enter with `Ctrl+M`.

- [x] `LayoutModePill` shows current sub-mode (initial: navigation)
- [x] Focused card highlight color matches sub-mode
- [x] First focus = card nearest cursor at entry
- [x] `n` — switch to navigation sub-mode
- [x] `m` — switch to move sub-mode
- [x] `b` — switch to resize sub-mode
- [x] `Escape` — exits layout mode entirely (or exits sub-mode first then master? verify)
- [x] `Enter` — commits buffered changes (Phase FA)
- [x] `Shift+R` (or LAYOUT_RESET combo) — resets to original
- [x] Settings/help still reachable from layout mode (Phase FA polish `c5b327f`)
- [x] Inline help shows correct scope (`layout` or active sub-scope)
- [x] Pill change counter (`d0b0c66`) increments on each commit

### Findings (layout-master)

- **Fix L-1 (applied)** — Entering layout mode (`Ctrl+M`) did not focus the card closest to the mouse cursor: `enterMode` preserved any pre-existing `focusedCard` via `if (current) return current`. Removed the guard so pick-closest runs on every entry, ignoring stale focus from a previous session.
- **Fix L-2 (applied)** — During keyboard navigation in layout mode, the viewport did not follow the focused block: `scrollIntoView({ block: "nearest" })` only scrolls when the element is fully out of view. Switched to `block: "center"` so every focus change recenters the card vertically. The horizontal axis stays `inline: "nearest"`.
 - **Fix L-3 (applied, root cause)** — While debugging L-1/L-2, found that BOTH fixes were silently broken by a pre-existing bug: `sheet-renderer.tsx:441` passed `buildBlockAnchorId(...)` (a slugified, namespaced anchor like `sheet-card-inspect-and-diff`) as the `id` prop of `BlockRenderer`, and `card-block.tsx` / `heading-block.tsx` reused that same value for `data-layout-block-id`. Every `document.querySelector('[data-layout-block-id="${block.id}"]')` in `use-layout-keyboard.ts` (pick-closest, scroll, and others) was therefore searching for the raw id while the DOM held the anchor form, returning null in 100% of cases. Pick-closest fell back to `pickTopLeftBlock`, and `scrollIntoView` never ran. Fix: added a distinct `blockId` prop (raw `LayoutBlock.id`) alongside `id` (HTML anchor) in `BlockRendererProps`, `BlockRendererPropsFromParent`, and both block-type renderers; `data-layout-block-id` now binds to `blockId`. This may incidentally unblock other behaviors that were silently broken — to watch for during the rest of the review.
- **E2E fallout (resolved)** — L-3 changed `data-layout-block-id` from the slugified anchor form to the raw YAML id, breaking ~64 hard-coded literals across `e2e/keyboard-layout.spec.ts`, `e2e/layout-buffered-mode.spec.ts`, `e2e/layout-reset.spec.ts`, and `e2e/heading-nav-layout.spec.ts`. Updated the literals (`sheet-card-top-left` → `top-left`, etc.), simplified `stripPrefix` helpers in the reset/heading-nav specs to read directly from `data-layout-block-id` + new `data-layout-block-kind` attribute (added to `card-block.tsx`/`heading-block.tsx`), and introduced a `navigateToBlock(page, id)` helper that drives `h/j/k/l` from any pick-closest starting point, replacing the previous `enterLayoutMode + press(j)` chains that assumed a deterministic initial focus. Suite now: 118 passed / 8 skipped / 0 failed.

---

## 6. Layout navigation sub-mode (scope: `layout-navigation`)

- [x] `h/j/k/l` and arrows — move focus across cards
- [x] No move/resize happens (purely focus shift)
- [x] Viewport scrolls to follow focused card (`scrollIntoView nearest smooth`)
- [x] `m` / `b` switches sub-mode without losing focus
- [x] `Escape` — exit
- [x] Inline help reflects nav scope

### Findings (layout-nav)

_(none — all green)_

---

## 7. Layout move sub-mode (scope: `layout-move`)

- [x] `h/j/k/l` — move focused card by 1 grid unit
- [x] `Alt+h/j/k/l` (strict) — move without pushing neighbors? Verify exact semantics
- [x] Move into a heading — heading pushes correctly
- [x] Move into wall — block freezes at limit
- [x] South wrap triggers when moving past grid bottom
- [x] `n` / `b` switches sub-mode
- [x] Visual feedback distinct from navigation sub-mode
- [x] Each keystroke commits to buffer (FA model)

### Findings (layout-move)

_(none — all green)_

---

## 8. Layout resize sub-mode (scope: `layout-resize`)

Note: post-`2250169`, the arrow indicates the EDGE that moves.

- [x] `h/j/k/l` (grow) — edge moves in arrow direction, block grows
- [x] `Shift+h/j/k/l` (shrink) — edge moves in arrow direction, block shrinks (inverted post-`2250169`)
- [x] `Alt+...` (strict grow) — no neighbor push, block stops at neighbor edge
- [x] `Alt+Shift+...` (strict shrink) — verify exists
- [x] `Ctrl+Shift+...` (shrink compact) — block shrinks AND neighbors absorb the freed space
- [x] Resize against grid limit — engine clamps, no reset
- [x] Cascade resize: A grows → B shrinks → C shrinks until limits
- [x] `n` / `m` switches sub-mode

### Findings (layout-resize)

_(none — all green)_

---

## 9. Buffered keyboard (Phase FA) — interplay with layout mode

- [x] Enter layout mode, make several edits — pill shows pending count
- [x] `Enter` commits buffer to saved state
- [x] `Escape` — silent discard (Phase FA4)
- [x] `Escape` after explicit "dirty" threshold — `LayoutDiscardConfirm` modal appears (verify trigger condition)
- [x] Modal: confirm discards buffer; cancel returns to layout mode
- [x] Mouse click outside layout mode while buffered — discards buffer (Phase FA6 `9a442b5`)
- [x] Refresh during buffered state — verify what persists vs discards (spec says buffer is transient)

### Findings (buffered)

_(none — all green)_

---

## 10. Developer mode (scope: `dev`)

Toggle with `Ctrl+Shift+D`. Modal scope: pushes a dedicated keyboard scope so sheet/global bindings are inert while dev mode is active (except the toggle itself, which runs on a raw `window` listener). Internal `Debug*` recorder, UI `Dev*` bar.

- [x] Dev bar appears at top of viewport (`DevModeBar`)
- [x] `s` — save layout to `.layout.json` (action `DEV_SAVE_LAYOUT`); after a successful save, the user-facing reset button hides immediately (`promoteCurrentAsBaseline`)
- [x] `Shift+r` — reset layout to cheatsheet default (action `DEV_RESET_LAYOUT`); same combo as the user-facing `RESET_LAYOUT`, intercepted by the modal `dev` scope while developer mode is active
- [x] `r` — toggle the debug recorder (action `DEV_TOGGLE_RECORDING`)
- [x] `o` — toggle logs dropdown (action `DEV_TOGGLE_LOGS`)
- [x] `Shift+g` — enter axes selection sub-mode (action `DEV_ENTER_AXES_MODE`)
- [x] `Ctrl+Shift+D` — exits dev mode entirely

### Findings (dev)

- **Fix D-1 (applied)** — Dev save no longer left the user-facing reset button visible until reload. `useLayoutPersistence` now exposes `promoteCurrentAsBaseline()`, which is called from `sheet-renderer.tsx` after a successful `syncLayoutToDev` (HTTP 2xx). The hook stores a session-local `{ base, promoted }` override; the override is only consulted while `base === inferredOriginalLayout` (referential identity check), so a page reload that rehydrates `sheet.savedBlockLayout` invalidates the override naturally without a `useEffect + setState`. The localStorage mirror is cleared at promotion time. Covered by `e2e/dev-save-promotes-baseline.spec.ts` (route-mocked, no on-disk write).
- **Fix D-2 (applied)** — Rebound `DEV_RESET_LAYOUT` from `w` to `Shift+r` (`combo("R", "shift")`) so the dev reset uses the same combo as the user-facing `RESET_LAYOUT`. The `dev` scope is modal, so there is no cascade conflict: `Shift+r` triggers `DEV_RESET_LAYOUT` while dev mode is active and `RESET_LAYOUT` otherwise. Updated `src/lib/keyboard-dispatch.test.ts` fixture for consistency, and `docs/keybindings.md` (which also got a global pass: `Shift+<UPPER>` → `Shift+<lower>` for keyboard combos, except the multi-modifier `Ctrl+Shift+D` which stays in OS-conventional casing).

---

## 11. Dev logs sub-mode (scope: `dev-logs`)

Opened from the dev bar with `o` (action `DEV_TOGGLE_LOGS`). Lists recorded debug sessions.

- [x] Dropdown opens listing recorded sessions
- [x] `j` / `ArrowDown` — cursor down (`DEV_LOGS_CURSOR_DOWN`)
- [x] `k` / `ArrowUp` — cursor up (`DEV_LOGS_CURSOR_UP`)
- [x] `y` — yank/copy filename to clipboard (`DEV_LOGS_COPY_FILENAME`)
- [x] `d` — delete highlighted session (`DEV_LOGS_DELETE`)
- [x] `Shift+d` — delete all sessions (`DEV_LOGS_DELETE_ALL`)
- [x] `Shift+r` — refresh list (`DEV_LOGS_REFRESH`)
- [x] `Escape` — close dropdown (`DEV_LOGS_CLOSE`)

### Findings (dev-logs)

_(empty)_

---

## 12. Dev axes sub-mode (scope: `dev-axes`)

Entered from dev mode with `Shift+g` (action `DEV_ENTER_AXES_MODE`). Pins reference rows/columns on the grid overlay.

- [x] Grid axes overlay visible
- [x] `h` / `ArrowLeft` — cursor left (`DEV_AXES_CURSOR_LEFT`)
- [x] `l` / `ArrowRight` — cursor right (`DEV_AXES_CURSOR_RIGHT`)
- [x] `k` / `ArrowUp` — cursor up (`DEV_AXES_CURSOR_UP`)
- [x] `j` / `ArrowDown` — cursor down (`DEV_AXES_CURSOR_DOWN`)
- [x] `Space` / `Enter` — toggle column pin (`DEV_AXES_TOGGLE_COL`)
- [x] `Shift+Space` / `Shift+Enter` — toggle row pin (`DEV_AXES_TOGGLE_ROW`)
- [x] `c` — clear all pinned (`DEV_AXES_CLEAR_ALL`)
- [x] `Escape` — exit axes mode (`DEV_AXES_EXIT`)

### Findings (dev-axes)

_(empty)_

---

## 13. Settings panel (scope: `settings`)

Open with `,` (action `TOGGLE_SETTINGS`) from home or sheet. Universal action — pierces modals (re-toggling closes Help if it was open).

- [x] Slide-in from right, ~66vw, full height
- [x] At 1080px: 3-col layout for UI fields
- [x] At 720px: drops to fewer cols (verify breakpoints 3/2/1)
- [x] Tabs: UI | Keybindings
- [x] Keybindings sub-tabs: Global, Home, Cheatsheet, Layout Mode, Developer (verify section-based editor)
- [x] Active tab + sub-tab persist across reload
- [x] UI reset button works (per-section?)
- [x] Keybindings reset button works; intentional overlaps preserved (`9ec1326`, `c146d4a`)
- [x] Bulk `resetActions` brute void; single `resetAction` works
- [x] Record a new combo: capture works, conflicts reported with scope-local detection
- [x] Intentional intra-scope overlap NOT reported as conflict
- [x] Tab navigation (Tab/Shift+Tab) cycles through fields
- [x] Arrow keys navigate between tabs
- [x] `Escape` — close panel

### Findings (settings)

- **Note S-1 (no action)** — There are currently no dedicated keybindings to navigate inside the settings UI (no scope-specific actions for moving between tabs / sub-tabs / fields). All in-panel navigation is delegated to native form-element behaviour: browser-native `Tab` / `Shift+Tab` focus cycling, `ArrowLeft` / `ArrowRight` on the `<button role="tab">` group, etc. This is intentional for now — accept native semantics and revisit only if a UX gap emerges.

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
