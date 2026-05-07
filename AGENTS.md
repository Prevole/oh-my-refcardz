<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Project: oh-my-refcardz

Single-package Next.js 16 app. Keyboard-first developer cheat sheet hub. Content is MDX files in `content/cheatsheets/`, rendered at request time via `compileMDX` from `next-mdx-remote/rsc`. No database, no auth, no API routes.

## Interaction Style

When the user asks a question:
1. **Pause** — do not immediately implement
2. **Analyze** — investigate the codebase if needed
3. **Propose** — present one or more solutions with tradeoffs
4. **Wait for approval** — only implement after the user confirms

This applies to questions like "how do I...", "can we...", "is it possible to...", "what about...". Direct instructions like "add X" or "fix Y" can proceed without waiting.

## Git Policy

Never perform write operations on git. The user handles all commits, pushes, merges, rebases, and other git write operations. Read-only git commands (status, diff, log, show, branch -l, etc.) are allowed.

## Product Constraints

- Desktop and laptop only.
- Do not design for phone or tablet usage.
- Responsive work should target common desktop and laptop window sizes, not mobile breakpoints.

## Commands

```bash
npm run dev                   # Dev server (Turbopack, localhost:3000)
npm run build                 # Production build (Turbopack)
npm run lint                  # ESLint — do NOT use `next lint`, it was removed in v16
npm run test                  # Unit tests (Vitest)
npm run test:coverage         # Unit tests with coverage
npm run test:e2e              # E2E tests (Playwright, requires dev server)
npm run validate:cheatsheets  # Validate YAML cheatsheets against Zod schema
```

## Validation Rules

**Run these checks automatically after making changes:**

| Changed files | Run |
|---------------|-----|
| `src/**/*.ts`, `src/**/*.tsx` | `npm run lint && npm run test` |
| `e2e/**/*.ts` | `npm run test:e2e` |
| `content/cheatsheets/**/*.yaml` | `npm run validate:cheatsheets` |
| `src/lib/yaml-cheatsheets.ts` (schema) | `npm run validate:cheatsheets && npm run test` |

**When to run E2E tests:**
- Changes to keyboard navigation logic (`use-keybindings.ts`, `use-command-navigation.ts`, `home-client.tsx`)
- Changes to drag & drop or layout persistence (`use-card-drag.ts`, `use-layout-persistence.ts`, `layout-*.ts`)
- Changes to core UI components that affect user interaction

**Skip E2E when:**
- Only modifying styles (CSS modules)
- Only modifying content (YAML files)
- Only modifying non-interactive components

## Linting

When running `npm run lint`, fix all reported issues — even those in files you did not directly modify during the session. If a change triggers lint errors in related files (e.g., unused imports after refactoring), fix them before committing.

## Testing Strategy

Two-tier testing approach:

### Unit tests (Vitest)
- **Scope**: Pure logic in `src/lib/` and `src/components/sheets/layout/*.ts`
- **Coverage**: Yes — tracked for unit tests only
- **Run**: `npm run test` or `npm run test:coverage`

### E2E tests (Playwright)
- **Scope**: User journeys — keyboard navigation, drag & drop, layout persistence
- **Coverage**: No — E2E tests verify behavior, not code paths
- **Run**: `npm run test:e2e` (starts dev server automatically)
- **Debug**: `npm run test:e2e:ui` for Playwright UI

### Key tested behaviors
- Home page: hjkl/arrow navigation, search, sheet selection
- Cheatsheet page: command navigation, copy, back navigation
- Layout: drag & drop cards, resize, localStorage persistence

### Adding tests
- Unit tests: colocate with source as `*.test.ts` (e.g., `keybindings.test.ts`)
- E2E tests: add to `e2e/` directory as `*.spec.ts`

## Architecture

```
content/cheatsheets/   # YAML content files — slug = filename without .yaml
e2e/                   # Playwright E2E tests (*.spec.ts)
scripts/               # validate-cheatsheets.ts (run via tsx)
src/
  app/
    page.tsx           # Home: async RSC, fetches all sheet metadata
    home-client.tsx    # Client component: grid + keyboard navigation
    globals.css        # Tailwind v4 config (no tailwind.config.js)
    cheatsheets/[slug]/
      page.tsx         # Compiles MDX, registers custom components
  components/          # SheetGrid, SheetCard, SheetCommand, SheetCode, Keycap, …
  lib/cheatsheets.ts   # FS reader + Zod frontmatter schema
```

Path alias: `@/*` → `./src/*`

## Next.js 16 Gotchas

