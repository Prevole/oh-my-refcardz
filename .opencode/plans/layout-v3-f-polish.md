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

- [ ] **FP3**. **Settings panel: width + title bar + UI tab compact**
  (points 1, 3, 8). Panel grows to 2/3 viewport width (with sensible
  bounds). The `SETTINGS` label becomes a real title bar
  (border-bottom, contrasted background, contains the close affordance).
  UI tab fields wrap into a 2-column grid (or capped width) to avoid
  visually drowning in the larger panel.

- [ ] **FP4**. **Real tabs, not pills** (points 2, 4). Replace the
  current pill-styled tab buttons with a true tab strip (underline on
  active, bottom-border on the strip, consistent across top-level
  Settings tabs and Keybindings sub-tabs). Same `<Tabs />` primitive,
  new CSS.

- [ ] **FP5**. **Dense tables + compact reset buttons** (points 5, 7).
  Reduce keybinding row padding and line-height for a tighter feel.
  Reset action / Reset all buttons become small, right-aligned (not
  full-width). Iterate on density.

- [ ] **FP6**. **Sub-tabs in help modal Layout & Developer** (point
  10). Layout tab gets nested tabs: Enter / Navigation / Move /
  Resize. Developer tab gets nested tabs: Dev / Logs / Axes. Reuses
  the shared `<Tabs />` primitive.

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
