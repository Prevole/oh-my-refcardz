# Phase F-polish — Settings & Help UX iteration

Post-Phase F feedback round driven by hands-on UI review. Refines
visual chrome and consolidates a duplicate-by-design pattern
(mode-switch keybindings) into a single shared action.

Branch: `feature/layout-v3` (continues from `78da47f`, the F9 commit).

## Sub-phases

- [/] **FP1**. **Default arrows / secondary hjkl swap** — Inverted combo order in `DEFAULT_KEYBINDINGS` for 34 movement actions across 5 scopes (`layout-navigation`, `layout-move`, `layout-resize`, `dev-logs`, `dev-axes`). Scope `global` already had arrows first. No tests cared about combo *order* in defaults; no E2E broke because both bindings still match. Inline help (which renders `maxCombos=1`) now shows arrow glyphs. 821/821 unit ✓, 75/75 E2E ✓.

- [/] **FP2**. **Unify mode-switch keybindings in `layout` scope**
  (approach A3). 6 actions (`LAYOUT_NAV_TO_MOVE`, `LAYOUT_NAV_TO_RESIZE`,
  `LAYOUT_MOVE_TO_NAV`, `LAYOUT_MOVE_TO_RESIZE`, `LAYOUT_RESIZE_TO_NAV`,
  `LAYOUT_RESIZE_TO_MOVE`) collapsed into 3 (`LAYOUT_GOTO_NAVIGATION` `n`,
  `LAYOUT_GOTO_MOVE` `m`, `LAYOUT_GOTO_RESIZE` `b`) registered in scope
  `layout`. Sub-scopes flipped to non-modal so the cascade reaches the
  parent. `Escape` stays in each sub-scope (`LAYOUT_NAV_EXIT`/`LAYOUT_MOVE_EXIT`/
  `LAYOUT_RESIZE_EXIT` unchanged, still exit-complete) — prevents leak to
  `sheet.BACK_TO_HOME`. Key `r` → `b` for resize (azerty adjacency `b m n`).
  Updates: `contextual-inline-help.tsx` SCOPE_HELP_MAP, `sheet-help-modal.tsx`
  ENTRIES lists, `keyboard-layout.spec.ts` + `contextual-inline-help.spec.ts`
  E2E (helper signature + `r`→`b`), `docs/keybindings.md` (cascade pattern).
  821/821 unit ✓, 75/75 E2E ✓, build ✓.

- [/] **FP3**. **Settings panel: width + title bar + UI tab compact**
  (points 1, 3, 8). Panel `max-width` raised from `1100px` to `1280px`
  (66vw kept, min 720 kept). Header now has a subtle tinted background
  (`color-mix(in srgb, var(--accent) 6%, var(--bg-elevated))`) plus a
  stronger border-bottom (`--border-strong` instead of `--border-light`)
  to read as a real title bar — title and close affordance already lived
  inside it, so no markup change there. UI tab fields Color/Border/
  Orientation wrapped in a new `.fieldGrid` (2-col grid) to avoid the
  oversized full-width buttons on a wider panel; Random toggle and Reset
  button kept full-width above/below. 821/821 unit ✓, 75/75 E2E ✓,
  build ✓.

- [/] **FP4**. **Real tabs, not pills** (points 2, 4). Replaced the
  segmented-control pill style of the shared `<Tabs />` primitive with
  a true tab strip: transparent background, no per-tab border, accent
  underline (`border-bottom: 2px var(--accent-2)`) on active, soft
  bottom border (`var(--border-light)`) across the whole strip with a
  `margin-bottom: -1px` overlap so the active underline visually merges
  with the strip line. Aligned colour tokens (`--accent-2`, `--fg-60` /
  `--fg-88` hover) with the help modal's tab style for visual cohesion
  across all tabbed surfaces. Both Settings top-level tabs and
  keybindings sub-tabs inherit the new look (same primitive). No markup
  change. 821/821 unit ✓, 75/75 E2E ✓, build ✓.

