<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Project: oh-my-refcardz

Single-package Next.js 16 app. Keyboard-first developer cheat sheet hub. Content is MDX files in `content/cheatsheets/`, rendered at request time via `compileMDX` from `next-mdx-remote/rsc`. No database, no auth, no API routes.

## Commands

```bash
npm run dev                   # Dev server (Turbopack, localhost:3000)
npm run build                 # Production build (Turbopack)
npm run lint                  # ESLint — do NOT use `next lint`, it was removed in v16
npm run validate:cheatsheets  # Validate MDX frontmatter against Zod schema
```

No test suite. No typecheck script (use `tsc --noEmit` manually if needed).

## Architecture

```
content/cheatsheets/   # MDX content files — slug = filename without .mdx
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

## MDX Content

- Each `.mdx` file must have frontmatter: `title` (string), `summary` (string), `color` (hex, e.g. `#FF0000`).
- After adding a cheatsheet, run `npm run validate:cheatsheets`.
- Custom MDX components (`SheetGrid`, `SheetCard`, `SheetCommand`, `code: SheetCode`) must be registered in `src/app/cheatsheets/[slug]/page.tsx`.
- Import from `next-mdx-remote/rsc`, not `next-mdx-remote`.

## Zod v4

This project uses Zod v4, not v3. Use `.error.issues` (not `.error.errors`) on `safeParse` results.

## Environment & Setup

- Node.js 20.9+ required (v18 not supported by Next.js 16).
- No `.env` needed — no environment variables in use.
- `next-env.d.ts` is auto-generated — do not edit.
