# Architecture

oh-my-refcardz is a keyboard-first developer cheat sheet hub built with Next.js 16.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 16 (App Router, Turbopack) |
| Language | TypeScript |
| Styling | Tailwind CSS v4 (CSS-based config) |
| Content | YAML files with Zod validation |
| State | React Context + localStorage |
| Testing | Vitest (unit), Playwright (E2E) |

## Directory Structure

```
oh-my-refcardz/
├── content/cheatsheets/     # YAML cheatsheet files
│   ├── 01-tooling/          # Category folder
│   │   ├── _category.yaml   # Category metadata
│   │   ├── git.yaml         # Cheatsheet (slug = filename)
│   │   └── ...
│   └── 02-security/
│       └── ...
├── docs/                    # Project documentation
├── e2e/                     # Playwright E2E tests
├── scripts/                 # Build/validation scripts
└── src/
    ├── app/                 # Next.js App Router pages
    │   ├── page.tsx         # Home page (RSC)
    │   ├── home-client.tsx  # Home client component
    │   ├── globals.css      # Tailwind v4 config
    │   └── cheatsheets/[slug]/
    │       └── page.tsx     # Cheatsheet page
    ├── components/
    │   ├── help/            # Help modals
    │   ├── home/            # Home page components
    │   ├── settings/        # Settings panel
    │   ├── sheets/          # Cheatsheet rendering
    │   │   ├── entry-renderers/  # Modular entry types
    │   │   └── layout/      # Grid layout system
    │   └── ui/              # Shared UI components
    ├── hooks/               # React hooks
    │   ├── use-keybindings.tsx
    │   ├── use-keyboard-context.tsx
    │   └── ...
    └── lib/                 # Pure logic, utilities
        ├── keybindings.ts
        ├── yaml-cheatsheets.ts
        └── ...
```

## Data Flow

### Content Pipeline

```
YAML files (content/cheatsheets/)
    ↓
Zod validation (yaml-cheatsheets.ts)
    ↓
Typed data (YamlCheatSheet)
    ↓
React components (SheetRenderer)
    ↓
Entry renderers (command-entry, text-entry, etc.)
```

### State Management

| State | Storage | Provider |
|-------|---------|----------|
| UI settings (colors, layout) | localStorage | `UISettingsProvider` |
| Keybindings | localStorage | `KeybindingsProvider` |
| Keyboard scope | React state | `KeyboardContextProvider` |
| Sheet accent color | React context | `SheetAccentProvider` |
| Developer mode toggle | localStorage (`omr.developer-mode`) | `useDeveloperMode` hook |
| Live layout snapshot (positions) | React context | `LayoutSnapshotProvider` |

## Key Systems

### Entry Renderers

Modular system for rendering different entry types (command, text, keys, etc.).

See: [entry-renderers.md](./entry-renderers.md)

### Keybindings

Configurable keyboard shortcuts with scope management. The system uses a declarative action registry (`useAction(id, scope, handler)`) and a single global `KeyboardDispatcher` (mounted in `src/app/providers.tsx`) that walks the scope stack top-down on every `keydown`, dispatching to the first matching handler. Scopes are pushed with a per-call `modal` flag that controls cascade blocking.

Legacy direct listeners (`useScopedKeyboardHandler`, raw `window.addEventListener` with `matchesAction`) still coexist for older code paths.

See: [keybindings.md](./keybindings.md)

### Placeholders

User input prompts in commands with typed fields.

See: [placeholders.md](./placeholders.md)

### Cheatsheet Schema

YAML structure for defining cheatsheets.

See: [cheatsheet-schema.md](./cheatsheet-schema.md)

### Layout Engine

Grid layout solver with deterministic collision resolution (move, resize, push, shrink, wrap).

See: [layout-engine.md](./layout-engine.md) and [layout-actions.md](./layout-actions.md)

### Layout Snapshot

A read-only mirror of the live block positions, exposed through `LayoutSnapshotProvider` (mounted in the cheatsheet page) and consumed via `useLayoutSnapshot()`. The renderer publishes a new snapshot whenever the editor commits a layout change (initial hydration, user edits, reset). Consumers that need to follow the on-screen order — most notably the heading navigation sidebar — sort their items with `sortByLayoutOrder` (stable, `(y, x)` ascending) instead of relying on YAML declaration order.

Source: `src/components/sheets/layout/layout-snapshot.tsx`.

### Developer Mode

A diagnostic mode for cheatsheet layouts, toggled via `Ctrl+Shift+D` (the toggle uses a raw `window` listener so it always works, even while modal dev sub-scopes are active). Developer mode is independent of the layout edit mode. When active it pushes the modal `dev` scope, which isolates all other shortcuts. It renders:

