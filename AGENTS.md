<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (especially `01-app/` and `03-architecture/`) before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Project: oh-my-refcardz

Single-package Next.js 16 app. Keyboard-first developer cheat sheet hub. Content is YAML files in `content/cheatsheets/`, parsed and rendered at request time. No database, no auth, no API routes.

Path alias: `@/*` → `./src/*`

---

## Agent Behavior

### Interaction Style

When the user asks a question:
1. **Pause** — do not immediately implement
2. **Analyze** — investigate the codebase if needed
3. **Propose** — present one or more solutions with tradeoffs
4. **Wait for approval** — only implement after the user confirms

This applies to questions like "how do I...", "can we...", "is it possible to...", "what about...". Direct instructions like "add X" or "fix Y" can proceed without waiting.

### Research Before Coding

Before implementing a solution to a problem:
1. **Search for existing solutions** — Look for libraries, plugins, or community patterns that solve the problem.
2. **Brief the user** — Present findings with pros/cons (bundle size, maintenance, fit with project).
3. **Wait for decision** — Only proceed after the user evaluates and approves (or rejects) the external solution.

Do not silently install dependencies. Do not assume coding from scratch is the right approach.

### Git Policy

Never perform write operations on git. The user handles all commits, pushes, merges, rebases, and other git write operations. Read-only git commands (status, diff, log, show, branch -l, etc.) are allowed.

### Documentation: No Duplication

All project documentation lives in `README.md` and `docs/`. Never duplicate information that already exists there. Reference it instead. If documentation needs updating, update the source file.

---

## Product Constraints

- Desktop and laptop only.
- Do not design for phone or tablet usage.
- Responsive work should target common desktop and laptop window sizes, not mobile breakpoints.

---

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
| `docs/**/*.md`, `README.md` | Review for consistency and accuracy |

---

## Testing

Two-tier approach: unit tests (Vitest) for pure logic, E2E tests (Playwright) for user journeys.

- **Unit tests**: Colocate with source as `*.test.ts`. Run with `npm run test`.
- **E2E tests**: Place in `e2e/` as `*.spec.ts`. Run with `npm run test:e2e`.

Maintain all existing tests. Create new tests when adding features or fixing bugs. If a test fails, fix the code or update the test — never delete a test without discussion.

---

## Code Conventions

### Linting

When running `npm run lint`, fix all reported issues — even those in files you did not directly modify. If a change triggers lint errors in related files (e.g., unused imports after refactoring), fix them.

### Comments

- Default to no comment.
- Only add a comment when it explains intent, a non-obvious constraint, a tradeoff, or surprising behavior.
- If a comment can become stale easily, prefer clearer code.

### CSS

Before writing or modifying CSS:
1. **Check existing tokens** — Review `src/app/globals.css` for CSS variables. Never hardcode values that exist as tokens.
2. **Check utility classes** — Review `src/styles/components.css` for reusable patterns.
3. **Use CSS functions** — Prefer `color-mix(in srgb, var(--success) 15%, transparent)` over hardcoded rgba values.

### Zod

This project uses Zod v4. Use `.error.issues` (not `.error.errors`) on `safeParse` results.

---

## Stack Notes

### Next.js 16

Key differences from earlier versions:
- `params` is a Promise — always `await params` in pages/layouts
- `next lint` removed — use `eslint` CLI directly
- `next build` does not run lint — run lint separately
- Turbopack is the default — do not add `--turbopack` flag or custom webpack config
- `cookies()`, `headers()`, `draftMode()` are async only
- `middleware.ts` is deprecated — use `proxy.ts` instead

For full details, consult `node_modules/next/dist/docs/`.

### Tailwind v4

No `tailwind.config.js`. Configuration is entirely in `src/app/globals.css` via CSS directives.

### Content Format

Cheatsheets are YAML files in `content/cheatsheets/`. Each file requires: `title`, `summary`, `color`. Run `npm run validate:cheatsheets` after changes. See `docs/cheatsheet-schema.md` for full schema.

---

## Documentation

| Document | Description |
|----------|-------------|
| `README.md` | Project overview, setup, adding cheatsheets |
| `docs/architecture.md` | System overview, directory structure, data flow |
| `docs/cheatsheet-schema.md` | YAML structure, entry types, detailedEntries |
| `docs/entry-renderers.md` | Modular renderer system, adding new types |
| `docs/keybindings.md` | Keyboard shortcuts system, scopes, adding actions |
| `docs/placeholders.md` | User input prompts in commands, escaping |

**After code changes**, check if related documentation needs updating:

| Changed area | Check these docs |
|--------------|------------------|
| YAML schema (`yaml-cheatsheets.ts`) | `docs/cheatsheet-schema.md` |
| Entry renderers (`entry-renderers/`) | `docs/entry-renderers.md` |
| Placeholder system | `docs/placeholders.md` |
| Keybindings | `docs/keybindings.md` |
| Architecture | `docs/architecture.md` |

---

## Common Mistakes to Avoid

### Code (CSS, TypeScript): Study before writing

1. **Map the existing system first** — Read the relevant files entirely (`globals.css`, `components.css`, utilities in `src/lib/`). Understand patterns before adding code.

2. **Extend, don't reinvent** — If a pattern exists, use it. If it's close but not quite right, extend it rather than creating a parallel solution.

3. **Trace dependencies** — Before modifying shared code, search for usages. Understand the impact radius.

4. **Pause before debugging** — If something doesn't work as expected, re-read the existing code instead of trial-and-error. The answer is usually in a rule or pattern you missed.

### Content (cheatsheets): Don't copy-paste patterns

1. **Content drives structure** — Don't force new content into existing entry types. Ask: what's the best way to present *this specific* information?

2. **Propose new blocks** — If no existing renderer fits well, imagine what would. Describe it, discuss tradeoffs, decide together whether to build it.

3. **Existing sheets are examples, not templates** — Each cheatsheet can have its own structure adapted to its subject matter.
