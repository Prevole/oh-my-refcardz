# Phase FA — Buffered keyboard layout mode

Reaction to a mouse/keyboard interaction bug: when entering layout mode
via `Ctrl+M` and then clicking on a card, the sheet visually leaves the
keyboard layout mode (`isLayoutActive` drops to `false` because
`handleHeaderPointerDown` calls `setFocusedCard(null)`) while the
keyboard state machine remains in `mode === "navigation"`. The pill
keeps saying "Navigation", but the sheet no longer behaves like layout
mode.

Rather than patching the mouse/keyboard interleaving, FA reframes the
keyboard layout mode as a **buffered editor**: keyboard operations are
staged in memory and either committed (Return) or discarded (Esc or any
mouse click). This eliminates the dual-driver ambiguity at the source
and aligns with the broader "no mouse/keyboard mixing" principle.

Branch: `feature/layout-v3` (continues from the latest f-polish commit).

## Vocabulary

- **Buffer**: in-memory snapshot of the layout that absorbs all keyboard
  ops during the layout mode session. Never touches `localStorage` or
  the persisted layout.
- **Commit**: copy the buffer over the persistent layout (via the
  normal persistence path), then exit layout mode.
- **Discard**: throw away the buffer; the persistent layout returns to
  the state it had when the user entered layout mode. Optionally
  guarded by a confirmation modal.
- **Changes count**: number of ops applied to the buffer since entering
  layout mode. Drives the pill counter and the discard-confirm
  threshold.

## Contract

### Entry

`Ctrl+M` (LAYOUT_ENTER_MODE) from `sheet` scope:
- Captures the current persisted layout as `initialSnapshot`.
- Initialises `currentBuffer = initialSnapshot`, `changesCount = 0`.
- Switches keyboard scope to `layout` + `layout-navigation`.
- Pill appears: `Navigation` (no counter yet, count is 0).

### Keyboard ops

All move/resize/strict ops:
- Apply to `currentBuffer` through the engine.
- Increment `changesCount` by 1 per applied op (ops that do nothing —
  blocked by constraints — do NOT increment).
- The sheet renders `currentBuffer`, not the persisted layout.
- Pill updates: `Navigation · N changes` when `N > 0`.

### Commit

`Return` (LAYOUT_COMMIT) on scope `layout`:
- Persists `currentBuffer` via the normal `useLayoutPersistence` API.
- Resets `changesCount = 0`, clears the buffer.
- Exits layout mode (mode → null, focusedCard → null, pill hidden).

### Discard

`Esc` (existing LAYOUT_*_EXIT actions, repurposed):
- If `changesCount < 5`: silent discard. Buffer thrown away, persistent
  layout untouched, layout mode exits.
- If `changesCount >= 5`: opens `LayoutDiscardConfirm` modal.

### Mouse click during layout mode

Any header pointer down (`handleHeaderPointerDown`) or resize handle
pointer down (`handleResizePointerDown`) while `mode !== null`:
- Equivalent to Esc: discard (with modal if `changesCount >= 5`),
  exit layout mode.
- The drag/resize itself is NOT started (no mouse manipulation during
  the buffered keyboard session).
- Click outside any card (empty grid area) — current behaviour stays:
  no effect; we don't add a separate "click anywhere to exit" handler
  for FA1 (revisit if requested).

### Discard confirm modal

New component `LayoutDiscardConfirm`:
- Title: `Discard layout changes?`
- Body: `N changes will be lost.` (where N is the actual count).
- Two buttons: `Discard` (danger style) and `Keep editing` (default).
- Keyboard scope: `layout-discard-confirm` (modal).
- Actions:
  - `LAYOUT_DISCARD_CONFIRM` (default: `Return`) → discard + exit.
  - `LAYOUT_DISCARD_CANCEL` (default: `Esc`) → close modal, stay in
    layout mode with buffer intact.
- Focus trap inside the modal (same pattern as cheat-info-modal /
  cheat-copy-modal).

### Pill counter

`LayoutModePill`:
- Existing label: `Navigation`, `Move`, `Resize`.
- When `changesCount > 0`, append ` · N change(s)` (singular/plural).
- Counter uses a slightly muted style so the mode name remains the
  primary information.

## Action IDs added

- `LAYOUT_COMMIT` (scope `layout`, default `Return`).
- `LAYOUT_DISCARD_CONFIRM` (scope `layout-discard-confirm`, default `Return`).
- `LAYOUT_DISCARD_CANCEL` (scope `layout-discard-confirm`, default `Escape`).

