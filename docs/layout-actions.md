# Layout Actions

This document maps **user inputs** (mouse + keyboard) to **engine operations** and their `OperationOptions` flags.

For the algorithmic contract, see [`layout-engine.md`](./layout-engine.md).

---

## OperationOptions recap

```ts
type OperationOptions = {
  allowWrap?: boolean;    // default: true
  allowShrink?: boolean;  // default: true
  compact?: boolean;      // default: false (resize-shrink only)
};
```

### Semantics

| Flag | true = | false = |
|---|---|---|
| `allowWrap` | The engine may relocate (wrap) a saturated neighbor to the opposite side or south fallback. | The engine rejects the step instead of wrapping; partial progress is kept. |
| `allowShrink` | Neighbors in the chain may be shrunk to absorb pressure. | The engine rejects the step instead of shrinking neighbors. |
| `compact` | Resize-shrink also pulls opposite-side neighbors into the freed space. | Resize-shrink only changes the primary; freed cells stay empty. |

`compact` is **ignored** when the operation is `move` or `resize` with positive delta (expand). It only takes effect on `resize` with negative delta.

---

## Mouse mapping

### Drag (move)

Source: `use-card-drag-v2.ts`. Pointer drag on a card body translates the card.

| Modifier | kind | allowWrap | allowShrink | compact | Effect |
|---|---|---|---|---|---|
| — | `move` | `true` | `true` | n/a | Default: chain may push, shrink, wrap |
| Alt | `move` | `false` | `false` | n/a | Strict: only pure displacement; reject otherwise |

Implementation note: Alt state is tracked continuously during drag. Releasing Alt mid-drag re-enables wrap/shrink for subsequent steps.

### Resize handle

Source: `use-card-resize-v2.ts`. Pointer drag on N/S/E/W resize handles.

| Modifier | kind | allowWrap | allowShrink | compact | Effect |
|---|---|---|---|---|---|
| — | `resize` | `true` | `true` | `false` | Default: resize cascades naturally |
| Alt | `resize` | `false` | `false` | `false` | Strict: no neighbor disturbance |
| Shift | `resize` | `true` | `true` | `true` | Compact: shrink pulls opposite side toward primary |

Notes:

- `Shift` is only meaningful on resize-shrink (`delta < 0`); ignored on expand.
- `Alt + Shift` together: `Alt` wins (strict mode), compact is ignored. Documented but not encouraged.

---

## Keyboard mapping

The keyboard system uses **modes** inspired by Zellij. A configurable **master key** enters a layout interaction context where free keys (no modifiers) drive the engine.

### Modes

| Mode | Purpose | Engine operation produced |
|---|---|---|
| `navigation` | Move focus between cards | None (UI focus change only) |
| `move` | Translate the focused card | `move` |
| `resize` | Resize the focused card | `resize` |

When no mode is active, layout shortcuts do nothing — the user is in normal page navigation.

### Master key

Enters "layout mode". Default: `Ctrl+M` (configurable).

Default avoids common browser/OS reservations:
- `Ctrl+L` (address bar)
- `Ctrl+;` (awkward on AZERTY/non-US layouts)
- `Alt+Space` (window menu / Spotlight)
- `Ctrl+Space` (some IMEs)

After the master key is pressed, the next keystroke selects the sub-mode:

| Key | Sub-mode entered |
|---|---|
| `n` | navigation |
| `m` | move |
| `r` | resize |
| `Escape` | exit layout mode |

The current mode is reflected in a visible indicator (status bar / overlay). Within a mode, the user can perform multiple actions; `Escape` exits back to normal navigation.

### Modifier semantics within a mode

| Modifier | Role | Active in modes |
|---|---|---|
| `Shift` | Sense: bare = grow / forward, Shift = shrink / inverse | resize only |
| `Alt` | Strict: `allowWrap=false, allowShrink=false` | move, resize |
| `Ctrl` | Compact: `compact=true` (resize-shrink only) | resize only |

`Shift` is repurposed as a **sense modifier**, not a mode modifier. This is unambiguous because mode switching (`n`/`m`/`r`) is done with bare keys.

### Within `navigation` mode

| Key | Action |
|---|---|
| `h` / `ArrowLeft` | Focus the card to the left |
| `l` / `ArrowRight` | Focus the card to the right |
| `k` / `ArrowUp` | Focus the card above |
| `j` / `ArrowDown` | Focus the card below |
| `Escape` | Exit layout mode |
| `m` | Switch to move mode (keeps focus) |
| `r` | Switch to resize mode (keeps focus) |

### Within `move` mode

| Key | OperationOptions | Effect |
|---|---|---|
| `h` / `ArrowLeft` | default | move west by 1 |
| `l` / `ArrowRight` | default | move east by 1 |
| `k` / `ArrowUp` | default | move north by 1 |
| `j` / `ArrowDown` | default | move south by 1 |
| `Alt+h` / `Alt+ArrowLeft` | `allowWrap=false, allowShrink=false` | strict move west |
| `Alt+l` / `Alt+ArrowRight` | strict | strict move east |
| `Alt+k` / `Alt+ArrowUp` | strict | strict move north |
| `Alt+j` / `Alt+ArrowDown` | strict | strict move south |
| `Escape` | — | Exit layout mode |
| `n` | — | Switch to navigation mode |
| `r` | — | Switch to resize mode |