- [/] **FP5**. **Dense tables + compact reset buttons** (points 5, 7).
  Keybinding rows now use `padding: space-1 spacing-compact` (down
  from `space-2`), label font dropped from `text-base` → `text-sm`,
  and the gap between rows replaced by a `--border-subtle` 1px hairline
  separator (`gap: 0` on `.list`, `border-top` on `.row + .row`). Added
  `min-height: space-7` so rows don't jump when label is shorter than
  combo. Reset button shrunk: width container `space-7` → `space-6`,
  button itself `space-6` → `space-5` with a 12px icon and
  `justify-content: flex-end` on the actions cell so the small icon
  sits flush right. 821/821 unit ✓, 75/75 E2E ✓, build ✓.

- [/] **FP6**. **Sub-tabs in help modal Layout & Developer** (point
  10). Layout tab gets 4 nested sub-tabs: **Lifecycle** (Enter +
  Reset grouped), **Navigation**, **Move**, **Resize**. Developer tab
  gets 3 nested sub-tabs: **Dev**, **Logs**, **Axes**. Reuses the
  shared `<Tabs />` primitive (after FP4 refresh) with a new
  `testIdPrefix` prop so each sub-tab button gets
  `data-testid="help-layout-sub-tab-{id}"` / `help-developer-sub-tab-{id}`.
  Content blocks for each sub-tab carry
  `data-testid="help-layout-content-{id}"` / `help-developer-content-{id}`.
  Inline doc updates: corrected `r` → `b` for the resize key (FP2
  rename) in the Layout intros, and updated `docs/keybindings.md`
  section 4 to list each ENTRIES bucket against its sub-tab. Also
  corrected the settings panel max-width (1100 → 1280) noted in
  doc post-FP3. 821/821 unit ✓, 75/75 E2E ✓, build ✓.

- [/] **FP7**. **Sub-tabs L2 visual variant** (refinement of FP6).
  The `<Tabs />` primitive gained a `variant?: "primary" | "secondary"`
  prop (default `"primary"`, current look untouched). The
  `"secondary"` variant is smaller (`text-sm`, padding `space-1
  space-3`), softer underline (`--accent` instead of `--accent-2`),
  thinner active bar (1px) — visually subordinate to L1. Applied to
  the Layout and Developer sub-tabs in `sheet-help-modal.tsx` via
  `variant="secondary"`. Existing call sites keep `"primary"`
  implicitly. CSS-only addition in `tabs.module.css`
  (`.tabsSecondary` + `.tabSecondary`). 821/821 unit ✓, 75/75 E2E ✓,
  build ✓.

- [/] **FP8**. **Settings keybinding editor — auto-fit grid + help
  sizing** (settings density refinement). The wrapper around
  contexts in `keybinding-editor.tsx` now carries the new
  `.contextGrid` class which uses
  `grid-template-columns: repeat(auto-fit, minmax(360px, 1fr))`
  with `gap: space-5 space-6`, so a sub-tab with N contexts
  packs them into multiple columns when the FP3 1280px panel
  allows it. Sub-tabs with a single context (Global/Home/
  Cheatsheet) naturally degrade to one column. Row sizing
  reverted from FP5 dense pass: label `text-sm → text-base`,
  keycap `text-sm → text-base`, row padding `space-1 → space-2`,
  min-height `space-7 → space-8`. Hairline separators (FP5) and
  compact reset button (FP5) kept untouched. Result: labels and
  combos are now legible at the help modal sizing while the
  grid recovers the density that FP5's smaller fonts gave us.
  821/821 unit ✓, 75/75 E2E ✓, build ✓.

