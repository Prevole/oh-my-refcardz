type PlaceholderType = "string" | "int";

export type Placeholder = {
  raw: string;
  name: string;
  type: PlaceholderType;
};

// Sentinel to temporarily replace escaped \< sequences
const ESCAPE_SENTINEL = "\x00ESCAPED_LT\x00";

/**
 * Replaces \< with a sentinel, applies the transform, then restores < for escaped sequences.
 * This avoids lookbehind which isn't supported in older Safari.
 */
function withEscapeHandling(
  value: string,
  transform: (unescaped: string) => string
): string {
  const escaped = value.replace(/\\</g, ESCAPE_SENTINEL);
  const transformed = transform(escaped);
  return transformed.replace(new RegExp(ESCAPE_SENTINEL, "g"), "<");
}

const PLACEHOLDER_REGEX = /<([^>]+)>/g;

export function parsePlaceholders(command: string): Placeholder[] {
  const seen = new Set<string>();
  const placeholders: Placeholder[] = [];

  // Work on escaped version so \< doesn't match
  const escaped = command.replace(/\\</g, ESCAPE_SENTINEL);
  const matches = escaped.matchAll(PLACEHOLDER_REGEX);

  for (const match of matches) {
    const raw = match[1];
    if (seen.has(raw)) continue;
    seen.add(raw);

    const colonIndex = raw.lastIndexOf(":");
    if (colonIndex === -1) {
      placeholders.push({ raw, name: raw, type: "string" });
    } else {
      const name = raw.slice(0, colonIndex);
      const typeStr = raw.slice(colonIndex + 1);
      const type: PlaceholderType = typeStr === "int" ? "int" : "string";
      placeholders.push({ raw, name, type });
    }
  }

  return placeholders;
}

export function hasPlaceholders(command: string): boolean {
  const escaped = command.replace(/\\</g, ESCAPE_SENTINEL);
  return /<[^>]+>/.test(escaped);
}

export function formatDisplayValue(value: string): string {
  return withEscapeHandling(value, (escaped) =>
    escaped.replace(PLACEHOLDER_REGEX, (_, content: string) => {
      const colonIndex = content.lastIndexOf(":");
      if (colonIndex === -1) return `<${content}>`;
      const name = content.slice(0, colonIndex);
      return `<${name}>`;
    })
  );
}

export function buildCommand(
  command: string,
  values: Record<string, string>
): string {
  return withEscapeHandling(command, (escaped) =>
    escaped.replace(PLACEHOLDER_REGEX, (_, content: string) => {
      const colonIndex = content.lastIndexOf(":");
      const raw = content;
      const name = colonIndex === -1 ? raw : raw.slice(0, colonIndex);
      const val = values[raw];
      if (val === undefined || val === "") {
        return `<${name}>`;
      }
      return val;
    })
  );
}
