# Keybindings System

The keybindings system provides configurable keyboard shortcuts with scope management, conflict detection, and localStorage persistence.

## Architecture Overview

```
src/lib/
├── keybindings.ts            # Action IDs, default config, key matching
├── keyboard-scope.ts         # Scope stack management
├── keyboard-dispatch.ts      # Pure cascade + modality + conflict routine
├── action-handler-registry.ts # (actionId, scope) -> handler singleton
└── keybinding-utils.ts       # Merge, conflict detection utilities

src/hooks/
├── use-keybindings.tsx       # KeybindingsProvider, useKeybindings hook
├── use-keyboard-context.tsx  # KeyboardContextProvider, scope hooks
└── use-action.ts             # useAction(actionId, scope, handler)

src/components/keyboard/
└── keyboard-dispatcher.tsx   # Single global keydown listener

src/components/settings/
├── settings-panel.tsx        # Right slide-in panel (66vw), top-level Tabs (UI / Keybindings)
├── tabs.tsx                  # Shared <Tabs /> primitive used by settings + sub-tabs
├── keybinding-editor.tsx     # Editable keybindings UI, 5 sub-tabs by context group
└── keybinding-display.tsx    # Shared keycap / combo rendering primitives (KeycapDisplayInner, ComboDisplay, HelpRow, ActionInlineBinding, useActionCombos)

src/components/help/
├── sheet-help-modal.tsx      # Reference modal opened with `?` — 4 tabs (App Shortcuts / Layout / Developer / Symbol Legend). Layout and Developer tabs have nested sub-tabs.
├── keybinding-chart.tsx      # Read-only chart used by sheet-help-modal (declarative entries)
├── contextual-inline-help.tsx # Inline help paragraph that adapts to the active scope (SCOPE_HELP_MAP)
└── inline-keybinding-help.tsx # InlineKeybinding atom (single binding inside running text)
```

There are **two coexisting handler paths**:

1. **Action registry + dispatcher (preferred)** — Declarative. Call `useAction(id, scope, handler)` to bind a handler to a `(actionId, scope)` pair. A single global `keydown` listener (the `KeyboardDispatcher`) walks the scope stack and runs at most one handler per event.
2. **Legacy direct listeners** — Older code uses `useScopedKeyboardHandler(scope, fn)` or raw `window.addEventListener("keydown", ...)` with `matchesAction(event, action)`. Still supported; new code should prefer the registry.

The two paths coexist without interference because the dispatcher only fires for actions explicitly bound through the registry; everything else is left to legacy listeners.

## Core Concepts

### Actions

An action is a named operation that can be triggered by keyboard shortcuts:

```typescript
export const ACTION_IDS = {
  TOGGLE_HELP: "global.toggle-help",
  HOME_MOVE_UP: "home.move-up",
  SHEET_MOVE_UP: "sheet.move-up",
  COPY_COMMAND: "sheet.copy",
  DEV_SAVE_LAYOUT: "dev.save-layout",
  // ...
} as const;
```

Action IDs follow the pattern `context.action-name`.

### Key Combos

A key combo defines how to trigger an action:

```typescript
interface KeyCombo {
  key: string;           // Key name (e.g., "j", "Escape", "ArrowUp")
  modifiers: Modifier[]; // ["ctrl", "alt", "shift", "meta"]
  next?: KeyCombo;       // For sequences (e.g., "g g")
}
```

Helper functions:
- `key("j")` — simple key
- `combo("j", "shift")` — key with modifier
- `sequence(key("g"), key("g"))` — two-key sequence

### Contexts

Keybindings are grouped by context. Adding a new context requires updating `KeybindingContext`, `scopeToContext()`, `DEFAULT_KEYBINDINGS`, `mergeWithDefaults()` and the settings editor (label + listing).

