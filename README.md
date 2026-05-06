# Oh My Refcardz

Keyboard-first developer cheat sheets. Browse a honeycomb grid of reference cards, navigate with `hjkl` or arrow keys, search instantly, and open any sheet without touching the mouse.

## Product constraints

- Desktop and laptop only.
- The application is not designed for phone or tablet usage.
- Responsive behavior should target common desktop and laptop window sizes, not mobile breakpoints.

## Features

- Vim-style keyboard navigation (`hjkl` / arrows, `Enter`, `Esc`, `/` to search)
- YAML-powered cheat sheets with rich key combo rendering
- Honeycomb grid layout that adapts navigation to the current viewport
- Dark theme with a polished glassmorphism UI
- 22 cheat sheets across 2 categories (Tooling, Languages)

## Getting started

Requires Node.js `20.9+`.

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Adding a cheat sheet

1. Create a new `.yaml` file in `content/cheatsheets/<category>/`:

```yaml
title: My Tool
summary: One-line description shown on the card.
color: "#6c8ebf"
icon: mytool  # optional, matches /public/icons/mytool.svg

sections:
  - title: Section title
    cards:
      - title: Card title
        items:
          - type: command
            title: Do something
            command: mytool run
            description: What it does.
            commandExamples:  # optional
              - mytool run --verbose

          - type: shortcut
            keys:
              - "Ctrl + C"
            description: Copy to clipboard

          - type: config
            title: Shared profile
            file: ~/.gitconf/perso.config
            context: Included for repositories under ~/Documents/repositories/.
            content: |-
              [user]
                email = "me@example.com"
            description: Identity and signing defaults.
```

2. Validate the schema:

```bash
npm run validate:cheatsheets
```

The new card appears automatically on the home page.

Shortcut items accept one or more display strings. Examples:

- `"Ctrl + C"` for a combo
- `"j|k"` for alternatives
- `"/ <pattern>"` for mixed symbols and text
- `"←"`, `"→"`, `"↑"`, `"↓"` for arrows

Config items render a file-oriented config snippet. Fields:

- `title`: short label shown in the card
- `file`: source file path like `~/.gitconfig` or `.git/config`
- `context`: optional sentence explaining when the config applies
- `content`: raw config snippet content, usually written with YAML `|-`
- `description`: optional explanation of why that config exists

### Category metadata

Each category folder can have a `meta.yaml` file:

```yaml
title: Tooling
description: CLI tools and utilities for developers.
```

Folders are sorted by numeric prefix (e.g., `01-tooling/`, `02-languages/`).

## Keyboard shortcuts

### Home page

| Key | Action |
|-----|--------|
| `h` / `←` | Move left |
| `l` / `→` | Move right |
| `j` / `↓` | Move down |
| `k` / `↑` | Move up |
| `Enter` / `Space` | Open sheet |
| `/` | Focus search |
| `Esc` | Clear search |
| `i` | Toggle details |
| `?` | Toggle help |
| `,` | Toggle settings |
| `gg` | Go to top |
| `Shift+G` | Go to bottom |

### Cheat sheet page

| Key | Action |
|-----|--------|
| `h` / `←` | Move left |
| `l` / `→` | Move right |
| `j` / `↓` | Move down |
| `k` / `↑` | Move up |
| `y` | Copy command |
| `i` | Show example |
| `Esc` / `Backspace` | Back to grid |
| `?` | Toggle help |
| `,` | Toggle settings |
| `gg` | Go to top |
| `Shift+G` | Go to bottom |

## Tech stack

- [Next.js 16](https://nextjs.org) (App Router, Turbopack)
- [React 19](https://react.dev)
- [TypeScript 5](https://www.typescriptlang.org)
- [Tailwind CSS v4](https://tailwindcss.com)
- [Zod v4](https://zod.dev) for schema validation
- [Vitest](https://vitest.dev) for unit testing
- [Playwright](https://playwright.dev) for E2E testing

## Testing

The project uses a two-tier testing strategy:

### Unit tests (Vitest)

Unit tests cover pure logic functions in `src/lib/` and `src/components/sheets/layout/`. These are fast, isolated, and run with code coverage.

```bash
npm run test              # Run all unit tests
npm run test:watch        # Run in watch mode
npm run test:coverage     # Run with coverage report
```

Coverage is tracked only for unit tests because they measure actual logic coverage. The coverage configuration targets:
- `src/lib/**/*.ts` — utilities, color functions, keybindings, schemas
- `src/components/sheets/layout/**/*.ts` — layout algorithms and persistence logic

### E2E tests (Playwright)

E2E tests verify critical user journeys: keyboard navigation, drag & drop, and layout persistence. They run against a real browser (Chromium).

```bash
npm run test:e2e          # Run all E2E tests
npm run test:e2e:ui       # Run with Playwright UI (useful for debugging)
```

**Why no coverage for E2E?** E2E tests verify *user behavior*, not *code paths*. Coverage metrics would be diluted across the entire stack (React, Next.js, DOM) and wouldn't reflect meaningful test quality.

### What each tier tests

| Tier | Tests | Coverage |
|------|-------|----------|
| Unit | Logic functions, algorithms, validation | ✅ Yes |
| E2E | Navigation, drag & drop, persistence | ❌ No |

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start the development server |
| `npm run build` | Build for production |
| `npm run start` | Start the production server |
| `npm run lint` | Run ESLint |
| `npm run test` | Run unit tests |
| `npm run test:watch` | Run unit tests in watch mode |
| `npm run test:coverage` | Run unit tests with coverage report |
| `npm run test:e2e` | Run E2E tests (Playwright) |
| `npm run test:e2e:ui` | Run E2E tests with Playwright UI |
| `npm run validate:cheatsheets` | Validate all cheat sheets against the Zod schema |

Recommended checks before shipping content or UI changes:

```bash
npm run lint
npm run test
npm run test:e2e
npm run build
npm run validate:cheatsheets
```
