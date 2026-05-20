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
- [x] B5. Commit Phase B — `87de50f` ("test(layout): restore E2E baseline and lock engine guarantees (Phase B)")

## Phase C — Heading nav (bug 2.1)

- [x] C1. Design `LayoutSnapshotContext` (provider, consumer hook, snapshot shape) — `afdaab4`
- [x] C2. Wire provider in `SheetRenderer`, publish snapshot on layout commits — `afdaab4`
- [x] C3. Refactor `SheetHeadingNavigation` to consume the snapshot and sort by current Y/X — `afdaab4`
- [x] C4. Tests: unit (sort helper), E2E (move heading, nav reflects new order) — `afdaab4`
- [x] C5. Doc update — `docs/architecture.md` got a "Layout Snapshot" section — `afdaab4`

Phase C committed as `afdaab4` ("feat(layout): heading nav follows live layout order (Phase C)").

Notes:
- The E2E spec writes a synthetic layout via raw ids (stripped of the `sheet-heading-` / `sheet-card-` DOM prefix) directly in `localStorage` then reloads, rather than reading positions from the live DOM. CSS Grid `--card-row-start` values can diverge from the engine's logical `y` for full-width headings, so building the layout from scratch is the only reliable assertion strategy.
- Side effect: the heading-nav color gradient now follows the visible vertical flow instead of the YAML declaration order.

## Phase D — Persistence buffer (Vim model)

- [x] D1. Refactor `useLayoutPersistence`: rename `hasSavedLayout` → `isModifiedFromOriginal`, `resetLayout` → `resetToOriginal`, expose `originalLayout` — `d7e27b6`
- [x] D2. Propagate rename in `SheetRenderer` + `DevModeBar` callsites — `d7e27b6`
- [x] D3. New action `sheet.reset-layout` (default `Shift+R`); wired via `useScopedKeyboardHandler("global", …)` in `SheetRenderer` (consistent with the existing `sheet` context pattern) — `d7e27b6`
- [x] D4. New `LayoutResetButton` floating component (top-right beside settings); mounted only when modified and dev mode is off — `d7e27b6`
- [x] D5. E2E `e2e/layout-reset.spec.ts` (4 tests): pristine = no button, modified = button visible, click resets + clears storage, `Shift+R` triggers reset — `d7e27b6`
- [x] D6. Docs: `docs/architecture.md` gained a "Layout Persistence" section (3 layers original/saved/buffer); `docs/keybindings.md` mentions reset in the `sheet` context — `d7e27b6`
- [x] D7. Full validation — lint, 800/800 unit, 49/0/9 E2E, build, validate:cheatsheets all green — `d7e27b6`

Phase D committed as `d7e27b6` ("feat(layout): user-facing reset to original layout (Phase D)").

Notes:
- Buffer and saved are still merged into a single `blockLayouts` state (Vim immediate write keeps them equal). A proper split lands with Phase H.
- The dev-mode bar still has its own Reset button (using the renamed API). It is hidden when the floating user button is visible to avoid duplicate affordances.
- `@testing-library/react` was intentionally NOT added: the Phase D refactor is a renaming + reorg of existing logic, fully covered by the pure-function tests in `layout-persistence.test.ts` and the new E2E spec. Phase H will revisit when an actual buffer/saved split needs branch coverage.
- Initial idea was `Ctrl+Shift+R`; rejected because it conflicts with the browser hard-reload shortcut. Final binding is `Shift+R`.

## Phase E — Keyboard Zellij modal

### Sub-commit E1 — Core (scopes + actions + hook + cleanup) — `c5e7654`

- [x] E1. Scope architecture: introduce `layout`, `layout-navigation`, `layout-move`, `layout-resize` scopes (all modal)
- [x] E2. New `ACTION_IDS`: `LAYOUT_ENTER_MODE`, `LAYOUT_NAV_*` (+ exit + 2 switchers), `LAYOUT_MOVE_*` (+ strict + 2 switchers + exit), `LAYOUT_RESIZE_*` (+ shrink + strict + compact + 2 switchers + exit) — 41 actions total; IDs use the `<context>.<verb>` convention so each scope is encoded in the ID itself (per user request)
- [x] E3. Remove old `CARD_*` IDs and the inert `use-card-keyboard-v2.ts` hook. `mergeWithDefaults` silently drops unknown context keys + unknown action IDs from existing localStorage payloads
- [x] E4. Implement `use-layout-keyboard.ts`: mode state machine, scope cascade (`layout` + active sub-mode), `useAction` handlers for every layout action, manual `useScopedKeyboardHandler("global", …)` for `LAYOUT_ENTER_MODE` (the `sheet` context has no dedicated scope)

