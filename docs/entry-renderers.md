# Entry Renderers Architecture

The entry-renderers system provides a modular architecture for rendering cheatsheet entries. Each entry type (command, alias, text, keys, etc.) has its own renderer that self-registers with the central registry.

## Directory Structure

```
src/components/sheets/entry-renderers/
├── entry-registry.ts      # Core registry + registerHandler() + renderEntry()
├── entry-renderer.tsx     # Main component + explicit imports of each *-entry file
├── index.ts               # Public surface (re-exports `EntryRenderer` only)
├── anchor-entry.tsx       # Renders: anchor
├── title-entry.tsx        # Renders: title
├── command-entry.tsx      # Renders: command, alias, commandExample, commandExamples
├── path-entry.tsx         # Renders: file, where
├── text-entry.tsx         # Renders: text
├── keys-entry.tsx         # Renders: keys (keyboard shortcuts)
├── content-entry.tsx      # Renders: content, contentExample (code/config blocks)
├── settings-entry.tsx     # Renders: settings (bullet lists)
├── table-entry.tsx        # Renders: table (data tables)
├── step-entry.tsx         # Renders: step (labeled workflow steps)
└── link-entry.tsx         # Renders: link (external links with type variants)
```

## How It Works

### 1. Registry (`entry-registry.ts`)

The registry maintains a list of handlers and provides two exports:

- `registerHandler(key, renderFn)` - Registers a handler for a specific entry type
- `renderEntry(entry, context)` - Finds and executes the matching handler

```typescript
export function registerHandler<K extends keyof CheatSheetEntryMap>(
  key: K,
  render: (value: CheatSheetEntryMap[K], context: EntryContext) => ReactNode
): void;
```

### 2. Self-Registration

Each `*-entry.tsx` file defines its component and registers itself:

```typescript
// Example: title-entry.tsx
import { registerHandler } from "./entry-registry";

export function TitleEntry({ value }: { value: string }) {
  return <p className={styles.configTitle}>{value}</p>;
}

registerHandler("title", (value) => <TitleEntry value={value} />);
```

### 3. Import Registration (`entry-renderer.tsx`)

The main component explicitly imports every `*-entry.tsx` file to trigger their self-registration:

```typescript
import "./anchor-entry";
import "./command-entry";
import "./content-entry";
import "./keys-entry";
import "./link-entry";
import "./path-entry";
import "./settings-entry";
import "./step-entry";
import "./table-entry";
import "./text-entry";
import "./title-entry";
```

This triggers the self-registration of all handlers at module load time.

## Adding a New Entry Type

1. **Create the file** following the naming convention `{name}-entry.tsx`:

```typescript
// src/components/sheets/entry-renderers/mytype-entry.tsx
import { registerHandler } from "./entry-registry";
import styles from "../cheatsheet-rendering.module.css";

export function MyTypeEntry({ value }: { value: string }) {
  return <div className={styles.myType}>{value}</div>;
}

registerHandler("mytype", (value) => <MyTypeEntry value={value} />);
```

2. **Update the Zod schema** in `src/lib/yaml-cheatsheets.ts` to include the new entry type.

3. **Update `CheatSheetEntryMap`** in `entry-registry.ts`:

```typescript
export type CheatSheetEntryMap = {
  // ... existing types
  mytype: string;  // or string[], or whatever the value type is
};
```

4. **Add the import** in `entry-renderer.tsx`:

```typescript
import "./mytype-entry";
```

## Entry Context

Handlers receive an `EntryContext` object with contextual information:

```typescript
type EntryContext = {
  hasAliases: boolean;  // Whether the current item has alias entries
};
```

This allows handlers to adapt their rendering based on sibling entries. For example, the `command` handler shows a "Command" label only when aliases are present.

## Supported Entry Types

| Key | Value Type | Renderer | Description |
|-----|------------|----------|-------------|
| `title` | `string` | `TitleEntry` | Item title |
| `command` | `string` | `CommandLike` | Shell command |
| `alias` | `{ content: string, copy?: string }` | `AliasEntry` | Shortcut alias with display text and optional copy value |
| `commandExample` | `string` | `CommandLike` | Command example |
| `commandExamples` | `string[]` | `CommandLike` | Multiple command examples |
| `text` | `string` | `TextEntry` | Description text (supports inline code) |
| `anchor` | `string` | `AnchorEntry` | Invisible item anchor for in-page references |
| `keys` | `string[]` | `KeysEntry` | Keyboard shortcuts |
| `file` | `string` | `PathLike` | File path |
| `where` | `string` | `PathLike` | Location in app |
| `content` | `string` | `ContentEntry` | Code/config block |
| `contentExample` | `string` | `ContentExampleEntry` | Example-style code/config block |
| `settings` | `string[]` | `SettingsEntry` | Settings list |
| `table` | `{ headers?: string[], rows: { cols: string[] }[] }` | `TableEntry` | Data table with optional headers |
| `step` | `string` | `StepEntry` | Labeled workflow step (uppercase badge with accent dot) |
| `link` | `{ type, url, label? }` | `LinkEntry` | External link (types: `github`, `docs`, `website`) |
