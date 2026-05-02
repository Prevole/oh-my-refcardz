function slugifyAnchorSegment(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "section";
}

export function buildSectionAnchorId(prefix: string, label: string, index: number): string {
  return `${prefix}-${slugifyAnchorSegment(label)}-${index + 1}`;
}