- Numbered, interactive grid axes (hover bands, click-to-pin rows/columns, intersection highlighting, and a keyboard-driven cursor sub-mode entered via `Shift+G` → modal `dev-axes` scope).
- A sticky dev-mode bar at the top of the viewport with stats and a toolbar (Reset / Save / Recording / Logs). The Logs dropdown pushes the modal `dev-logs` scope.
- Enriched block badges showing the drift from the reference position captured when developer mode was last activated.

The Save button and the Logs dropdown are only mounted when `NODE_ENV=development`. Toggling developer mode off automatically stops any in-flight recording session.

Implementation:
- Hook: `src/lib/dev-mode/use-developer-mode.ts` (state, persistence)
- Storage: `src/lib/dev-mode/dev-mode-storage.ts` (pure functions, `localStorage`)
- Recorder singleton: `src/lib/dev-mode/recorder.ts` (debug session capture; retains `Debug*` internal naming)
- Components: `src/components/sheets/dev-overlay/` (bar, axes, logs dropdown), `src/components/dev-mode/` (inline recorder button)
- Wiring: `src/components/sheets/sheet-renderer.tsx`
- Dev API: `src/app/api/dev/debug/route.ts` (GET / POST / DELETE for `.debug-sessions/`)

See: [keybindings.md](./keybindings.md#developer-mode)

## Page Structure

### Home Page (`/`)

```
┌─────────────────────────────────────────┐
│ Header: Search, Settings, Help          │
├─────────────────────────────────────────┤
│ Categories                              │
│ ├── Category 1                          │
│ │   ├── Sheet Card                      │
│ │   └── Sheet Card                      │
│ └── Category 2                          │
│     └── ...                             │
└─────────────────────────────────────────┘
```

- Server Component fetches all sheet metadata
- Client Component handles keyboard navigation
- Cards link to individual cheatsheet pages

### Cheatsheet Page (`/cheatsheets/[slug]`)

```
┌─────────────────────────────────────────┐
│ Header: Title, Back, Settings, Help     │
├─────────────────────────────────────────┤
│ Blocks                                  │
│ ├── Heading                             │
│ ├── Card (draggable, resizable)         │
│ │   ├── Item                            │
│ │   │   ├── Entry (command)             │
│ │   │   └── Entry (text)                │
│ │   └── Item                            │
│ ├── Card                                │
│ └── Heading                             │
└─────────────────────────────────────────┘
```

- Cards can be dragged and resized
- Layout persists to localStorage
- Keyboard navigation between copyable elements

## Component Hierarchy

```
RootLayout
├── KeyboardContextProvider
│   └── KeyboardDispatcher (single global keydown listener)
├── KeybindingsProvider
├── UISettingsProvider
└── Page
    ├── SheetAccentProvider (cheatsheet page only)
    ├── SheetCommandsShell
    │   ├── SheetRenderer
    │   │   ├── SheetGrid
    │   │   │   └── SheetCard
    │   │   │       └── SheetItem
    │   │   │           └── EntryRenderer
    │   │   │               └── Terminal / TextEntry / ...
    │   ├── ItemDetailModal (portal)
    │   └── CommandCopyModal (portal)
    └── SheetShortcuts (keyboard handlers)
```

## Styling

### Tailwind v4

Configuration is in `src/app/globals.css`, not `tailwind.config.js`:

```css
@import "tailwindcss";

@theme {
  --color-accent: #3b82f6;
  --font-mono: "JetBrains Mono", monospace;
}
```

### CSS Modules

Component-specific styles use CSS Modules:

```
component.tsx
component.module.css
```

### Sheet Accent Color

Each cheatsheet defines an accent color that propagates via CSS variable:

```css
--sheet-accent: #F05032;  /* Git orange */
```

Used for borders, highlights, and modal styling.

## Testing Strategy

### Unit Tests (Vitest)

- Pure logic in `src/lib/`
- Layout algorithms
- Keybinding matching
- Placeholder parsing

Run: `npm run test`

### E2E Tests (Playwright)

- Keyboard navigation
- Drag & drop
- Copy functionality
- Layout persistence

Run: `npm run test:e2e`

## Performance Considerations

1. **Static Generation** — Cheatsheet pages are pre-rendered at build time
2. **Code Splitting** — Each page loads only necessary components
3. **localStorage** — Settings load synchronously to avoid flicker
4. **Debounced Layout** — Grid recalculation is debounced on resize

## Security

- No database or authentication
- No API routes with user input
- Content is static YAML files
- localStorage stores only UI preferences