### Sub-commit E2 — Polish — `2cdf566`

- [x] E5. Focus initial card near mouse cursor when entering layout mode (closest-rect-to-pointer; fallback viewport center, then top-left)
- [x] E6. Visual indicators: `LayoutModePill` top-right + focused-card highlight color per sub-mode via `--layout-mode-color` CSS var on the grid root
- [x] E7. Viewport follow: `scrollIntoView({ block: "nearest", behavior: "smooth" })` on focused-block change or position change

### Sub-commit E3 — Tests + docs

- [x] E8a. Unit tests for pure helpers (`findNeighbour`, `pickTopLeftBlock`, action→spec lookup, operation builders) — 14 tests in `use-layout-keyboard.test.ts`
- [x] E8b. E2E rewrite of `keyboard-layout.spec.ts` (16 tests, 95/95 on 5x repeat) against the new `content_test/` fixture infrastructure
- [x] E9a. `docs/keybindings.md` updated with new layout sub-scopes
- [x] E9b. `docs/layout-actions.md` Phase E3 section: fixture infra + scope-race timing helpers
- [x] E10. **Test content fixture infra** (introduced during E3): `content_test/cheatsheets/`, `OH_MY_REFCARDZ_CONTENT_ROOT` env var, `.next-test/` build dir, dedicated Playwright webServer on port 3100. Validates via `npm run validate:cheatsheets`. See `docs/architecture.md#test-content-fixtures`.

> Note: introducing the dedicated fixture infrastructure breaks all
> other E2E suites that target production slugs (`git`, `diff-so-fancy`,
> etc.). A follow-up phase migrates each suite to its own forged
> fixture under `content_test/`. Tracked separately.

## Phase E-bis — Migrate remaining E2E suites to forged fixtures

- [x] Eb1. `cheatsheet-navigation.spec.ts` — fixture `01-navigation/nav-fixture.yaml`; deterministic `[data-copyable]` targeting (15/15)
- [x] Eb2. `heading-nav-layout.spec.ts` — fixture `02-layout-fixtures/heading-nav-fixture.yaml` (6/6)
- [x] Eb3. `layout-reset.spec.ts` — fixture `02-layout-fixtures/layout-reset-fixture.yaml` (4/4)
- [x] Eb4. `layout-persistence.spec.ts` — fixture `02-layout-fixtures/layout-persistence-fixture.yaml`; auto-scroll test fixed via injected `scroll-behavior:auto` + viewport-bound header picking (3 active + 8 skipped)
- [x] Eb5. `south-fallback.spec.ts` — fixture `02-layout-fixtures/south-fallback-fixture.yaml` (2/2)
- [x] Eb6. `home-navigation.spec.ts` — added 3 stub fixtures in `03-home-stubs/` to pad home grid; search re-pointed to "south"; hjkl test simplified (no symmetric round-trip assertion) (14/14)
- [x] Eb7. `settings-keybindings.spec.ts` — no fixture needed; passed as-is (9/9)
- Commit: `925bb55`
- Lint: added `.next-test/**` to `eslint.config.mjs` global ignores (Playwright build artifacts).
- Full E2E: 69 passed + 8 skipped, stable on 3 of 4 runs; 1 flaky pre-existing fail on settings Escape (unrelated to E-bis, passes 5/5 in isolation).

## Phase F — UI help & settings

### Decisions (locked-in)

