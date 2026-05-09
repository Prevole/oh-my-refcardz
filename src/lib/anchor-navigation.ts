function slugifyAnchorSegment(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "section";
}

export function buildIndexedAnchorId(prefix: string, label: string, index: number): string {
  return `${prefix}-${slugifyAnchorSegment(label)}-${index + 1}`;
}

export function buildBlockAnchorId(prefix: string, blockId: string): string {
  return `${prefix}-${slugifyAnchorSegment(blockId)}`;
}