- **`params` is a Promise** — always `await params` in pages/layouts.
- **`next lint` removed** — use `eslint` CLI directly (already done in npm script).
- **`next build` does not run lint** — run lint separately.
- **Turbopack is the default** for `dev` and `build` — do not add `--turbopack` flag or custom `webpack` config (breaks build).
- **`cookies()`, `headers()`, `draftMode()` are async only.**
- **`middleware.ts` is deprecated** — use `proxy.ts` instead.
- **`revalidateTag` requires a second `cacheLife` argument** — single-argument form is deprecated.
- **Parallel route slots require `default.js`** — omitting one breaks the build.
- **`serverRuntimeConfig` / `publicRuntimeConfig` removed** — use `process.env` + `NEXT_PUBLIC_` prefix.
- **`unstable_` prefix removed** from `cacheLife` / `cacheTag`.

## Tailwind v4

No `tailwind.config.js`. Configuration is entirely in `src/app/globals.css` via CSS directives.

## CSS Best Practices

Before writing or modifying CSS:

1. **Check existing design tokens first** — Review `src/app/globals.css` for CSS variables (colors, spacing, radius, transitions, shadows, z-index). Never hardcode values that exist as tokens.

2. **Check utility classes** — Review `src/styles/components.css` for reusable patterns (buttons, overlays, modals, badges, etc.). Use `composes:` from CSS Modules when appropriate.

3. **Use CSS functions over hardcoded colors** — Prefer `color-mix(in srgb, var(--success) 15%, transparent)` over `rgba(34, 197, 94, 0.15)`. This ensures consistency if token values change.

4. **Common tokens to use**:
   - Colors: `--fg-*`, `--bg-*`, `--border-*`, `--success`, `--success-light`, `--accent`, `--sheet-accent`
   - Spacing: `--space-1` through `--space-12` (4px increments)
   - Radius: `--radius-sm`, `--radius-md`, `--radius-lg`, `--radius-xl`, `--radius-full`
   - Transitions: `--transition-fast`, `--transition-normal`, `--transition-slow`
   - Shadows: `--shadow-sm`, `--shadow-md`, `--shadow-lg`, `--shadow-xl`
   - Z-index: `--z-base`, `--z-dropdown`, `--z-sticky`, `--z-overlay`, `--z-modal`

5. **Factor out repeated patterns** — If the same styles appear in multiple places, consider adding a utility class to `components.css`.

6. **Verify before committing** — After CSS changes, visually check the affected components to catch regressions.

## Comments

- Default to no comment.
- Keep code comments rare.
- Do not add comments that restate what the code already makes obvious.
- Only add a comment when it explains intent, a non-obvious constraint, a tradeoff, or surprising behavior.
- If a comment can become stale easily, prefer clearer code over a comment.

## MDX Content

- Each `.yaml` file must have frontmatter: `title` (string), `summary` (string), `color` (hex, e.g. `#FF0000`).
- After adding a cheatsheet, run `npm run validate:cheatsheets`.
- Custom MDX components (`SheetGrid`, `SheetCard`, `SheetCommand`, `code: SheetCode`) must be registered in `src/app/cheatsheets/[slug]/page.tsx`.
- Import from `next-mdx-remote/rsc`, not `next-mdx-remote`.

## Zod v4

This project uses Zod v4, not v3. Use `.error.issues` (not `.error.errors`) on `safeParse` results.

## Environment & Setup

- Node.js 20.9+ required (v18 not supported by Next.js 16).
- No `.env` needed — no environment variables in use.
- `next-env.d.ts` is auto-generated — do not edit.

## Documentation

Documentation lives in `docs/`. After making code changes, review documentation for necessary updates.

### Available documentation

| Document | Description |
|----------|-------------|
| [architecture.md](docs/architecture.md) | System overview, directory structure, data flow |
| [cheatsheet-schema.md](docs/cheatsheet-schema.md) | YAML structure, entry types, detailedEntries |
| [entry-renderers.md](docs/entry-renderers.md) | Modular renderer system, adding new types |
| [keybindings.md](docs/keybindings.md) | Keyboard shortcuts system, scopes, adding actions |
| [placeholders.md](docs/placeholders.md) | User input prompts in commands, escaping |

### Documentation review checklist

| Changed area | Check these docs |
|--------------|------------------|
| YAML schema (`yaml-cheatsheets.ts`) | `docs/cheatsheet-schema.md` |
| Entry renderers (`entry-renderers/`) | `docs/entry-renderers.md` |
| Placeholder system | `docs/placeholders.md` |
| Keybindings (`keybindings.ts`, `use-keybindings.tsx`) | `docs/keybindings.md` |
| Major architectural changes | `docs/architecture.md` |
| New feature or component | Consider if new doc needed |

### When reviewing docs, check for:

1. **Accuracy**: Does the doc reflect current behavior? Update outdated examples.
2. **Completeness**: Are all options/types documented? Add missing ones.
3. **Architecture**: Does the doc explain the "why", not just the "what"?
4. **Examples**: Are examples realistic and copy-pasteable?
5. **Cross-references**: Do related docs link to each other?

### After significant changes

Run a quick audit:
- List files in `docs/` and scan for stale content
- Check if new concepts need dedicated documentation
- Verify code examples still work