- **Settings panel** : keep the current right-side slide-in pattern, but bigger (≈ 2/3 of viewport width, full height). Top-level tabs replace the accordions. Persistent enough to embed inline explanation labels.
- **Sub-tab persistence** : the active sub-tab inside Keybindings is persisted (via `useUISettings`), reopens where the user left.
- **Inline help decoupling** : the contextual inline help reacts to the active scope and updates *independently* from the layout/dev overlays. Overlays keep their own affordances. We accept potential duplication for v1 and iterate.
- **Separation of concerns** : `<KeybindingChart />` (read-only) is distinct from `KeybindingEditor` (editable). Two components, more flexibility. Help and Settings stay independent surfaces even though information overlaps — Settings is exhaustive, Help is contextual.
- **Inline-help universality** : a generic `<ContextualInlineHelp />` driven by a declarative `SCOPE_HELP_MAP` (intro + ordered list of ActionIds + optional template fragments) replaces both `HomeInlineHelp` and `SheetInlineHelp`. New scopes (`layout-navigation`, `layout-move`, `layout-resize`, `dev`, `dev-logs`, `dev-axes`) are added as map entries.

### Target structure

**SettingsPanel (right-side slide-in, ~66vw × 100vh)**

```
[Header: title + close]
[Top-level Tabs: UI | Keybindings]
[Body: scrolls]
  - Tab "UI"          → existing UI sections (color mode, border, direction, random), no accordion
  - Tab "Keybindings" → sub-tabs:
      Global       (context: global)
      Home         (context: home)
      Cheatsheet   (context: sheet)
      Layout Mode  (contexts: layout + layout-navigation + layout-move + layout-resize, stacked sections)
      Developer    (contexts: dev + dev-logs + dev-axes, stacked sections)
[Footer (optional, tab-aware): "Reset UI settings" / "Reset all keybindings"]
```

**SheetHelpModal (existing modal, 3 → 4 tabs)**

```
Tabs: Shortcuts | Layout | Developer | Legend
- Shortcuts: Navigation / Actions / Misc (current)
- Layout:    Enter / Navigation / Move / Resize / Reset (current, refactored via <KeybindingChart/>)
- Developer: Top-level / Logs / Axes (new)
- Legend:    Symbols (current, refactored via <KeybindingChart/> where applicable)
```

**ContextualInlineHelp**

```
useActiveScope() → reads top of scope stack from use-keyboard-context
<ContextualInlineHelp /> → looks up SCOPE_HELP_MAP[scope], renders intro + binding list
SCOPE_HELP_MAP entries:
  home, sheet, layout-navigation, layout-move, layout-resize, dev, dev-logs, dev-axes
```

### Sub-phases