| Context | When active | Example actions |
|---------|-------------|-----------------|
| `global` | Always | Toggle help, toggle settings, `g g` / `G` jumps |
| `help` | Help modal open | Focus next/previous tab, descend to sub-tab row, activate focused tab |
| `settings` | Settings panel open | Focus next/previous tab, descend to sub-tab / sub-sub-tab row, activate focused tab |
| `home` | Home page | Grid navigation (`home.move-*`), search, open sheet |
| `sheet` | Cheatsheet page | Item navigation (`sheet.move-*`), copy, show details, back to home, reset layout, enter layout mode |
| `modal` | A command-copy or item-detail modal is open (modal scope, blocks cascade) | Vertical navigation (`modal.move-up` / `modal.move-down`), copy |
| `layout` | Layout editing mode (any sub-mode) | Parent (non-modal) scope; hosts sub-mode switching bindings (`n` / `m` / `b`), the exit binding (`Escape` → `LAYOUT_EXIT`), the commit binding (`Enter` → `LAYOUT_COMMIT`) and the reset binding (`Shift+R` → `LAYOUT_RESET`) shared across all sub-modes via the cascade |
| `layout-navigation` | Layout mode — navigation sub-mode | Focus left/right/up/down |
| `layout-move` | Layout mode — move sub-mode | Move focused block one cell (with optional strict modifier) |
| `layout-resize` | Layout mode — resize sub-mode | Grow / shrink the focused block (with strict and compact variants). The arrow always indicates the direction in which the moving edge travels: `h` / `←` grows leftward (extends the west edge to the west); `Shift+H` / `Shift+←` shrinks leftward (pulls the east edge to the west). Same convention on the vertical axis. This keeps grow and shrink directionally symmetric on the keyboard, even though they touch opposite edges internally. |
| `dev` | Developer mode active | Save/reset/record/logs/axes |
| `dev-logs` | Logs dropdown open | Cursor nav, copy, delete |
| `dev-axes` | Axes keyboard mode | Cursor nav, pin row/col |

Movement actions (`move-left`, `move-right`, `move-up`, `move-down`) are split per surface: `home.move-*`, `sheet.move-*`, and a vertical-only `modal.move-up` / `modal.move-down`. The `global` context no longer hosts movement bindings — each surface owns its own, which lets users customize navigation independently per scope.

### Layout mode visual feedback

When a `layout-*` scope is active, two visual cues confirm the current sub-mode:

- A floating **mode pill** in the top-right corner (`LayoutModePill`) shows the sub-mode label and a color: navigation = sheet accent, move = `--success`, resize = `--warning`. As soon as the buffered editor accumulates at least one staged change, the pill appends ` · N change(s)` in a muted style (singular for `N === 1`, plural otherwise).
- The focused block highlight uses the same color via the `--layout-mode-color` CSS variable, set on the `<SheetGrid>` root and consumed by `.cardKeyboardFocused` / `.headingBlockKeyboardFocused`.

Entering layout mode (`Ctrl+M`) focuses the block closest to the mouse cursor (fallback: viewport center, then top-left). On every focus change or move/resize, the focused block is scrolled into view (`block: "nearest"`).

A floating **reset button** (`LayoutBufferResetButton`) appears in the bottom-right corner whenever the buffer holds at least one staged change. Clicking it (or pressing `Shift+R`) rewinds the buffer to the snapshot captured on mode entry without exiting layout mode. The button hides again when the change count drops back to zero (via `Shift+R`, commit, or discard). It is mutually exclusive with the regular `LayoutResetButton`, which only surfaces outside layout mode when the persisted layout differs from the original YAML.

### Buffered editing model

Keyboard layout mode is a **buffered editor**: every move/resize/strict operation is applied to an in-memory snapshot, never directly to the persisted layout. The user explicitly leaves the mode either by:

- `Enter` (`LAYOUT_COMMIT`, scope `layout`): copies the buffer over the persisted layout via the same `useLayoutPersistence` path used by mouse-driven edits, then exits.
- `Esc` (`LAYOUT_EXIT`, scope `layout-*`) or any mouse click on a card / on the empty grid: discards the buffer and exits. When the buffer holds 5+ staged changes the discard is gated by the `LayoutDiscardConfirm` modal (scope `layout-discard-confirm`, modal); below the threshold the discard is silent.
- `Shift+R` (`LAYOUT_RESET`, scope `layout`): rewinds the buffer to the entry snapshot without exiting the mode. The change count returns to zero.

