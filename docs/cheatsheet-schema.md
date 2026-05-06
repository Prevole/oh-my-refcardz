# Cheatsheet Schema

YAML cheatsheets follow a hierarchical structure: Sheet → Sections → Cards → Items → Entries.

## Structure Overview

```
Sheet
├── title: string
├── summary: string
├── color: hex color (#RRGGBB)
├── icon?: string (optional)
└── sections[]
    ├── title: string
    └── cards[]
        ├── title: string
        └── items[]
            ├── entries[] (required, min 1)
            └── detailedEntries[]? (optional)
```

## Frontmatter

Every cheatsheet requires these top-level fields:

```yaml
title: Git
summary: Essential Git commands for daily workflow
color: "#F05032"
icon: git  # optional, for home page display
```

| Field | Required | Description |
|-------|----------|-------------|
| `title` | Yes | Sheet name displayed in header |
| `summary` | Yes | Brief description for home page |
| `color` | Yes | Hex color for accent theming |
| `icon` | No | Icon identifier for home page card |

## Sections

Sections group related cards under a common heading.

```yaml
sections:
  - title: Basics
    cards:
      - title: Status
        items: [...]
      - title: Staging
        items: [...]
```

## Cards

Cards are visual containers with a title and list of items.

```yaml
cards:
  - title: Viewing Changes
    items:
      - entries:
          - command: git diff
      - entries:
          - command: git diff --staged
```

## Items

Items are the atomic units within a card. Each item has:

- `entries` (required): Content displayed directly in the card
- `detailedEntries` (optional): Extended content shown in a modal

```yaml
items:
  - entries:
      - aliases: [s, st, sta, stat]
      - command: git status
    detailedEntries:
      - text: Shows working tree status
      - example: git status -s
```

## Entry Types

Each entry is an object with exactly one key that determines its type.

### Command entries

```yaml
- command: git status              # terminal command
- alias: s                         # single alias
- aliases: [s, st, sta, stat]      # multiple aliases (grouped display)
- example: git status -s           # usage example (dashed border style)
- examples:                        # multiple examples
    - git log --oneline
    - git log --graph
```

Commands support placeholders for user input. See [placeholders.md](./placeholders.md) for syntax and escaping.

### Text entries

```yaml
- title: Working Directory         # section title within item
- text: Explanatory paragraph      # plain text description
```

### Keyboard entries

```yaml
- keys: [Ctrl, Shift, P]           # keyboard shortcut
```

### Path entries

```yaml
- file: ~/.gitconfig               # file path
- where: Settings > Git > Autofetch  # app navigation path
```

### Content entries

```yaml
- content: |                       # multi-line code/config block
    [alias]
      s = status
      co = checkout
- settings:                        # settings list
    - Auto Fetch = enabled
    - Prune on Fetch = enabled
```

## entries vs detailedEntries

Both use the same entry types, but serve different UI purposes.

### entries

- **Always visible** in the card
- **Compact display** optimized for scanning
- Contains the essential information (command, shortcut, etc.)

### detailedEntries

- **Hidden by default**, shown via info button (i)
- **Modal display** with more vertical space
- Contains extended documentation, examples, explanations
- Inherits sheet accent color for modal border/title

### Visual difference

```
┌─────────────────────────────────┐
│ Card: Viewing Changes           │
├─────────────────────────────────┤
│ Alias: $ git (d|di|dif)         │  ← entries (always visible)
│ Command: $ git diff        [i]  │  ← info button when detailedEntries exist
│ ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐  │
│ │ Example: $ git diff HEAD  │   │  ← example entry (dashed border)
│ └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘  │
└─────────────────────────────────┘

         ↓ Click (i) opens modal

┌─────────────────────────────────┐
│ git diff                        │  ← modal title (accent colored)
├─────────────────────────────────┤
│ Shows changes between working   │  ← detailedEntries rendered
│ directory and staging area.     │
│                                 │
│ ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐  │
│ │ $ git diff --stat         │   │
│ └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘  │
│                                 │
│                        [Esc]    │
└─────────────────────────────────┘
```

### When to use detailedEntries

- Long explanations that would clutter the card
- Multiple usage examples
- Edge cases or advanced options
- Related commands or alternatives

### Example

```yaml
items:
  - entries:
      - aliases: [d, di, dif]
      - command: git diff
      - example: git diff HEAD
    detailedEntries:
      - text: >
          Shows changes between working directory and staging area.
          Use --staged to see what will be committed.
      - example: git diff --stat
      - example: git diff --name-only
      - example: git diff HEAD~3..HEAD
```

## Validation

Run schema validation after editing YAML files:

```bash
npm run validate:cheatsheets
```

This checks all files in `content/cheatsheets/` against the Zod schema.

## File Organization

```
content/cheatsheets/
├── 01-tooling/           # category folder (NN-name format)
│   ├── _category.yaml    # category metadata (title, description)
│   ├── git.yaml          # cheatsheet (slug = filename)
│   └── diff-so-fancy.yaml
├── 02-security/
│   ├── _category.yaml
│   └── 1password.yaml
└── ...
```

Category folders are ordered by their numeric prefix. The `_category.yaml` file defines the category title and description shown on the home page.