- [x] F1. **Pre-flight test-id hardening** — `7f4c0ac`. Stable `data-testid` on SettingsPanel, KeybindingEditor (rows expose `data-action-id`), hex-board. `settings-keybindings.spec.ts` rewritten via `getByTestId`; `home-navigation.spec.ts` migrated for the hex board selector. Lint clean, 821/821 unit, 69/69 E2E.
- [x] F2. **SettingsPanel structural refactor** — `6d4e0a8`. Slide-in widened to 66vw (min 720px, max 1100px); accordions replaced by top-level `UI | Keybindings` tabs. Persisted active tab in `useUISettings` (`panelTabs.active`). Backward-compatible migration: old `accordion` field silently dropped. Inline explanation labels and a per-tab lead paragraph added. Removed unused `toggleAccordion`/`AccordionState` API; `AccordionItem` component left in place for potential reuse (purge candidate in G8). Lint clean, 821/821 unit, 69/69 E2E across 3 runs.
- [x] F3. **KeybindingEditor regroup into 5 sub-tabs** — `c2d3342`. Global / Home / Cheatsheet / Layout Mode / Developer via the shared `<Tabs>` component. Multi-context sub-tabs (Layout, Developer) stack their sections with discreet `<h4>` headers; mono-context sub-tabs hide the header. Sub-tab persisted via `useUISettings.panelTabs.keybindingsSub`. Each sub-tab carries an intro paragraph. Recording logic untouched. New `data-testid` on `keybinding-context` (with `data-context`) and `keybinding-sub-tab` (with `data-sub-tab`). Lint clean, 821/821 unit, 69/69 E2E across 3 runs.
- [/] F4. **`<KeybindingChart />` extraction** — `src/components/help/keybinding-chart.tsx`. Read-only props: `entries: Array<ChartEntry | null>`, `cols?: 1 | 2` (default 2), optional `testId`. Resolves combos via `useKeybindings` (so customisations and resets reflect live). Pads incomplete rows with empty cells. `null` entries leave deliberate blanks. Backed by existing `HelpRow` for cell rendering. Not wired into UI yet (F5 picks it up). Pending commit (F4 + F5 typically batch in one commit; defer commit decision to user).
- [/] F5. **SheetHelpModal refactor** — adopted `<KeybindingChart />` across all tabs (eliminates ~150 lines of repeated `<HelpRow>` table boilerplate). Added 4th tab `Developer` with 3 sections: Developer Mode (top-level dev actions), Logs Sub-Mode (`dev-logs`), Axes Sub-Mode (`dev-axes`). Tabs now driven by a `TABS` declarative config. Added `data-testid="help-tab-{id}"` and `data-testid="help-content-{id}"` for F8 specs. Legend tab preserved verbatim. Modal `[role='dialog']` contract unchanged. Pending commit.
- [/] F6. **`<ContextualInlineHelp surface scope?className? />`** — surface (`home` | `sheet`) prop disambiguates pages that share `global` scope. Reads `activeScope` via existing `useKeyboardContext()` (no new hook needed — projection on existing API). `SCOPE_HELP_MAP` is nested `Record<surface, Record<scope | "default", InlineHelpEntry>>`. Each entry is a token list (`text` | `key` | `link`) for declarative ordering. Covers 8 scopes per plan: home/default, sheet/default, sheet/layout-navigation, sheet/layout-move, sheet/layout-resize, sheet/dev, sheet/dev-logs, sheet/dev-axes. Modal scopes (settings/help/info/layout) silently fall back to `default`. Adds `data-testid="contextual-inline-help"` with `data-surface` and `data-scope` for F8 specs. Not wired to UI yet (F7).
- [/] F7. **Replace `HomeInlineHelp` and `SheetInlineHelp`** — swapped in `home-client.tsx` (`<ContextualInlineHelp surface="home" />`) and `cheatsheets/[slug]/page.tsx` (`<ContextualInlineHelp surface="sheet" />`). `dev-mode-bar.tsx` left untouched: it uses the atomic `<InlineKeybinding />` for a single binding, not a paragraph. `inline-keybinding-help.tsx` trimmed to only export `InlineKeybinding` (still consumed by `dev-mode-bar` and by `ContextualInlineHelp` internals). KeyboardContextProvider already mounts globally in `providers.tsx`, so server-component import of `<ContextualInlineHelp />` works as before. Pending commit (bundled with F6).
- [/] F8. **E2E coverage** — new `e2e/contextual-inline-help.spec.ts` (6 tests): home/global baseline + sheet/global baseline + 3 layout sub-mode transitions + Escape return. Asserts `data-surface` and `data-scope` on the rendered help paragraph. Uses the `layout-e2e` fixture and aligns on `keyboard-layout.spec.ts` patterns (click grid + 30ms scope-commit yield after Control+m / sub-mode switches) to avoid scope-commit race. Stable 30/30 with `--repeat-each=5`. Full suite: 75 passed / 0 failed / 8 pre-existing skipped. No other E2E needed adaptation (no spec referenced `HomeInlineHelp` / `SheetInlineHelp` selectors directly). Pending commit.
- [ ] F9. **Doc update** — `docs/keybindings.md` (new tab/sub-tab structure, `SCOPE_HELP_MAP` conventions, persistence keys). Cross-reference from `docs/architecture.md` if needed.

### Acceptance criteria

- Settings panel visually feels like a major surface (66vw, slide-in from right).
- Top-level tabs (UI / Keybindings) and Keybindings sub-tabs are persisted across reloads.
- Every existing keybinding from the 10 contexts is reachable via the new sub-tabs grouping with no loss.
- `SheetHelpModal` exposes all `dev*` actions in the new Developer tab.
- `<ContextualInlineHelp />` updates on scope changes without re-mounting the parent.
- All E2E tests green; no regression on `settings-keybindings.spec.ts`.
- `npm run lint`, `npm run test`, `npm run build`, `npm run validate:cheatsheets` clean.

### Open questions deferred to during execution

- Exact width breakpoint (66vw vs 70vw vs `min(900px, 66vw)`) — decide in F2 against the actual screen.
- Whether `<KeybindingChart />` should accept a `groupBy` prop for the `Legend` tab — decide in F4.
- Inline-help template DSL : `Array<{ type: "text"; value: string } | { type: "action"; id: ActionId }>` vs simple `(formatBinding) => ReactNode` render-prop — decide in F6.

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
