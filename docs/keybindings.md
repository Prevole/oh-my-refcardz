# Keybindings System

The keybindings system provides configurable keyboard shortcuts with scope management, conflict detection, and localStorage persistence.

## Architecture Overview

```
src/lib/
├── keybindings.ts        # Action IDs, default config, key matching
├── keyboard-scope.ts     # Scope stack management
└── keybinding-utils.ts   # Merge, conflict detection utilities

src/hooks/
├── use-keybindings.tsx   # KeybindingsProvider, useKeybindings hook
└── use-keyboard-context.tsx  # KeyboardContextProvider, scope hooks

src/components/settings/
└── keybinding-editor.tsx # UI for customizing keybindings
```

## Core Concepts

### Actions

An action is a named operation that can be triggered by keyboard shortcuts:

```typescript
export const ACTION_IDS = {
  TOGGLE_HELP: "global.toggle-help",
  MOVE_UP: "global.move-up",
  COPY_COMMAND: "sheet-commands.copy",
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

Keybindings are grouped by context:

| Context | When active | Example actions |
|---------|-------------|-----------------|
| `global` | Always | Navigation, help, settings |
| `home` | Home page | Search, open sheet |
| `sheet` | Cheatsheet page | Back to home |
| `sheet-commands` | Cheatsheet page | Copy, show details, clear focus |
| `sheet-layout` | Cheatsheet page | Card navigation, resize |

### Scopes

Scopes control which keybindings are active. They form a stack:

```
["global"]                    # Base state
["global", "help"]            # Help modal open
["global", "settings"]        # Settings panel open
```

When a scope is pushed, keybindings in that scope become active. Scopes can block lower scopes (e.g., modal blocks global navigation).

## Usage

### Checking if an action matches

```typescript
import { useKeybindings } from "@/hooks/use-keybindings";
import { ACTION_IDS } from "@/lib/keybindings";

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

### Resolving multiple actions

When multiple actions could match, use `resolveAction`:

```typescript
const { resolveAction } = useKeybindings();

const matchedAction = resolveAction(event, [
  ACTION_IDS.MOVE_UP,
  ACTION_IDS.MOVE_DOWN,
  ACTION_IDS.COPY_COMMAND,
]);

if (matchedAction === ACTION_IDS.MOVE_UP) {
  // ...
}
```

### Scoped keyboard handlers

Use `useScopedKeyboardHandler` to only handle keys when a scope is active:

```typescript
import { useScopedKeyboardHandler } from "@/hooks/use-keyboard-context";

useScopedKeyboardHandler("global", (event) => {
  // Only called when "global" scope is active
  if (matchesAction(event, ACTION_IDS.TOGGLE_HELP)) {
    setHelpOpen(true);
  }
}, [matchesAction]);
```

### Managing scopes

Push/pop scopes when modals or panels open:

```typescript
import { useKeyboardScope } from "@/hooks/use-keyboard-context";

function Modal({ open }) {
  useKeyboardScope("help", open);
  // When open=true, "help" scope is pushed
  // When open=false, "help" scope is popped
}
```

## Adding a New Keybinding

### 1. Define the action ID

In `src/lib/keybindings.ts`:

```typescript
export const ACTION_IDS = {
  // ... existing
  MY_NEW_ACTION: "sheet-commands.my-action",
} as const;
```

### 2. Add to default config

In `src/lib/keybindings.ts`, add to the appropriate context:

```typescript
export const DEFAULT_KEYBINDINGS: KeybindingsConfig = {
  // ...
  "sheet-commands": [
    // ... existing
    {
      id: ACTION_IDS.MY_NEW_ACTION,
      label: "My new action",
      combos: [key("m"), combo("m", "shift")],  // Multiple bindings OK
    },
  ],
};
```

### 3. Handle the action

In your component or hook:

```typescript
if (matchesAction(e, ACTION_IDS.MY_NEW_ACTION)) {
  e.preventDefault();
  doMyAction();
}
```

### 4. Update help modal (optional)

If the action should appear in the help modal, add it to the relevant help component in `src/components/help/`.

## Customization

Users can customize keybindings via Settings (`","` key):

- Add/remove key combos for any action
- Set primary combo (shown in UI)
- Reset individual actions or all to defaults
- Conflicts are auto-resolved (new binding wins)

Customizations are stored in localStorage under `oh-my-refcardz:keybindings`.

## Conflict Detection

When adding a combo that's already bound to another action:

1. The conflict is detected via `findConflict()`
2. The old binding is automatically removed
3. The new binding is added
4. A `KeybindingConflict` object is returned for UI feedback

## Key Sequences

For multi-key sequences like Vim's `gg`:

```typescript
{
  id: ACTION_IDS.GO_TOP,
  label: "Go to top",
  combos: [sequence(key("g"), key("g"))],
}
```

The system tracks pending sequences with an 800ms timeout.

## Best Practices

1. **Use contexts appropriately** — Global actions in `global`, page-specific in their context
2. **Provide multiple bindings** — e.g., both `j` and `ArrowDown` for accessibility
3. **Check scope before handling** — Use `isScopeActive()` or `useScopedKeyboardHandler`
4. **Prevent default** — Call `e.preventDefault()` when handling to avoid browser defaults
5. **Document in help modal** — Add new actions to the appropriate help component