- [/] **FP9**. **Lifecycle becomes sub-mode hub** (refinement of FP6).
  Help modal Layout tab → Lifecycle sub-tab now hosts 3 sections:
  Enter, **Switch sub-mode** (new), Reset. New
  `LAYOUT_SUBMODE_SWITCH_ENTRIES` bucket with
  `LAYOUT_GOTO_NAVIGATION` / `LAYOUT_GOTO_MOVE` /
  `LAYOUT_GOTO_RESIZE`. The same three entries were removed from
  `LAYOUT_NAV_ENTRIES`, `LAYOUT_MOVE_ENTRIES`, and
  `LAYOUT_RESIZE_ENTRIES` to kill the triple-duplication that
  appeared after FP2 + FP6. Section intros in Navigation/Move/
  Resize updated to redirect users to Lifecycle ("See Lifecycle
  to switch to another sub-mode") instead of inlining the keys.
  `docs/keybindings.md` section 4 updated to list the new bucket.
  821/821 unit ✓, 75/75 E2E ✓, build ✓.

- [/] **FP10**. **Always-visible reset icon + right-aligned
  Reset-all** (post-FP8 visual polish). Two issues surfaced
  during the FP8 review:
  1. The `.actions` column reserves a fixed `space-6` width
     for the per-row reset icon, but the icon only renders
     when the action is modified. Result: visible blank
     gutter on every unmodified row.
  2. The "Reset all keybindings" button still inherits
     `btn-danger`'s `width: 100%`, looking oversized on the
     wider FP3 panel.
  Fixes:
  - `ActionRow` always renders the reset button. When the
    action is unmodified, the button is `disabled` and styled
    via new `.resetButtonInert` class (`color: --fg-30`, no
    cursor, no opacity dimming). When modified, picks up the
    FP5 standard appearance (subtle, hover → `--fg-75`).
    Added `data-modified` attribute on the button for selector
    granularity if needed; existing `data-testid="keybinding-reset"`
    selector still matches and E2E spec keeps working (it asserts
    the button is visible after modification, which is now always
    true; the click still triggers reset because the button is
    enabled in the modified state).
  - `.footer` now `display: flex; justify-content: flex-end`;
    `.resetAllButton` overrides `width: auto` with compact
    padding (`space-1 space-3`) and `text-sm`. Aligned to the
    right edge of the panel, takes only its natural width.
  821/821 unit ✓, 75/75 E2E ✓, build ✓.

- [/] **FP11**. **Lifecycle merge + intros cleanup + grid
  fix + UI reset polish** (FP9/FP8/FP10 follow-ups).
  Five targeted refinements grouped because they share the
  same review pass:
  1. **Lifecycle unified table** — Replaced the 3 sections
     (Enter / Switch sub-mode / Reset) with a single
     `<KeybindingChart cols={2}>` whose entries are
     interleaved row-by-row to produce 2 logical columns:
     left = lifecycle (Enter / Reset / _), right = sub-modes
     (Goto Nav / Goto Move / Goto Resize). New
     `LAYOUT_LIFECYCLE_ENTRIES` bucket replaces
     `LAYOUT_ENTER_ENTRIES`, `LAYOUT_SUBMODE_SWITCH_ENTRIES`,
     `LAYOUT_RESET_ENTRIES`.
  2. **Move/Resize intros — keys removed from prose** —
     All key mentions moved into the chart. Move intro
     mentions strict semantics without naming Alt; Resize
     intro just says "Each direction and each variant has
     its own binding".
  3. **Resize advanced variants exposed** — New
     `Collapsible` widget in `src/components/help/` (minimal
     disclosure, animated chevron, summary-only button).
     Resize sub-tab now shows 8 base entries (grow + shrink)
     plus a collapsed "Show advanced variants" containing 12
     more: `LAYOUT_RESIZE_GROW_STRICT_*` ×4,
     `LAYOUT_RESIZE_SHRINK_STRICT_*` ×4,
     `LAYOUT_RESIZE_SHRINK_COMPACT_*` ×4. All 20 are
     configurable in settings via `ACTION_IDS` (no schema
     change). Move strict variants already lived in the base
     `LAYOUT_MOVE_ENTRIES`, kept as-is.
  4. **Single-context grid fix** — `keybinding-editor`
     `.contextGrid` switched from `auto-fit` to `auto-fill`.
     Lone contexts (Global / Home / Cheatsheet) now stay
     bounded to ~360–`1fr` of a single track instead of
     stretching across the full 1280px width. Multi-context
     sub-tabs (Layout, Developer) keep packing into 2–3
     columns.
  5. **UI tab reset button** — Same pattern as FP10's
     reset-all: `.sectionReset` becomes flex right;
     `.resetButton` overrides `width: auto` with compact
     padding (`space-1 space-3`) and `text-sm`. Visual
     parity with the keybindings reset-all.
  `docs/keybindings.md` section 4 updated to reflect the
  new ENTRIES buckets. 821/821 unit ✓, 75/75 E2E ✓, build ✓.

- [/] **FP12**. **Help modal: keyboard navigation across tabs
  and sub-tabs**. Two-row tab grid (L1 = App Shortcuts /
  Layout / Developer / Symbol Legend, L2 = Lifecycle / Nav /
  Move / Resize or Dev / Logs / Axes when applicable). Adds
  keyboard-driven focus traversal with the focus indicator
  decoupled from the active state.

  Keybindings (scope `help`, all configurable):
  - `HELP_TAB_LEFT` (← / h), `HELP_TAB_RIGHT` (→ / l)
  - `HELP_TAB_UP` (↑ / k), `HELP_TAB_DOWN` (↓ / j)
  - `HELP_TAB_ACTIVATE` (Space / Enter)

  Behavior:
  - **Open**: focus snaps to the active L1 tab (row=L1,
    index=activeTabIndex). Reset on every open; no
    persistence.
  - **Left/Right**: wrap horizontally within the current
    row. Tab count varies (L1 always 4; L2 is 4 if Layout
    active, 3 if Developer active).
  - **Up from L1**: no-op.
  - **Up from L2**: focus jumps to the L1 parent tab
    (Layout or Developer).
  - **Down from L1**: only when the *focused* L1 tab is
    Layout or Developer **and** also currently active
    (i.e. L2 strip is visible). Focus lands on the L2 tab
    currently active in that parent. Otherwise no-op.
  - **Activate (Space/Enter)**: commits focus → active.
    L1 focus activates the L1 tab; L2 focus activates the
    L2 sub-tab (and ensures the parent L1 stays active).

  Visual indicators (additive):
  - **Active** (unchanged from FP4/FP7): underline accent
    (`--accent-2` for L1, `--accent` for L2 via FP7).
  - **Focused** (new): `outline: 2px solid` matching its
    row's accent token, `outline-offset: 2px`. Stays
    visible regardless of pointer focus (custom CSS, not
    `:focus-visible`, because we drive the focus state from
    a React state and not from `document.activeElement`).
  - **Focused + active**: outline + underline together.

  Implementation:
  - 5 new entries in `ACTION_IDS` and `DEFAULT_KEYBINDINGS`
    under context `help`.
  - `SheetHelpModal` gains `focus: { row: "L1" | "L2"; index: number }`
    state, reset to the L1 active index whenever `open` flips
    from false to true.
  - Handler in `useScopedKeyboardHandler("help", ...)` uses
    `matchesAction(event, …)` for each action.
  - Drop the inline `<Tabs />` for L1 (helpStyles tabs strip)
    in favour of richer markup that supports both `data-active`
    and `data-focused` attributes; same for the L2 strips via
    the shared `<Tabs />` primitive (extended with `focusedTab`
    prop).
  - `home-help-modal.tsx` (also under `help` scope) gets the
    same 5 actions wired or is left as a passive scope —
    decide depending on whether home help has multiple tabs.
- Architecture for shared mode-switch: approach A3 (sub-scopes
  non-modal, single action in `layout`).
- Density: start modest, iterate with the user.
- Per-binding propagation control: noted in `docs/ideas-backlog.md`,
  not built now.

- [/] **FP13**. **Settings panel: keyboard navigation + L1/L2/L3
  structure**. Adds 3-row focus state (L1=top tabs UI/Keybindings,
  L2=Keybindings sub-tabs General/Home/Cheatsheet, L3=Cheatsheet
  sub-sub-tabs General/Layout/Developer). Adds 5 actions in scope
  `settings` (arrows + hjkl + Space/Enter), `Tabs` primitive gains
  `tertiary` variant with new `--accent-3: #e07a5f` token, L3 strip
  has dynamic left-indent via ResizeObserver + `--l3-indent` CSS
  var. Persistence: `keybindingsSub` + `keybindingsSubSub` with
  legacy migration. New module `keybinding-tabs-config.ts` exposes
  `SUB_TABS` / `SUB_SUB_TABS` / `getActiveContexts()`. Click sync
  via `onSubTabClick` / `onSubSubTabClick` callbacks. Persisted
  legacy values (`global`→`general`, `layout`/`developer`→
  `cheatsheet+subSub`) auto-migrated. 823/823 unit ✓, 75/75 E2E ✓,
  build ✓.

- [/] **FP14a**. **Add `home` and `sheet` scopes**. Preparatory
  refactor for splitting `MOVE_*` between home and sheet (FP14c).
  Adds two new `KeyboardScopeId` values, mapped 1:1 in
  `scopeToContext`. `home-client.tsx` pushes `home` while mounted;
  `sheet-shortcuts.tsx` pushes `sheet` while mounted. Three
  `useScopedKeyboardHandler` call sites moved from `"global"` to
  the new specific scopes: home page top-level handler, sheet
  page top-level handler (`SheetShortcuts`), and `RESET_LAYOUT`
  shortcut in `sheet-renderer.tsx`. Layout-mode entry handler in
  `use-layout-keyboard.ts` also moved to scope `sheet`. The two
  sheet-only hooks `useEntryCopy` and `useCommandNavigation` now
  gate on `isScopeActive("sheet")` instead of `"global"`. Docs:
  obsolete note about `sheet` scope not being routed removed;
  scope stack illustration updated to show `home`/`sheet` mounted
  states. 825/825 unit ✓, 75/75 E2E ✓, build ✓.

- [/] **FP14b**. **Add `modal` scope**. Adds a generic `modal`
  scope shared by `CommandCopyModal` and `ItemDetailModal`. Both
  modals call `useKeyboardScope("modal", true, { modal: true })`
  at mount; the `modal: true` modality blocks the cascade so
  parent `sheet`-level handlers (in particular `BACK_TO_HOME` on
  `Esc`) cannot run while a modal is open. The DOM-based guard
  in `sheet-shortcuts.tsx` (`document.querySelector("[data-command-modal-overlay]")`)
  becomes redundant but is kept for now. Modal-internal keydown
  listeners remain `window.addEventListener` based (capturing in
  command-copy via `stopImmediatePropagation`); they keep working
  unchanged because they don't go through the scope dispatcher.
  Adds `modal` to `KeybindingContext` and `KeyboardScopeId`,
  maps 1:1 in `scopeToContext`, defines an empty
  `DEFAULT_KEYBINDINGS.modal: []` (will be populated in FP14c),
  fills `CONTEXT_LABELS.modal = "Modal"` for the settings editor.
  826/826 unit ✓, 75/75 E2E ✓, build ✓.

- [/] **FP14c**. **Split `MOVE_*` per scope + scope-local conflict
  model**. Three sub-steps, three commits:

  - **Step 1 (`findConflict` scope-local)**: simplified
    `findConflict()` in `keybinding-utils.ts` to only check the
    action's own context. The defensive cross-context fallback
    (which used to also check `global` when editing a non-global
    binding) is removed. Cross-context shadowing — e.g. a `home`
    binding masking a `global` binding while the home scope is
    active — is intentional and never reported as a conflict; the
    scope stack guarantees only one context is active at a time.
    Tests in `keybinding-utils.test.ts` migrated to a `makeConfig()`
    factory (full `KeybindingsConfig` shape, no legacy
    `"sheet-layout"` key), two cross-context tests replaced by tests
    that document the new shadowing behaviour. Also fixed a
    pre-existing TS error in the test helper (`Modifier[]` typing).
    826/826 unit ✓, 75/75 E2E ✓, build ✓.

  - **Step 2 (split `MOVE_*`)**: removed the four
    `global.move-{left,right,up,down}` actions and replaced them
    with three scope-specific sets:
    - `HOME_MOVE_{LEFT,RIGHT,UP,DOWN}` → context `home`,
      ids `home.move-*`, defaults arrows + hjkl.
    - `SHEET_MOVE_{LEFT,RIGHT,UP,DOWN}` → context `sheet`,
      ids `sheet.move-*`, defaults arrows + hjkl.
    - `MODAL_MOVE_{UP,DOWN}` → context `modal`, ids `modal.move-*`,
      defaults arrows + j/k. No `LEFT`/`RIGHT` for modals: the two
      modals (`CommandCopyModal`, `ItemDetailModal`) only navigate
      a vertical list.
    Dispatch sites migrated:
    - `home-client.tsx` → `HOME_MOVE_*` (action filter list + 4
      handlers).
    - `use-command-navigation.ts` → `SHEET_MOVE_*` (variant nav of
      copyables).
    - `item-detail-modal.tsx`, `command-copy-modal.tsx` →
      `MODAL_MOVE_UP`/`MODAL_MOVE_DOWN`.
    Help UI updated: `home-help-modal.tsx` → `HOME_MOVE_*`,
    `sheet-help-modal.tsx` → `SHEET_MOVE_*`,
    `contextual-inline-help.tsx` surfaces `home` / `sheet` →
    `HOME_MOVE_*` / `SHEET_MOVE_*` (commentaire jsdoc actualisé:
    the fallback `default` now targets `home` or `sheet`, not
    `global`). E2E `settings-keybindings.spec.ts`: three conflict
    tests refactored to use the intra-`global` pair
    `toggle-help`/`toggle-settings` (the previous test setup
    relied on cross-context conflict detection which no longer
    exists); the reset test now uses `keybinding-combo-add` after
    the original combo is replaced. No persistence migration: the
    app is pre-production and stored bindings referencing the old
    `global.move-*` ids are silently dropped by `mergeWithDefaults`.
    826/826 unit ✓, 75/75 E2E ✓, build ✓.

  - **Step 3 (docs + tracker)**: `docs/keybindings.md` updated —
    `ACTION_IDS` example reflects the split, context table mentions
    per-surface movement actions with a note explaining the
    rationale, `resolveAction` example uses `HOME_MOVE_*`,
    "Conflict detection" section prefixed with an explicit
    "scope-local" statement, and the obsolete 5-sub-tab settings
    table replaced by the actual L2/L3 layout from FP13
    (Sub-tab × Sub-sub-tab × Contexts). Tracker entry written
    (this entry).

- [/] **FP14d**. **Section-based keybinding editor + `LAYOUT_EXIT`
  unification**. Two coordinated changes shipped in a single commit:

  1. **`LAYOUT_EXIT` unification**: the three identical exit
     handlers (`LAYOUT_NAV_EXIT`/`LAYOUT_MOVE_EXIT`/`LAYOUT_RESIZE_EXIT`,
     each binding `Escape` to `exitMode()` in its sub-scope) were
     collapsed into a single `LAYOUT_EXIT` action registered on the
     parent `layout` scope (`Escape`). Possible because (a) the
     three handlers had identical bodies, and (b) the sub-scopes are
     non-modal since FP2, so `Escape` cascades from the active
     sub-scope up to the parent. Removed from `ACTION_IDS` and
     `DEFAULT_KEYBINDINGS` for `layout-navigation`, `layout-move`,
     `layout-resize`; `use-layout-keyboard.ts` collapsed from three
     `useAction(... "layout-*", ...)` calls to one
     `useAction(ACTION_IDS.LAYOUT_EXIT, "layout", ...)`. No
     persistence migration — stored bindings referencing the three
     obsolete ids are silently dropped by `mergeWithDefaults`.

  2. **Section-based editor**: the keybinding editor moved from a
     1:1 "one rendered block per context" model to an explicit
     `SectionConfig[]` model. Each section declares
     `{ id, label, description, context, actionIds }` — sections
     own their label (replacing the previous `CONTEXT_LABELS`
     lookup), a short description rendered under the title, and an
     explicit ordered list of action ids. The renderer
     (`SectionRenderer`, replacing `ContextSection`) filters
     `config[context]` against `section.actionIds` so a single
     context can be split across multiple sections without renaming
     anything in the source of truth. This enables:
     - **Resize 3-way split**: the `layout-resize` context now
       renders as three sections — "Resize" (8 grow + shrink),
       "Resize Strict" (8), "Resize Compact" (4) — stacked inside
       the Cheatsheet > Layout sub-sub-tab.
     - **Surface-specific Navigation sections**: `home` and
       `sheet` contexts each split into a "Misc" section + a
       "Navigation" section.
     - **Layout (parent) section** that now hosts
       `LAYOUT_GOTO_NAVIGATION/MOVE/RESIZE` and the new
       `LAYOUT_EXIT` together.
     - **Modals** section under Cheatsheet > General for
       `MODAL_MOVE_UP/DOWN`.
     `CONTEXT_LABELS` removed (dead). `keybinding-tabs-config.ts`
     rewritten around `SectionConfig` and `SUB_TABS` /
     `SUB_SUB_TABS` referencing section catalogues; intro text per
     sub-tab/sub-sub-tab preserved. Per-section descriptions
     authored for all 14 sections. Data attributes shifted from
     `data-testid="keybinding-context"` + `data-context=...` to
     `data-testid="keybinding-section"` + `data-section-id=...`
     (no E2E was relying on the previous attributes). CSS added
     `.sectionDescription` token-driven (`--text-sm`, `--fg-60`).

  3. **Intro phrasing**: the keybinding tab intro in
     `settings-panel.tsx` reworded from "Press
     <kbd>Shift</kbd>+<kbd>Click</kbd>" to "Hold <kbd>Shift</kbd>
     and click" — `Click` is not a keyboard key and rendering it
     as a keycap was misleading.

  Docs: `docs/keybindings.md` context table reworded (sub-scopes
  no longer mention "exit"; parent `layout` entry mentions the
  single `LAYOUT_EXIT` cascade target), "Layout cascade pattern"
  paragraph updated. `docs/ideas-backlog.md` illustrative example
  updated from `LAYOUT_NAV_EXIT` → `LAYOUT_EXIT`. Tracker entry
  written (this entry). 826/826 unit ✓, 75/75 E2E ✓, build ✓.

## Notes / cross-references

- F-polish FP2 changed only the modality of three scopes (`layout-*`)
  and the action set inside the `layout` scope. FP14a expanded the
  scope inventory from 11 to 13 by adding `home` and `sheet` as
  proper push-while-mounted scopes; FP14b further added `modal`
  (14 scopes total) to back the command-copy and item-detail
  modals with a true modal cascade barrier. FP14c put the new
  scopes to use: `MOVE_*` actions split per-surface
  (`HOME_MOVE_*`, `SHEET_MOVE_*`, `MODAL_MOVE_*`) and
  `findConflict` simplified to be strictly scope-local —
  cross-context shadowing is now the documented model.
- After FP2, `LAYOUT_NAV_TO_*` / `LAYOUT_MOVE_TO_*` / `LAYOUT_RESIZE_TO_*`
  are gone from `ACTION_IDS` — anything still referencing them
  (settings sub-tab heuristics, help modal entry lists, E2E specs)
  must be updated in the same commit.
- After FP14c, the original `ACTION_IDS.MOVE_LEFT` /
  `MOVE_RIGHT` / `MOVE_UP` / `MOVE_DOWN` (ids
  `global.move-*`) are gone — anything still referencing them
  (dispatch sites, help UI, E2E specs) must be updated in the
  same commit and routed to the per-surface variants
  (`HOME_MOVE_*`, `SHEET_MOVE_*`, `MODAL_MOVE_*`).
- After FP14d, `ACTION_IDS.LAYOUT_NAV_EXIT` /
  `LAYOUT_MOVE_EXIT` / `LAYOUT_RESIZE_EXIT` are gone — anything
  still referencing them (dispatch sites, doc examples) must be
  rerouted to the single `ACTION_IDS.LAYOUT_EXIT` registered on
  the parent `layout` scope. The keybinding editor no longer
  iterates over contexts directly: callers adding new actions
  must also declare them in a `SectionConfig` inside
  `keybinding-tabs-config.ts` to make them visible in the
  settings panel.

## Persistence migration policy (pre-release)

The project currently has a single user (the author) operating in
dev mode. Renames or removals of `ACTION_IDS` entries do NOT need
a migration path in `mergeWithDefaults`: unknown stored ids are
dropped silently and the user accepts that any customised binding
on the renamed/removed id will be lost. This policy applies as
long as the project remains in pre-release / unstable development.
Revisit before any public release.
