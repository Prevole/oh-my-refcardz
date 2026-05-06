# Command Placeholders

Commands and examples in YAML cheatsheets can include placeholders that prompt users for input before copying.

## Syntax

```
<name>          # string placeholder (default)
<name:string>   # explicit string placeholder
<name:int>      # integer placeholder
```

The `:type` suffix is hidden in the UI but controls the input field type in the copy modal.

## Supported Types

| Type | Input | Description |
|------|-------|-------------|
| `string` | text input | Free-form text (default) |
| `int` | text input, digits only | Numeric input (non-digit characters blocked) |

Unknown types fall back to `string`.

## Examples

### Basic placeholder

```yaml
- entries:
    - command: git checkout <branch>
```

Displays: `$ git checkout <branch>`  
Copy modal asks for: `branch` (text input)

### Typed placeholder

```yaml
- entries:
    - command: git log -n <count:int>
```

Displays: `$ git log -n <count>`  
Copy modal asks for: `count` (number input)

### Multiple placeholders

```yaml
- entries:
    - command: git diff <commit1>...<commit2>
```

Copy modal asks for both `commit1` and `commit2` in order.

### Placeholder with colon in name

Use the last colon as the type separator:

```yaml
- entries:
    - command: docker run <image:tag:string>
```

Displays: `$ docker run <image:tag>`  
Placeholder name: `image:tag`

## Escaping

To include literal `<...>` in a command without it being treated as a placeholder, escape the `<` with a backslash:

```yaml
- entries:
    - command: git log --pretty=format:'%C(bold blue)\<an>%Creset'
```

Displays: `$ git log --pretty=format:'%C(bold blue)<an>%Creset'`  
No placeholder prompt — the `\<` is converted to `<` in the output.

### Mixed escaped and real placeholders

```yaml
- entries:
    - command: git log \<an> -n <count:int>
```

Displays: `$ git log <an> -n <count>`  
Only `count` prompts for input.

## Behavior

1. **Display**: Placeholders show without the `:type` suffix
2. **Click copy**: Opens modal if placeholders present, direct copy otherwise
3. **Modal form**: Each placeholder gets an input field with appropriate type
4. **Preview**: Shows the command with current values substituted
5. **Empty values**: Kept as `<name>` in the copied command
6. **Duplicates**: Same placeholder appearing twice shows one input field

## Implementation

- Parser: `src/lib/placeholder-parser.ts`
- Modal: `src/components/sheets/command-copy-modal.tsx`
- Integration: `src/components/sheets/entry-renderers/command-entry.tsx`

### Parser API

```typescript
import {
  parsePlaceholders,
  hasPlaceholders,
  formatDisplayValue,
  buildCommand,
} from "@/lib/placeholder-parser";

// Extract placeholders from command
parsePlaceholders("git log -n <count:int>");
// => [{ raw: "count:int", name: "count", type: "int" }]

// Check if command has placeholders
hasPlaceholders("git status");      // false
hasPlaceholders("git log <branch>"); // true

// Format for display (hide :type)
formatDisplayValue("git log -n <count:int>");
// => "git log -n <count>"

// Substitute values
buildCommand("git log -n <count:int>", { "count:int": "5" });
// => "git log -n 5"
```

## Future Considerations

Potential type additions:
- `path` — file picker or path autocomplete
- `date` — date picker
- `enum:a|b|c` — dropdown with predefined values
