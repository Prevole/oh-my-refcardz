# Layout V3 Completion Plan

Reference document for finishing the layout V2 refactor on branch
`feature/layout-v3`. Updated at the end of each sub-phase.

This plan supersedes `.opencode/plans/layout-v2-bugfixes.md` for tracking
purposes; the older document remains for historical context but the
canonical roadmap is here.

## Status legend

- `[ ]` pending
- `[/]` in progress
- `[x]` done (commit hash)
- `[~]` deferred / out of scope

## Decisions snapshot

| # | Subject | Decision |
|---|---------|----------|
| C | Heading navigation | Option B — dedicated `LayoutSnapshotContext` |
| D | Persistence buffer | Vim model — every change writes to localStorage immediately |
| E.3.a | Old `CARD_*` action IDs | Full removal |
| E.3.b | Zellij keyboard | Immediate commit (each keystroke = one engine step) |
| F.4.a | Settings editor | Tabs + accordion |
| F.4.b | Help modal | CSS keycaps, no SVG |
| H | Undo/Redo | Full Phase H after G |
| Order | A→B→C→D→E→F→G→H | Confirmed |
| Commit granularity | One per sub-phase when possible | Confirmed |

## Phase A — Audit + plan refresh

- [ ] A1. Run `npm run test` and capture pass/fail state
- [ ] A2. Run `npm run test:e2e` and capture pass/fail state
- [ ] A3. Run coverage report for the engine (`npm run test:coverage`)
- [ ] A4. Cross-reference bugfix commits (`143ef35`, `b415f5b`, `cd7d62e`, `cdc6a01`, `341b584`) with the bug numbers in `layout-v2-bugfixes.md`
- [ ] A5. Update `layout-v2-bugfixes.md` to reflect actual status (mark Phase 1 done items, align Phase 3 on Zellij, mark Phase 4.2/4.3 deferred, add cross-link to this document)

## Phase B — Étape 6 V2

- [ ] B1. E2E triage: classify each failing layout test (fix, skip with justification, delete)
- [ ] B2. Add south-fallback E2E scenario
- [ ] B3. Full validation: lint, test, test:e2e, build, validate:cheatsheets

## Phase C — Heading nav (bug 2.1)

- [ ] C1. Design `LayoutSnapshotContext` (provider, consumer hook, snapshot shape)
- [ ] C2. Wire provider in `SheetRenderer`, publish snapshot on layout commits
- [ ] C3. Refactor `SheetHeadingNavigation` to consume the snapshot and sort by current Y/X
- [ ] C4. Tests: unit (sort helper), E2E (move heading, nav reflects new order)
- [ ] C5. Doc update if architecture.md needs the new context mentioned

## Phase D — Persistence buffer (Vim model)

- [ ] D1. Rename `hasSavedLayout` → `hasUnsavedChanges` (or equivalent) to reflect buffer-vs-saved semantics
- [ ] D2. Add visual indicator in dev bar / layout-status-pill when buffer differs from `.layout.json` content
- [ ] D3. Confirm and document Vim behaviour: every layout change writes to localStorage immediately (no commit boundary)
- [ ] D4. Watch out for drag-induced spam (60+ writes/sec). Decide whether a debounce is needed only during active drag
- [ ] D5. Tests: unit (`useLayoutPersistence`), E2E (drag → reload preserved, reset clears)

## Phase E — Keyboard Zellij modal

- [ ] E1. Scope architecture: introduce `layout`, `layout-navigation`, `layout-move`, `layout-resize` scopes (all modal). Validate stacking against the dispatcher
- [ ] E2. New `ACTION_IDS`: `LAYOUT_ENTER_MODE`, `LAYOUT_EXIT_MODE`, `LAYOUT_SUB_NAVIGATION`, `LAYOUT_SUB_MOVE`, `LAYOUT_SUB_RESIZE`, `LAYOUT_NAV_*`, `LAYOUT_MOVE_*` (+ strict), `LAYOUT_RESIZE_*` (+ strict + compact)
- [ ] E3. Remove old `CARD_*` IDs and the inert `use-card-keyboard-v2.ts` hook. Ensure `mergeWithDefaults` silently drops removed IDs from existing localStorage payloads
- [ ] E4. Implement `use-layout-keyboard` (or rename): mode state machine, scope push/pop, `useAction` handlers
- [ ] E5. Focus initial card near mouse cursor when entering layout mode
- [ ] E6. Visual indicators: mode badge in dev bar / status pill, focused-card highlight per sub-mode
- [ ] E7. Viewport follow: smooth-scroll focused card into view (reuse `auto-scroll.ts`)
- [ ] E8. Tests: unit (scope transitions, action mapping), integration (full mode sequence), E2E (rewrite `keyboard-layout.spec.ts`)
- [ ] E9. Doc: `docs/layout-actions.md` shifts from spec to reality; `docs/keybindings.md` lists new layout sub-scopes