### Within `resize` mode

Bare keys grow the corresponding edge. `Shift` flips to shrink.

| Key | Edge | Delta | OperationOptions | Effect |
|---|---|---|---|---|
| `h` / `ArrowLeft` | west | +1 | default | grow west edge |
| `l` / `ArrowRight` | east | +1 | default | grow east edge |
| `k` / `ArrowUp` | north | +1 | default | grow north edge |
| `j` / `ArrowDown` | south | +1 | default | grow south edge |
| `Shift+h` / `Shift+ArrowLeft` | west | −1 | default | shrink west edge |
| `Shift+l` / `Shift+ArrowRight` | east | −1 | default | shrink east edge |
| `Shift+k` / `Shift+ArrowUp` | north | −1 | default | shrink north edge |
| `Shift+j` / `Shift+ArrowDown` | south | −1 | default | shrink south edge |
| `Alt+h` / `Alt+ArrowLeft` | west | +1 | strict | strict grow west |
| `Alt+l` / `Alt+ArrowRight` | east | +1 | strict | strict grow east |
| `Alt+k` / `Alt+ArrowUp` | north | +1 | strict | strict grow north |
| `Alt+j` / `Alt+ArrowDown` | south | +1 | strict | strict grow south |
| `Shift+Alt+h` / `Shift+Alt+ArrowLeft` | west | −1 | strict | strict shrink west |
| `Shift+Alt+l` / `Shift+Alt+ArrowRight` | east | −1 | strict | strict shrink east |
| `Shift+Alt+k` / `Shift+Alt+ArrowUp` | north | −1 | strict | strict shrink north |
| `Shift+Alt+j` / `Shift+Alt+ArrowDown` | south | −1 | strict | strict shrink south |
| `Ctrl+Shift+h` / `Ctrl+Shift+ArrowLeft` | west | −1 | `compact=true` | compact shrink west |
| `Ctrl+Shift+l` / `Ctrl+Shift+ArrowRight` | east | −1 | `compact=true` | compact shrink east |
| `Ctrl+Shift+k` / `Ctrl+Shift+ArrowUp` | north | −1 | `compact=true` | compact shrink north |
| `Ctrl+Shift+j` / `Ctrl+Shift+ArrowDown` | south | −1 | `compact=true` | compact shrink south |
| `Escape` | — | — | — | Exit layout mode |
| `n` | — | — | — | Switch to navigation mode |
| `m` | — | — | — | Switch to move mode |

`Ctrl` (compact) is only meaningful on shrink (`Shift+`). `Ctrl` on bare (grow) is ignored.

### Replacing existing keybindings

The existing `CARD_NAV_*`, `CARD_MOVE_*`, `CARD_SHRINK_*`, `CARD_GROW_*` action IDs in `src/lib/keybindings.ts` were designed for a flat (non-modal) model and are **deprecated** by this design. They will be replaced by:

