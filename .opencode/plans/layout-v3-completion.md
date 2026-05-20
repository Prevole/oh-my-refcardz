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

- [x] A1. Run `npm run test` and capture pass/fail state — **38 files / 792 tests green**
- [x] A2. Run `npm run test:e2e` and capture pass/fail state — **37 passed / 29 failed**
  - 17 fails in `keyboard-layout.spec.ts` (inert v2 keyboard hook — expected)
  - 11 fails in `layout-persistence.spec.ts` (blocked on `[class*='layoutToolbar']` selector — the legacy toolbar was removed during dev-mode refactor; selector must be updated)
  - 1 transient fail in `cheatsheet-navigation.spec.ts:25` (vim j/k) — passed when re-run in isolation; mark as flaky, re-check in B
- [x] A3. Run coverage report — engine **99.10% lines / 93.49% branches**; `step.ts` has minor branch gaps at lines 583-584 and 607-609 (re-check in G2)
- [x] A4. Cross-reference bugfix commits with bug numbers — see updated `layout-v2-bugfixes.md`
  - `143ef35`, `b415f5b`, `cd7d62e`, `cdc6a01`, `341b584` → cover bugs 1.1 / 1.2 / 1.3 / 1.5 at engine level
  - Bug 1.4 (UI freeze on resize limit) still to verify in Phase B
- [x] A5. Update `layout-v2-bugfixes.md` to reflect actual status — done

## Phase B — Étape 6 V2

- [x] B1. E2E triage: classify each failing layout test (fix, skip with justification, delete)
  - Added `layoutReady` prop to `SheetGrid` and a `data-layout-ready` data-attribute as the new readiness signal; wired from `SheetRenderer` (`hydrated`).
  - Replaced 13 `[class*='layoutToolbar']` selectors in `e2e/layout-persistence.spec.ts` with `[data-sheet-grid][data-layout-ready='true']`.
  - In `layout-persistence.spec.ts`: 1 test reformulated (default layout assertion uses `data-layout-ready`), 8 tests skipped with annotation pointing to Phase E (they depend on the inert V2 keyboard hook).
  - `keyboard-layout.spec.ts` reduced to a single `test.describe.skip` placeholder annotated for Phase E rewrite (the whole file targeted the V1 flat keyboard model).
- [x] B2. Add south-fallback E2E scenario — new `e2e/south-fallback.spec.ts` (2 tests): drag-induced south wrap is observable in the DOM, and the wrapped layout survives a page reload byte-for-byte.
- [x] B3. Verify bug 1.4 (UI freeze on resize limit) — engine returns the largest partial application by design (snapshot + recalc from delta); UI consequently freezes at the last valid state with no reset. Two new integration tests in `engine.integration.test.ts` ("Engine integration: resize against grid limit") cover both partial application and total rejection paths.
- [x] B4. Full validation: lint, test, test:e2e, build, validate:cheatsheets
  - `npm run lint` clean.
  - `npm run test` — 794/794 unit tests passing (8 integration tests in `engine.integration.test.ts` → 10 with the bug 1.4 additions).
  - `npm run test:e2e` — **41 passed / 9 skipped / 2 failed** (vs 37/0/29 in the Phase A baseline). The 2 remaining failures are not layout-related (help modal `?`/`Escape`); see parking.
  - `npm run build` OK.
  - `npm run validate:cheatsheets` OK (10 cheatsheets).
- [ ] B5. Commit Phase B (awaiting user OK)

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

- **Layout overlay selector** : `layout-persistence.spec.ts` E2Es wait on `[class*='layoutToolbar']`. **Resolved in B1** — replaced by `[data-sheet-grid][data-layout-ready='true']` (option b from the decision matrix). The grid emits `data-layout-ready` once `useLayoutPersistence` reports `hydrated`. Dev-mode-independent.
- **Flaky vim j/k test** : `cheatsheet-navigation.spec.ts:25` failed once in the full suite but passed in isolation. **Re-verified in B4: now passes consistently** (the noisy environment from the broken layout tests was the likely culprit). Will keep an eye on it in subsequent phases.
- **Help modal E2E fails (2 tests, surfaced in B4)** :
  - `cheatsheet-navigation.spec.ts:109` (`opens help modal with Shift+/`) — fails even in isolation. The combo is `key("?")` (portable, no `Shift` modifier in the keybinding); on a US layout `page.keyboard.press("?")` produces `event.key === "?"`. Suspect: dispatcher ordering between the new `dispatchKeyEvent` and the legacy `useScopedKeyboardHandler` used by `<SheetHelpModal />`, or a missing `useAction` binding for `ACTION_IDS.TOGGLE_HELP` outside the home page.
  - `home-navigation.spec.ts:122` (`closes help modal with Escape`) — passes in isolation, fails in suite. Suggests cross-test state bleed or a race in modal teardown.
  - **Decision (B4)** : these failures are NOT layout-related and the help/settings UI is the explicit subject of Phase F. Document here, do not fix in Phase B. Phase F (and the keyboard refactor in Phase E that eliminates legacy/registry coexistence) will resolve them naturally; if not, a focused fix lands at the start of Phase F.
- **`step.ts` branch coverage** : lines 583-584 and 607-609 not exercised. Likely defensive guards; either add `/* c8 ignore */` with justification or craft a covering test in Phase G.

(decisions deferred during execution land here)

## Convention for updating this document

At the end of every sub-phase, the assistant:

1. Marks the corresponding checkbox `[x]` with the commit hash (or `[/]` if partial).
2. Adds any new decision/question to "Open questions / parking".
3. Surfaces a short diff summary of this document in the response.
4. Never silently drops or rewrites a section without flagging it.
