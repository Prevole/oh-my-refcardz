export type PlaceholderType = "string" | "int";

export type Placeholder = {
  raw: string;
  name: string;
  type: PlaceholderType;
};

const PLACEHOLDER_REGEX = /<([^>]+)>/g;

export function parsePlaceholders(command: string): Placeholder[] {
  const matches = command.matchAll(PLACEHOLDER_REGEX);
  const seen = new Set<string>();
  const placeholders: Placeholder[] = [];

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
  return /<[^>]+>/.test(command);
}

export function formatDisplayValue(value: string): string {
  return value.replace(PLACEHOLDER_REGEX, (_, content: string) => {
    const colonIndex = content.lastIndexOf(":");
    if (colonIndex === -1) return `<${content}>`;
    const name = content.slice(0, colonIndex);
    return `<${name}>`;
  });
}

export function buildCommand(
  command: string,
  values: Record<string, string>
): string {
  return command.replace(PLACEHOLDER_REGEX, (match, content: string) => {
    const colonIndex = content.lastIndexOf(":");
    const raw = content;
    const name = colonIndex === -1 ? raw : raw.slice(0, colonIndex);
    const value = values[raw];
    if (value === undefined || value === "") {
      return `<${name}>`;
    }
    return value;
  });
}