No removal. `LAYOUT_*_EXIT` keeps its current binding (`Escape`); its
*semantics* change from "exit + commit immediately (V1 behaviour)" /
"exit + nothing to persist (V2 keyboard)" to "exit + discard buffer
(possibly via modal)".

## Scopes added

- `layout-discard-confirm` (modal, child of `layout`).

## Persistence migration

None required (pre-release single dev user, per project policy). New
action IDs simply don't exist in stored configs; they will be merged
in from `DEFAULT_KEYBINDINGS` by `mergeWithDefaults` on next load.

## Sub-phases

- [ ] **FA1**. **Plan + docs scaffolding**. This document; cross-links
  from `.opencode/plans/layout-v3-f-polish.md` (mention that FA branches
  off after f-polish) and from `docs/layout-engine.md` and
  `docs/keybindings.md` (placeholder sections to be filled by FA9).
  No code changes.

- [/] **FA2**. **Pure buffer module**. `src/components/sheets/layout/layout-buffer.ts` exposes `createBuffer`, `applyToBuffer`, `commitBuffer` (and `ApplyContext`, `ApplyResult` types). Pure functions, no React. Every call returns a new buffer or the same reference when the engine reports no change. `changesCount` increments only when `applyOperation` produces a different layout (structural equality on id+kind+x/y/w/h). Tests in `layout-buffer.test.ts`: 9/9 covering init, successful op, immutability, accumulation, no-op preservation (including a strict resize rejection). No wiring into the keyboard hook yet — FA3 will plug the buffer into `useLayoutKeyboard` and `sheet-renderer`.

- [/] **FA3**. **Buffer wiring + commit on Return**. New
  `useLayoutBufferState` hook (`src/components/sheets/layout/use-layout-buffer-state.ts`)
  owns the `LayoutBuffer | null` cell and exposes `start / apply /
  commit / clear`, plus convenience `bufferBlocks` and `changesCount`.
  `useLayoutKeyboard` now takes `bufferState` and `gridColumns`
  options: `enterMode` starts the buffer from `editor.committedBlocks`;
  `submitMove`/`submitResize` route through `bufferState.apply` and
  build the `ApplyContext` from `getBlockConstraintsV2` + the live
  debug emitter; the new `commitMode` extracts the buffer, hands it
  to a new `editor.commitLayout(blocks)` API (which persists via the
  same `onCommit` callback as `applyOneShot`), then exits. The new
  `LAYOUT_COMMIT` action (default `Enter`) is bound on the parent
  `layout` scope and registered in `keybinding-tabs-config.ts`. For
  FA3 specifically, `LAYOUT_EXIT` (Esc) is provisionally aliased to
  `commitMode` to preserve the pre-FA "always commit" behaviour;
  FA4 will swap it to a discard path. Mouse drag/resize is disabled
  while `bufferState.isActive` (no-op pointer-down handlers in the
  sheet renderer); FA6 will upgrade this to "click discards and
  exits". Validation: 839/839 unit ✓, lint ✓, build ✓. No new unit
  tests (the new hook is React-bound; coverage comes via the FA8
  E2E suite). _Committed as `cfec8c5`._

- [/] **FA4**. **Silent discard on Esc**. `LAYOUT_EXIT` semantics
  swap: it no longer aliases `commitMode`. New `discardMode` handler
  clears the buffer and exits layout mode without persisting. For
  FA4 in isolation the discard is silent regardless of
  `changesCount` (the modal at the 5-change threshold lands in FA5).
  E2E `keyboard-layout.spec.ts:419` covers: focus a block, switch to
  resize, press `j`, observe the buffered DOM update, press `Esc` →
  pill disappears, block returns to its initial rowSpan, reset
  button stays hidden (no mutation persisted). The existing reset-
  button test (`keyboard-layout.spec.ts:398`) was adapted to require
  an explicit `Enter` to commit the resize before asserting the
  reset button is visible. Validation: 20/20 E2E ✓ (keyboard-layout
  suite), 839/839 unit ✓, lint ✓, build ✓.

