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

## Locked decisions

- Order: FP1 → FP6, commit at each border.
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