The pill counter and the floating reset button described above are the only UI surfaces of the buffer state. The full contract (counter semantics, op-equality rules, scope-stack interaction) lives in [`docs/layout-engine.md`](./layout-engine.md#buffered-keyboard-editing).

### Scopes

Scopes form a stack of `{ scope, modal }` entries:

```
[..., { scope: "global", modal: false }]                       # Base (always present)
[..., { scope: "home", modal: false }]                          # Home page mounted
[..., { scope: "sheet", modal: false }]                         # Cheatsheet page mounted
[..., { scope: "sheet", modal: false },
      { scope: "modal", modal: true }]                          # Command-copy/item-detail modal open
[..., { scope: "sheet", modal: false },
      { scope: "help",  modal: true  }]                         # Help modal open over a sheet
[..., { scope: "sheet", modal: false },
      { scope: "layout", modal: false },
      { scope: "layout-navigation", modal: false }]              # Layout mode (sub-mode navigation)
[..., { scope: "sheet", modal: false },
      { scope: "dev",   modal: true  },
      { scope: "dev-logs", modal: true }]                       # Dev mode with logs open
```

#### Modality (cascade blocking)

Each scope on the stack declares whether it is **modal**:

- **Non-modal**: an unmatched event cascades to the next lower scope.
- **Modal**: an unmatched event stops at this scope. The cascade does not reach lower scopes.

Modality is **per-push**, not a global scope property — the same scope can be modal or not depending on the call site:

```typescript
useKeyboardScope("dev-logs", open, { modal: true });
```

The dispatcher cascade walks the stack top-down and stops on the first scope that yields a match. If a modal scope yields no match, the cascade halts there (preventing leak to lower scopes such as the parent `dev` mode).

**Layout cascade pattern**: the `layout` parent scope and its sub-scopes (`layout-navigation`, `layout-move`, `layout-resize`) are all **non-modal**. Layout mode is an *editing mode* rather than a UI modal: visually nothing is overlaid, so the user's perception is that the rest of the UI (the help button, settings button, theme toggle, etc.) remains reachable. Keeping `layout` non-modal lets configurable global shortcuts such as `?` (`TOGGLE_HELP`) and `,` (`TOGGLE_SETTINGS`) cascade down past it and reach the `global` scope where they are bound. Conflicting keys (`hjkl`, arrows, `m`, `r`, `n`, `Enter`, `Escape`, …) are explicitly bound in `layout-navigation`/`layout-move`/`layout-resize` or in the parent `layout` scope, so the dispatcher stops at the first match top-down and edit keys never leak to `sheet`.

In contrast, true UI modals — `help`, `settings`, `info`, `cheat-info-modal`, `cheat-copy-modal`, `layout-discard-confirm`, `dev`, `dev-logs`, `dev-axes` — push their scope as modal so that unrelated keystrokes are captured (not allowed to fall through). Their close action (`HELP_CLOSE`, `SETTINGS_CLOSE`, `INFO_CLOSE`, …) is bound inside the modal scope itself and routes `Escape` to the modal's close handler instead of letting it cascade to a parent scope.

There is a single `LAYOUT_EXIT` action (instead of one exit per sub-mode), so users can rebind layout exit once and it applies everywhere.

## Usage

### Registering an action handler (recommended)

```typescript
import { useAction } from "@/hooks/use-action";
import { ACTION_IDS } from "@/lib/keybindings";

function MyComponent() {
  useAction(ACTION_IDS.DEV_SAVE_LAYOUT, "dev", () => {
    saveLayout();
  });
}
```

The handler reference is auto-refreshed; only `actionId` and `scope` participate in bind/unbind, so callers do not need to memoize the handler.

### Pushing a scope

```typescript
import { useKeyboardScope } from "@/hooks/use-keyboard-context";

function Dropdown({ open }) {
  // Modal so parent shortcuts do not leak through while open.
  useKeyboardScope("dev-logs", open, { modal: true });
}
```

### Legacy: direct matchesAction usage

```typescript
import { useKeybindings } from "@/hooks/use-keybindings";

function MyComponent() {
  const { matchesAction } = useKeybindings();

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (matchesAction(e, ACTION_IDS.COPY_COMMAND)) {
        e.preventDefault();
        handleCopy();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [matchesAction]);
}
```

This pattern is still used in many places; prefer `useAction` for new code.

### Resolving multiple actions (legacy)

```typescript
const matchedAction = resolveAction(event, [
  ACTION_IDS.HOME_MOVE_UP,
  ACTION_IDS.HOME_MOVE_DOWN,
  ACTION_IDS.OPEN_SHEET,
]);
```

### Scoped keyboard handler (legacy)

```typescript
useScopedKeyboardHandler("global", (event) => {
  if (matchesAction(event, ACTION_IDS.TOGGLE_HELP)) {
    setHelpOpen(true);
  }
}, [matchesAction]);
```

## Adding a new keybinding

### 1. Define the action ID

In `src/lib/keybindings.ts`:

```typescript
export const ACTION_IDS = {
  // ... existing
  MY_NEW_ACTION: "sheet.my-action",
} as const;
```

### 2. Add to default config

```typescript
export const DEFAULT_KEYBINDINGS: KeybindingsConfig = {
  // ...
  sheet: [
    // ... existing
    {
      id: ACTION_IDS.MY_NEW_ACTION,
      label: "My new action",
      combos: [key("m"), combo("m", "shift")],
    },
  ],
};
```

### 3. Register the handler

```typescript
useAction(ACTION_IDS.MY_NEW_ACTION, "sheet", () => {
  doMyAction();
});
```

(Note: most surface-level actions (`global`, `home`, `sheet`) currently use the legacy `useScopedKeyboardHandler` + `matchesAction` pattern. New sub-scopes added under modal modes like `layout` or developer mode flow through the registry by default.)

### 4. Surface the action in the help modal (optional)

If the action should appear in the in-app reference modal (opened with `?`), add it to one of the entry lists in `src/components/help/sheet-help-modal.tsx`:

- `NAVIGATION_ENTRIES`, `ACTION_ENTRIES`, `MISC_ENTRIES` — App Shortcuts tab
- `LAYOUT_LIFECYCLE_ENTRIES` — Layout tab → Lifecycle sub-tab (Enter, Reset, and the three Goto sub-mode actions interleaved into a 2-column chart)
- `LAYOUT_NAV_ENTRIES` — Layout tab → Navigation sub-tab
- `LAYOUT_MOVE_ENTRIES` — Layout tab → Move sub-tab
- `LAYOUT_RESIZE_ENTRIES` — Layout tab → Resize sub-tab (base 8 entries)
- `LAYOUT_RESIZE_ADVANCED_ENTRIES` — Layout tab → Resize sub-tab → "Show advanced variants" collapsible (12 entries: grow-strict, shrink-strict, shrink-compact)
- `DEVELOPER_TOP_ENTRIES` — Developer tab → Dev sub-tab
- `DEVELOPER_LOGS_ENTRIES` — Developer tab → Logs sub-tab
- `DEVELOPER_AXES_ENTRIES` — Developer tab → Axes sub-tab

Each list is rendered by `<KeybindingChart entries={...} cols={1|2} />`. Combos are resolved live via `useKeybindings`, so user customizations and resets reflect automatically.

### 5. Surface the action in the contextual inline help (optional)

The inline help paragraph at the top of the home and sheet pages (`<ContextualInlineHelp surface="home"|"sheet" />`) adapts to the active keyboard scope via the `SCOPE_HELP_MAP` in `src/components/help/contextual-inline-help.tsx`. To mention an action there, append a `{ kind: "key", actionId: ... }` token to the relevant entry's `tokens` array.

The map is keyed by `(surface, scope | "default")`. Modal scopes (`settings`, `help`, `info`, `layout`) intentionally have no entry and fall back to the surface's `default`: their overlays mask the inline help anyway.

## Customization

Users open the settings panel with `,`. The panel is a right slide-in (66vw, min 720 / max 1280) with two top-level tabs:

- **UI** — color mode, randomization, border style, sheet direction.
- **Keybindings** — the keybinding editor, organized as a two-level navigation:

  | Sub-tab | Sub-sub-tab | Contexts covered |
  |---|---|---|
  | General | — | `global`, `help`, `settings` |
  | Home | — | `home` |
  | Cheatsheet | General | `sheet` |
  | Cheatsheet | Layout | `layout`, `layout-navigation`, `layout-move`, `layout-resize` |
  | Cheatsheet | Developer | `dev`, `dev-logs`, `dev-axes` |

  Sub-tabs that cover a single context hide the context heading; multi-context sub-tabs stack `<h4>` headers per context. The selected top-level tab, Keybindings sub-tab and sub-sub-tab are all persisted in `useUISettings.panelTabs` (`active`, `keybindingsSub`, `keybindingsSubSub`), so the panel reopens where the user left it.

For each action the user can:

- Add or remove key combos
- Set the primary combo (shown in UI)
- Reset individual actions or all actions to defaults

**Primary combo contract.** The first combo in an action's list is the "primary" binding. Contextual inline hints across the app (modal footers, dev mode bar, info modals, contextual help line) show **only the primary**, never the full list, to keep the UI compact. Settings highlights the primary with an amber-tinted background and exposes the contract through its tooltip; `Shift+Click` on any other combo promotes it to primary. If you add a custom combo and want it to appear in hints, set it as primary.

Conflicts are auto-resolved (new binding wins) and surfaced as a dismissible warning via `[data-testid="keybinding-conflict"]`.

Customizations are stored in localStorage under `oh-my-refcardz:keybindings`. UI settings (including the panel's tab state) live under `oh-my-refcardz:ui-settings`.

## Conflict detection

Conflicts are **scope-local**: two bindings only conflict when they live in the same keybinding context. Cross-context shadowing (e.g. a `home` override masking a `global` binding while the home scope is active) is intentional and never reported as a conflict — the scope stack guarantees only one context's binding is active at a time.

Two layers:

### Editor-level (definition conflicts)

When adding a combo to an action that collides with another action **in the same context**, `findConflict()` detects it; the old binding is removed and a `KeybindingConflict` object is returned for UI feedback.

### Dispatcher-level (runtime conflicts)

When two handlers in the **same scope** both match the same event, the dispatcher applies strict conflict detection:

- `NODE_ENV === "development"`: throws `Conflicting key handlers in scope "X": ...`. This guarantees a conflict is caught during development.
- Other environments: calls `onConflict(scope, ids)` (which logs a warning) and runs the first matching handler deterministically.

This catches the case where two actions in the same context happen to share a combo and both have handlers bound.

## Key sequences

For multi-key sequences like Vim's `gg`:

```typescript
{
  id: ACTION_IDS.GO_TOP,
  label: "Go to top",
  combos: [sequence(key("g"), key("g"))],
}
```

The system tracks pending sequences with an 800ms timeout.

## Best practices

1. **Prefer `useAction`** over raw `window.addEventListener` for new code.
2. **Use modality** when pushing scopes that represent modal UI (dropdowns, sub-modes). This prevents parent shortcuts from leaking through.
3. **Provide multiple bindings** — e.g., both `j` and `ArrowDown` for accessibility.
4. **Document in help modal** — Add new actions to the appropriate help component.

## Developer mode

Developer mode is a diagnostic overlay used to inspect the grid and the layout engine on cheatsheet pages. It is independent of layout edit mode and can be active at any time. State persists across reloads via `localStorage` (key `omr.developer-mode`).

### Toggle

| Action ID | Default combo | Scope |
|---|---|---|
| `sheet.toggle-developer-mode` (`ACTION_IDS.TOGGLE_DEVELOPER_MODE`) | `Ctrl+Shift+D` | `sheet` (raw `window` listener — bypasses the dispatcher so dev mode can always be toggled) |

The shortcut collides with the browser's "Bookmark all tabs" default; the listener calls `preventDefault()` to suppress it.

### Modal scope stack

When dev mode is on, the stack typically looks like:

```
global → dev (modal)
global → dev (modal) → dev-logs (modal)
global → dev (modal) → dev-axes (modal)
```

Because `dev` is modal, all sheet/global shortcuts are inert while in dev mode. The two exceptions are `Ctrl+Shift+D` (toggle dev mode) and `Ctrl+Shift+S` (layout dev save), which run on dedicated listeners and bypass the dispatcher.

### Scope `dev` actions (bare keys)

| Action | Default | Effect |
|---|---|---|
| `DEV_SAVE_LAYOUT` | `s` | Save the current layout via `/api/dev/layouts/[slug]` (dev only) |
| `DEV_RESET_LAYOUT` | `w` | Reset to the cheatsheet default (no-op if no local override) |
| `DEV_TOGGLE_RECORDING` | `r` | Start / stop the debug recorder |
| `DEV_TOGGLE_LOGS` | `o` | Open / close the recorded-sessions dropdown |
| `DEV_ENTER_AXES_MODE` | `Shift+G` | Enter the keyboard-driven axes selection sub-mode |

### Scope `dev-logs` actions (dropdown open)

| Action | Default | Effect |
|---|---|---|
| `DEV_LOGS_CURSOR_DOWN` | `j`, `↓` | Move cursor down (cyclic) |
| `DEV_LOGS_CURSOR_UP` | `k`, `↑` | Move cursor up (cyclic) |
| `DEV_LOGS_COPY_FILENAME` | `y` | Copy selected filename |
| `DEV_LOGS_DELETE` | `d` | Delete selected session |
| `DEV_LOGS_DELETE_ALL` | `Shift+D` | Delete all sessions |
| `DEV_LOGS_REFRESH` | `Shift+R` | Refresh list |
| `DEV_LOGS_CLOSE` | `Esc` | Close dropdown |

### Scope `dev-axes` actions (axes keyboard mode)

| Action | Default | Effect |
|---|---|---|
| `DEV_AXES_CURSOR_LEFT` | `h`, `←` | Move virtual cursor left |
| `DEV_AXES_CURSOR_RIGHT` | `l`, `→` | Move virtual cursor right |
| `DEV_AXES_CURSOR_UP` | `k`, `↑` | Move virtual cursor up |
| `DEV_AXES_CURSOR_DOWN` | `j`, `↓` | Move virtual cursor down |
| `DEV_AXES_TOGGLE_COL` | `Space`, `Enter` | Pin / unpin the column at the cursor |
| `DEV_AXES_TOGGLE_ROW` | `Shift+Space`, `Shift+Enter` | Pin / unpin the row at the cursor |
| `DEV_AXES_CLEAR_ALL` | `c` | Clear all pinned rows / columns |
| `DEV_AXES_EXIT` | `Esc` | Exit axes mode (returns to `dev` scope) |

### Overlay components

- **Axes rulers** — Numbered X (0..35) and Y (0..maxRow-1) labels around the grid. Hover (mouse over the grid or label) highlights a row/column. Click toggles a stronger "pinned" highlight. In axes keyboard mode, pointer tracking is suspended and a virtual cursor (driven by the actions above) replaces hover; bands appear solid (vs dashed) to distinguish them from a fleeting mouse hover.
- **Dev-mode bar** — Sticky status bar with slug, grid dimensions, block count, layout state, and toolbar (`Reset`, `Save`, `Recording`, `Logs`).
- **Block badges** — Every block shows its dev ID, block ID, current grid position, and (if drifted) the position recorded when developer mode was last activated.

The "initial position" reference is captured at the moment developer mode is toggled **on**, not at page load. Toggling off and on again resets the reference.

Turning developer mode **off** while a recording session is active automatically stops the recording (the session is persisted with the description `auto-stopped (dev mode off)`).

