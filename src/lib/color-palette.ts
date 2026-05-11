export const CATEGORY_PRIMARY_COLORS = [
  "#67E8F9", // 1 - Cyan pastel
  "#F9A8D4", // 2 - Pink pastel
  "#C4B5FD", // 3 - Violet pastel
  "#A5B4FC", // 4 - Indigo pastel
  "#5EEAD4", // 5 - Teal pastel
  "#6EE7B7", // 6 - Emerald pastel
  "#BEF264", // 7 - Lime pastel
  "#FCD34D", // 8 - Amber pastel
  "#FDBA74", // 9 - Orange pastel
  "#FDA4AF", // 10 - Rose pastel
] as const;

export const GRADIENT_SECONDARY_COLORS = [
  "#FECDD3", // 0 - Rose mist
  "#FDE68A", // 1 - Soft amber
  "#D9F99D", // 2 - Soft lime
  "#FED7AA", // 3 - Apricot
  "#FBCFE8", // 4 - Blush pink
  "#A7F3D0", // 5 - Mint
  "#FEF08A", // 6 - Butter yellow
  "#FDBA74", // 7 - Peach
  "#BAE6FD", // 8 - Sky mist
  "#DDD6FE", // 9 - Lavender
] as const;

export const CATEGORY_GRADIENT_PAIRS = [
  { from: "#67E8F9", to: "#FDBA74" }, // 1 - Cyan → Orange pastel
  { from: "#C4B5FD", to: "#FDA4AF" }, // 2 - Violet → Rose pastel
  { from: "#93C5FD", to: "#FCD34D" }, // 3 - Blue → Amber pastel
  { from: "#6EE7B7", to: "#F9A8D4" }, // 4 - Emerald → Pink pastel
  { from: "#F9A8D4", to: "#7DD3FC" }, // 5 - Pink → Sky pastel
  { from: "#FCD34D", to: "#C4B5FD" }, // 6 - Amber → Violet pastel
  { from: "#5EEAD4", to: "#FDBA74" }, // 7 - Teal → Peach pastel
  { from: "#A5B4FC", to: "#86EFAC" }, // 8 - Indigo → Green pastel
  { from: "#FDA4AF", to: "#67E8F9" }, // 9 - Rose → Cyan pastel
  { from: "#BEF264", to: "#F5D0FE" }, // 10 - Lime → Lavender pastel
] as const;

export type SheetGradient = {
  from: string;
  to: string;
};

export function getCategoryPrimaryColor(order: number): string {
  const index = Math.max(0, Math.min(order - 1, CATEGORY_PRIMARY_COLORS.length - 1));
  return CATEGORY_PRIMARY_COLORS[index];
}

export function getSecondaryColorForColumn(columnIndex: number): string {
  const index = columnIndex % GRADIENT_SECONDARY_COLORS.length;
  return GRADIENT_SECONDARY_COLORS[index];
}

export function getCategoryGradientPair(order: number): SheetGradient {
  if (!Number.isFinite(order)) {
    return CATEGORY_GRADIENT_PAIRS[CATEGORY_GRADIENT_PAIRS.length - 1];
  }

  const length = CATEGORY_GRADIENT_PAIRS.length;
  const index = ((order - 1) % length + length) % length;
  return CATEGORY_GRADIENT_PAIRS[index];
}
