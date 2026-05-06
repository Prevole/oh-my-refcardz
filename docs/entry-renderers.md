# Entry Renderers Architecture

The entry-renderers system provides a modular architecture for rendering cheatsheet entries. Each entry type (command, alias, text, keys, etc.) has its own renderer that self-registers with the central registry.

## Directory Structure

```
src/components/sheets/entry-renderers/
├── entry-registry.ts      # Core registry + registerHandler() + renderEntry()
├── entry-renderer.tsx     # Main component + auto-discovery via require.context
├── index.ts               # Public exports
├── title-entry.tsx        # Renders: title
├── command-entry.tsx      # Renders: command, alias, aliases, example, examples
├── path-entry.tsx         # Renders: file, where
├── text-entry.tsx         # Renders: text
├── keys-entry.tsx         # Renders: keys (keyboard shortcuts)
├── content-entry.tsx      # Renders: content (code blocks)
└── settings-entry.tsx     # Renders: settings (bullet lists)
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

The main component explicitly imports all `*-entry.tsx` files to trigger their self-registration:

```typescript
import "./command-entry";
import "./content-entry";
import "./keys-entry";
import "./path-entry";
import "./settings-entry";
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
| `alias` | `string` | `AliasesEntry` | Single alias |
| `aliases` | `string[]` | `AliasesEntry` | Multiple aliases (displayed as `(a\|b\|c)`) |
| `example` | `string` | `CommandLike` | Command example |
| `examples` | `string[]` | `CommandLike` | Multiple examples |
| `text` | `string` | `TextEntry` | Description text (supports inline code) |
| `keys` | `string[]` | `KeysEntry` | Keyboard shortcuts |
| `file` | `string` | `PathLike` | File path |
| `where` | `string` | `PathLike` | Location in app |
| `content` | `string` | `ContentEntry` | Code block |
| `settings` | `string[]` | `SettingsEntry` | Settings list |
