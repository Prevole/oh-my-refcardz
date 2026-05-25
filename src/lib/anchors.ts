export const anchorIdPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

type EntryLike = Record<string, unknown>;

type InlineReferenceTarget = {
  slug: string | null;
  anchor: string | null;
};

export function isValidAnchorId(value: string): boolean {
  return anchorIdPattern.test(value);
}

export function getItemAnchorId(entries: EntryLike[]): string | null {
  const anchorEntry = entries.find((entry) => typeof entry.anchor === "string");
  return typeof anchorEntry?.anchor === "string" ? anchorEntry.anchor : null;
}

export function parseInlineReferenceTarget(target: string): InlineReferenceTarget | null {
  const trimmedTarget = target.trim();
  if (!trimmedTarget || trimmedTarget.split("#").length > 2) {
    return null;
  }

  if (trimmedTarget.startsWith("#")) {
    const anchor = trimmedTarget.slice(1).trim();
    return isValidAnchorId(anchor) ? { slug: null, anchor } : null;
  }

  const [slugPart, anchorPart] = trimmedTarget.split("#");
  const slug = slugPart?.trim();
  if (!slug) {
    return null;
  }

  if (!anchorPart) {
    return { slug, anchor: null };
  }

  const anchor = anchorPart.trim();
  return isValidAnchorId(anchor) ? { slug, anchor } : null;
}
