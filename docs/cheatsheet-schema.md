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
      - alias:
          content: "git (s|st|sta|stat)"
          copy: git s
      - anchor: working-tree-status
      - command: git status
    detailedEntries:
      - text: Shows working tree status
      - commandExample: git status -s
```

## Entry Types

Each entry is an object with exactly one key that determines its type.

### Command entries

```yaml
- command: git status              # terminal command
- alias:                           # shortcut alias
    content: "git (s|st|sta|stat)" # displayed text
    copy: git s                    # copied value (optional, defaults to content)
- commandExample: git status -s    # usage example (dashed border style)
- commandExamples:                 # multiple examples
    - git log --oneline
    - git log --graph
```

The `alias` entry displays a shortcut alias. Use `content` for what appears on screen (e.g., `cm <args>` or `git (s|st)`), and optionally `copy` to specify what gets copied to clipboard (defaults to `content` if omitted).

Commands support placeholders for user input. See [placeholders.md](./placeholders.md) for syntax and escaping.

### Text entries

```yaml
- title: Working Directory         # section title within item
- text: Explanatory paragraph      # plain text description
- text: Use [[1password]] for SSH signing
- text: Configure [[1password|1Password]] first
- text: Jump to [[#working-tree-status|status setup]]
- text: Open [[git#working-tree-status|Git status setup]]
```

Text and titles support inline code with backticks and references using:

- `[[slug]]` or `[[slug|label]]` for another cheatsheet
- `[[#anchor]]` or `[[#anchor|label]]` for an in-page anchor
- `[[slug#anchor]]` or `[[slug#anchor|label]]` for a specific anchor in another cheatsheet

### Anchor entries

```yaml
- anchor: working-tree-status
```

Anchor entries attach an `id` to the current item so inline references can link to it. Anchors must be explicit, lowercase kebab-case identifiers.

Rules:
- Use at most one `anchor` entry per item
- `anchor` is only supported in `entries`, not `detailedEntries`
- Place it near the top of the item for readability

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
- contentExample: |-               # example-style code/config block
    [include]
      path = ~/.gitconfig.local
- settings:                        # settings list
    - Auto Fetch = enabled
    - Prune on Fetch = enabled
```

### Table entries

```yaml
- table:
    headers:                       # optional column headers
      - Prefix
      - Effect
      - Example
    rows:
      - cols:
          - "`dot_`"
          - Maps to hidden path
          - "`dot_zshrc` → `.zshrc`"
      - cols:
          - "`private_`"
          - Restricts permissions
          - "`private_ssh/` → `ssh/`"
```

Tables support:
- Optional `headers` array for column titles
- Required `rows` array with `cols` for each row
- Inline formatting in cells (backticks for code, `[[slug]]` for cross-references)

### Step entries

```yaml
- step: Install                    # labeled workflow step
- step: Configure
- step: Run
```

Steps display as uppercase badges with an accent-colored dot. Use them to visually structure sequential workflows within a card.

### Link entries

```yaml
- link:
    type: github                   # github, docs, or website
    url: https://github.com/user/repo
    label: user/repo               # optional, inferred from URL if omitted
```

Links display as styled buttons with type-specific icons and colors:

| Type | Icon | Style | Use case |
|------|------|-------|----------|
| `github` | GitHub logo | Dark theme | Repository links |
| `docs` | Book icon | Cyan accent | Documentation links |
| `website` | External link | Blue accent | General web links |

The `label` is optional — for GitHub links, it defaults to `owner/repo`; for others, to the hostname.

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
│ │ Example: $ git diff HEAD  │   │  ← commandExample entry (dashed border)
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
      - alias:
          content: "git (d|di|dif)"
          copy: git d
      - command: git diff
      - commandExample: git diff HEAD
    detailedEntries:
      - text: >
          Shows changes between working directory and staging area.
          Use --staged to see what will be committed.
      - commandExample: git diff --stat
      - commandExample: git diff --name-only
      - commandExample: git diff HEAD~3..HEAD
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
