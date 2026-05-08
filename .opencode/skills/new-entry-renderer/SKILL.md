---
name: new-entry-renderer
description: Step-by-step workflow to create a new cheatsheet entry type (renderer, schema, registry, docs)
---

# Creating a New Entry Renderer

Use this workflow when adding a new entry type to the cheatsheet system.

## Prerequisites

Before starting, discuss with the user:
1. **Entry name** — The key that will be used in YAML (e.g., `mytype`)
2. **Value type** — What data structure the entry accepts (string, string[], object)
3. **Visual design** — How should it look? Reference existing renderers if similar.

## Step 1: Create the Renderer File

Create `src/components/sheets/entry-renderers/{name}-entry.tsx`:

```typescript
import { registerHandler } from "./entry-registry";
import styles from "../cheatsheet-rendering.module.css";

type Props = {
  value: /* value type here */;
};

export function {Name}Entry({ value }: Props) {
  return (
    // Render the entry
  );
}

registerHandler("{name}", (value) => <{Name}Entry value={value} />);
```

### Conventions:
- File name: `{name}-entry.tsx` (kebab-case)
- Component name: `{Name}Entry` (PascalCase)
- Use existing styles from `cheatsheet-rendering.module.css` when possible
- If new styles needed, either add to the shared CSS or create `{name}-entry.module.css`

## Step 2: Update the Type Map

In `src/components/sheets/entry-renderers/entry-registry.ts`, add the new type to `CheatSheetEntryMap`:

```typescript
export type CheatSheetEntryMap = {
  // ... existing types
  {name}: /* value type */;
};
```

## Step 3: Register the Import

In `src/components/sheets/entry-renderers/entry-renderer.tsx`, add the import:

```typescript
import "./{name}-entry";
```

This triggers self-registration at module load time.

## Step 4: Update the Zod Schema

In `src/lib/yaml-cheatsheets.ts`, add the new entry type to the schema.

Find the entry schema (likely a `z.object` with all entry types) and add:

```typescript
{name}: z.{appropriate_validator}().optional(),
```

## Step 5: Validate

Run the validation suite:

```bash
npm run validate:cheatsheets && npm run lint && npm run test
```

Fix any errors before proceeding.

## Step 6: Update Documentation

Update `docs/entry-renderers.md`:

1. Add the file to the directory structure diagram
2. Add a row to the "Supported Entry Types" table:

```markdown
| `{name}` | `{value_type}` | `{Name}Entry` | {description} |
```

## Step 7: Test with Real Content

Create or modify a YAML cheatsheet to use the new entry type. Verify:
1. The entry renders correctly
2. No console errors
3. Styling matches the design intent

Run `npm run dev` and visually verify in the browser.

## Checklist

- [ ] `{name}-entry.tsx` created with self-registration
- [ ] `CheatSheetEntryMap` updated in `entry-registry.ts`
- [ ] Import added to `entry-renderer.tsx`
- [ ] Zod schema updated in `yaml-cheatsheets.ts`
- [ ] `npm run validate:cheatsheets && npm run lint && npm run test` passes
- [ ] `docs/entry-renderers.md` updated
- [ ] Visually tested with real content
