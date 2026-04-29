# Oh My Refcardz

Keyboard-first developer cheat sheets. Browse a grid of reference cards, navigate with `hjkl` or arrow keys, search instantly, and open any sheet — all without touching the mouse.

## Features

- Vim-style keyboard navigation (`hjkl` / arrows, `Enter`, `Esc`, `/` to search)
- MDX-powered cheat sheets with rich key combo rendering
- Responsive grid that adapts navigation to the current column layout
- Dark theme with a polished glassmorphism UI

## Available cheat sheets

| Slug | Title |
|---|---|
| `docker` | Docker |
| `git` | Git |
| `lazyvim` | LazyVim |
| `typescript` | TypeScript |

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Adding a cheat sheet

1. Create a new `.mdx` file in `content/cheatsheets/`:

```mdx
---
title: My Tool
summary: One-line description shown on the card.
color: "#6c8ebf"
---

<SheetGrid>
  <SheetCard title="Section title">
    |  |
    | --- |
    | <SheetCommand title="Do something" command="mytool run" description="What it does." /> |
  </SheetCard>
</SheetGrid>
```

2. Validate the frontmatter:

```bash
npm run validate:cheatsheets
```

The new card appears automatically on the home page.

### MDX components

| Component | Purpose |
|---|---|
| `<SheetGrid>` | Wraps all cards in a responsive grid |
| `<SheetCard title="">` | A named section block |
| `<SheetCommand title="" command="" description="">` | A single command entry |
| `<SheetCode>` | Inline key combo — renders `⌘ + K`, arrows, and single keys as styled glyphs |

## Tech stack

- [Next.js 16](https://nextjs.org) (App Router)
- [React 19](https://react.dev)
- [TypeScript 5](https://www.typescriptlang.org)
- [Tailwind CSS v4](https://tailwindcss.com)
- [MDX](https://mdxjs.com) via `next-mdx-remote`
- [Zod v4](https://zod.dev) for frontmatter validation

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start the development server |
| `npm run build` | Build for production |
| `npm run lint` | Run ESLint |
| `npm run validate:cheatsheets` | Validate all cheat sheet frontmatter against the Zod schema |
