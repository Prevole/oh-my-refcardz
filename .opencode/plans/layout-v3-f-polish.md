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

## Notes / cross-references

- F-polish does not change the scope inventory (still 11 scopes), only
  the modality of three of them and the action set inside the
  `layout` scope.
- After FP2, `LAYOUT_NAV_TO_*` / `LAYOUT_MOVE_TO_*` / `LAYOUT_RESIZE_TO_*`
  are gone from `ACTION_IDS` — anything still referencing them
  (settings sub-tab heuristics, help modal entry lists, E2E specs)
  must be updated in the same commit.