| New action ID | Default |
|---|---|
| `LAYOUT_ENTER_MODE` | `Ctrl+M` (configurable) |
| `LAYOUT_SUB_NAVIGATION` | `n` |
| `LAYOUT_SUB_MOVE` | `m` |
| `LAYOUT_SUB_RESIZE` | `r` |
| `LAYOUT_EXIT_MODE` | `Escape` |
| `LAYOUT_DIRECTION_LEFT` | `h` and `ArrowLeft` (modifier-free; modifiers applied dynamically) |
| `LAYOUT_DIRECTION_RIGHT` | `l` and `ArrowRight` |
| `LAYOUT_DIRECTION_UP` | `k` and `ArrowUp` |
| `LAYOUT_DIRECTION_DOWN` | `j` and `ArrowDown` |
| `LAYOUT_DEV_SAVE` | (dev only, see [Persistence](#persistence)) |
| `TOGGLE_DEVELOPER_MODE` | `Ctrl+Shift+D` (see [Keybindings](./keybindings.md#developer-mode)) |

Modifiers (`Shift`, `Alt`, `Ctrl`) are read from the event at action time, not bound separately. This keeps the action set small.

Conflict check with non-layout features:
- Global navigation `h/j/k/l` (ACTION_IDS `MOVE_LEFT/...`): active only outside layout mode — no conflict.
- Sheet shortcuts `y` (copy), `i` (show details): active only outside layout mode — no conflict.
- Home `i` (toggle info), `/` (search): home scope only — no conflict.

---

## Pixel-to-cell conversion

Mouse-driven sources must convert pixel deltas to **cell deltas** before invoking the engine. The conversion is owned by the input layer, not the engine.

| Input | Cell delta formula |
|---|---|
| Mouse drag | `dx = round(pixelDx / cellWidth)`, `dy = round(pixelDy / cellHeight)` |
| Mouse resize | Same per axis, applied to `delta` |
| Keyboard | Always ±1 per keypress |

The engine receives a single `Operation` per discrete change. The engine internally decomposes `dx, dy` into unit steps; the input layer does **not** need to call the engine multiple times.

---

## Session lifecycle

A session corresponds to one user gesture:

| Source | Session start | Session end |
|---|---|---|
| Mouse drag | `pointerdown` on a card | `pointerup` or `pointercancel` |
| Mouse resize | `pointerdown` on a resize handle | `pointerup` or `pointercancel` |
| Keyboard | Each keypress | End of the same keypress (synchronous) |

The session boundary determines the scope of the **initial-size memory** used by wrap-restore. Once a session ends, the next gesture starts a fresh memory.

For mouse drag/resize: the input layer calls the engine on every meaningful pointer move during a single session. The engine snapshots initial sizes only on the **first call** of the session; subsequent calls within the same session reuse the snapshot. The input layer signals session boundaries through the engine (mechanism: TBD in implementation; likely an explicit `session.begin()` / `session.end()` or a session ID threaded through `EngineOptions`).

---

## Persistence

Two persistence layers, with different lifecycles.

### localStorage (automatic, end-user)

Every committed layout change is written to `localStorage` automatically. On page reload, the saved layout is restored.

- **Trigger**: end of every committed engine operation (`session.end` with `accepted = true`).
- **Storage key**: `sheet-layout:<slug>`.
- **Format**: 1-indexed `{ colStart, rowStart, colSpan, rowSpan }` per block (converted from the engine's 0-indexed `{x, y, w, h}` via `src/lib/layout/migration.ts`).
- **Owner**: the consumer hook (likely `use-layout-editor.ts`). The engine itself does not touch storage.

This behavior is **identical to V1** and is not in scope for the engine rewrite.

### Dev backend export (manual, developer)

In development mode (`NODE_ENV === "development"`), the user can save the current layout as a `.layout.json` file next to the `.yaml` cheatsheet. This is consumed by `getRenderableBlocks` at build time so the YAML "ships with" its layout.

The existing implementation in `src/lib/dev-layout-sync.ts` does this **automatically** (debounced 1s after every change). For V2, **this becomes manual**:

- **Trigger**: explicit user action via the `LAYOUT_DEV_SAVE` keybinding (default: TBD, suggested `Ctrl+S` while in layout mode, or a dedicated key once not in layout mode but only in dev).
- **Endpoint**: `POST /api/dev/layouts/[slug]` (unchanged).
- **Feedback**: a transient toast or status indicator confirming the save (e.g. "Layout saved to disk").
- **Disabled in production**: the keybinding is registered but does nothing if `NODE_ENV !== "development"`.

The existing `syncLayoutToDev` function will be refactored to remove the auto-debounce and expose a `saveLayoutToDev(slug, layouts)` that is called only on explicit user action.

---

## Future considerations

- ~~**Visual indicator** showing the current layout mode (status bar / accent overlay).~~ Implemented as `LayoutModePill` (top-right): pill colored per sub-mode (navigation = sheet accent, move = `--success`, resize = `--warning`). The same color cascades to the focused block highlight via the `--layout-mode-color` CSS variable set on the grid root.
- **Sticky modifiers** for repeated operations within a mode.
- **Undo/redo** on top of engine sessions (see `layout-engine.md`).
- **Touch input**: not in scope. Project is desktop-only.

### Implemented polish (Phase E2)

- **Closest-to-cursor initial focus** — When entering layout mode (`Ctrl+M`), the focused block is the one whose viewport-rect center is closest to the mouse pointer. Fallback: viewport center if no `mousemove` has been observed (pure-keyboard session). Final fallback: `pickTopLeftBlock` when no block has a rendered rect.
- **Viewport follow** — Changing focus (`h/j/k/l`) or moving/resizing the focused block triggers `scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" })` so the block stays visible even on long sheets.

### E2E coverage (Phase E3)

`e2e/keyboard-layout.spec.ts` exercises the full Zellij-style modal contract against a dedicated fixture at `content_test/cheatsheets/00-layout/layout-e2e.yaml` (one heading + a 2x2 card grid with ~60 free rows south). The fixture is served by Playwright's `webServer` via the `OH_MY_REFCARDZ_CONTENT_ROOT` environment variable; see [`architecture.md`](./architecture.md#test-content-fixtures).

Two timing helpers live in the spec to defeat React-scope race conditions:

- `switchSubMode(page, key, expected)` — presses `n`/`m`/`r`, asserts the pill's `data-mode` attribute, then yields one event-loop tick so the underlying keyboard scope dispatcher commits the new context before the next press.
- `enterLayoutMode(page)` — same yield after `Control+m`, so navigation keystrokes are not handled by the previous scope.

Without these yields, fast Playwright keypresses can outrun React state commits and hit the previous scope (e.g. a `j` after `m` would be handled as `nav-south` instead of `move-south`).

See [`layout-engine.md`](./layout-engine.md) for the engine contract and resolution pipeline.