- [ ] **FA5**. **`LayoutDiscardConfirm` modal**. New component,
  module CSS, scope `layout-discard-confirm`, two actions, focus trap,
  inline footer hints using `<InlineKeybinding>` (primary combo
  contract). Wire to Esc when `changesCount >= 5`. E2E: enter, do 5
  ops, Esc → modal appears; `Return` → buffer discarded, layout reverts;
  Esc → modal closes, buffer intact.

  Split into FA5a (component + scope + actions, no wiring) and FA5b
  (wiring from `discardMode` + E2E).

  - [/] **FA5a**. **Component + scope + actions, no wiring**.
    - `src/lib/keyboard-scope.ts`: registered `layout-discard-confirm`.
    - `src/lib/keybindings.ts`: extended `KeybindingContext`,
      `scopeToContext`, added `ACTION_IDS.LAYOUT_DISCARD_CONFIRM` /
      `LAYOUT_DISCARD_CANCEL`, defaults block (`Enter` confirms,
      `Escape` cancels).
    - `src/components/settings/keybinding-tabs-config.ts`: new
      section `Discard confirm` at the end of `SHEET_LAYOUT_SECTIONS`.
    - `src/components/sheets/layout/layout-discard-confirm.tsx`: new
      modal component, autonomous `createPortal` pattern (no
      dependency on `useRegisterModalOpen` which is shell-commands
      specific); `useKeyboardScope("layout-discard-confirm", open, { modal: true })`;
      focuses the `Discard` button on open (primary action).
      Body text is generic (`All changes made so far will be lost.`),
      intentionally no `N` count to avoid wiring buffer state into
      the modal contract.
    - `src/components/sheets/layout/layout-discard-confirm.module.css`:
      warning style (border + title in `--warning`, `Discard` button
      in `--error`, `Cancel` button neutral).
    - Not wired anywhere yet; modal is unreachable. FA5b will plug
      it into the discard path.
    - Validation: lint ✓, 839/839 unit ✓, build ✓.

  - [ ] **FA5b**. **Wiring + E2E**. Split `discardMode` in
    `useLayoutKeyboard` into `requestDiscard` (decides silent vs
    modal based on `changesCount >= 5`) and the existing silent
    discard path. Mount `LayoutDiscardConfirm` from the sheet
    renderer with `open` state owned alongside `bufferState`. E2E
    covers the 3 paths (silent < 5, modal confirm, modal cancel).

- [ ] **FA6**. **Mouse click discards buffer**. Modify
  `handleHeaderPointerDown` and `handleResizePointerDown` in
  `sheet-renderer.tsx`: when `mode !== null`, call the discard path
  (with modal if applicable) and DO NOT start drag/resize. Outside
  layout mode (`mode === null`), behaviour unchanged. E2E: enter
  layout mode, click on a card header → exits silently (if < 5
  changes) or shows modal.

- [ ] **FA7**. **Pill counter**. Update `LayoutModePill` to render
  `Navigation · 3 changes` etc. Style the counter slightly muted.
  Snapshot/unit test on the component.

- [ ] **FA8**. **E2E coverage consolidation**. Group all FA2–FA7
  E2E in a single spec file `e2e/layout-buffered-mode.spec.ts`
  (commit, silent discard, modal discard, mouse-click discard,
  pill counter visible).

- [ ] **FA9**. **Final documentation pass**. Update `docs/layout-engine.md`
  with the buffered-mode contract; update `docs/keybindings.md` with
  the new action IDs and the `layout-discard-confirm` scope.

## Open points (decide while implementing)

- **Counter granularity**: does a `compact` op (which moves multiple
  neighbours) count as 1 or N changes? Default: **1 change per user
  action**, not per engine displacement. The counter measures user
  effort, not engine work.
- **Counter when an op is a no-op or fully reverts a previous op**:
  default **always increment** (we don't compute net diffs against
  initial; tracking intent is simpler and clearer).
- **Mouse interaction order**: the discard happens BEFORE the
  pointerdown propagates to the drag/resize starter. This means even
  in the modal-confirmed case the drag never starts. If the user
  cancels the modal, they have to click again to start a drag —
  acceptable because drag isn't even meant to work during the buffered
  session (the user is in keyboard mode by deliberate choice).
- **Pre-existing tests touching `handleHeaderPointerDown`**: verify
  none break; expectation is that drag tests run outside layout mode
  and are unaffected.

## Validation strategy

Each FAx commitable independently. After each sub-phase:
- `npm run lint`
- `npm run test`
- `npm run test:e2e` (only when E2E was modified)
- `npm run build` (when client/server boundaries change — likely
  unnecessary here, but FA5 introduces a new modal so worth running).

User confirms each sub-phase before commit. Commit messages follow the
existing project style (subject + body bullet sections).