## Phase F — UI help & settings

- [ ] F1. Refactor `keybinding-editor.tsx` to a tabs + accordion hierarchy (Global / Cheatsheet / Layout / Developer)
- [ ] F2. Restructure `sheet-help-modal.tsx` (Shortcuts / Layout / Developer / Legend) with CSS keycaps and per-sub-mode tables
- [ ] F3. Audit and update `inline-keybinding-help.tsx` to be context-aware (reacts to current scope stack)
- [ ] F4. Add a reusable `<KeybindingChart />` (or similar) component for per-sub-mode tables
- [ ] F5. Doc update: `docs/keybindings.md` "Customization" section if UX changes warrant it

## Phase G — Final validation

- [ ] G1. `npm run lint` clean (fix any unrelated lint debt that surfaces)
- [ ] G2. `npm run test` green; coverage ≥ existing thresholds (engine ≥ 99% lines/funcs)
- [ ] G3. `npm run test:e2e` green
- [ ] G4. `npm run build` OK
- [ ] G5. `npm run validate:cheatsheets` OK
- [ ] G6. Docs aligned with reality (`layout-engine.md`, `layout-actions.md`, `keybindings.md`, `architecture.md`)
- [ ] G7. `layout-v2-bugfixes.md` finalised: every item either done (with commit) or explicitly `[~]` deferred
- [ ] G8. Dead code purge (any leftover `CARD_*`, inert hooks, unused CSS classes)

## Phase H — Undo/Redo

- [ ] H1. Immutability audit of `applyOperation` — formal check that input `blocks[]` is never mutated
- [ ] H2. Design `LayoutHistory` data structure (pure, push/pop, capped size)
- [ ] H3. Reserve `ACTION_IDS.LAYOUT_UNDO` and `LAYOUT_REDO`; bind defaults (`u` / `Ctrl+R` or chosen alternatives) in the `layout` scope
- [ ] H4. Wire `LayoutHistory` into `LayoutEditor` at commit boundaries (one Vim keystroke = one undo step)
- [ ] H5. UI: indicate undo/redo availability (status pill or inline)
- [ ] H6. Tests: unit (`LayoutHistory`), integration (commit → undo → state matches pre-commit snapshot), E2E
- [ ] H7. Doc: extend `docs/layout-engine.md` with the history contract; mention in `docs/layout-actions.md`

## Architectural invariants (must hold throughout)

- `applyOperation` is pure: never mutates input `blocks`.
- `BlockLayoutState[]` is structurally cloneable and comparable.
- `LayoutEditor` commits are atomic snapshots (prerequisite for Phase H).
- The scope stack drives all keyboard routing; no parallel global flags.
- Engine emits typed events with no UI coupling.
- Doc updates accompany the code change in the same commit.

## Risks / open watchpoints

- **E2E baseline is currently broken** for layout keyboard. Phase B must decide skip/rewrite/delete before Phase E reconstructs them.
- **Conflict of truth between** `docs/layout-actions.md` (Zellij) and `layout-v2-bugfixes.md` (flat `Alt+Shift+Arrow`). Phase A acts the decision: **Zellij wins**.
- **Breaking change**: removing `CARD_*` IDs invalidates user customisations in localStorage. `mergeWithDefaults` must filter unknown IDs silently. Documented in the final PR.
- **Vim auto-save**: drag operations can produce 60+ writes/sec. Phase D evaluates whether to debounce during active drag (without introducing a commit/preview split in persistence).

## Open questions / parking

(decisions deferred during execution land here)

## Convention for updating this document

At the end of every sub-phase, the assistant:

1. Marks the corresponding checkbox `[x]` with the commit hash (or `[/]` if partial).
2. Adds any new decision/question to "Open questions / parking".
3. Surfaces a short diff summary of this document in the response.
4. Never silently drops or rewrites a section without flagging it.
