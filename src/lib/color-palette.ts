export const CATEGORY_PRIMARY_COLORS = [
  "#00D4FF", // 1 - Cyan electric
  "#FF00E5", // 2 - Magenta
  "#8B5CF6", // 3 - Violet
  "#6366F1", // 4 - Indigo
  "#14B8A6", // 5 - Teal
  "#10B981", // 6 - Emerald
  "#84CC16", // 7 - Lime
  "#FACC15", // 8 - Yellow
  "#F97316", // 9 - Orange
  "#F43F5E", // 10 - Coral red
] as const;

export const GRADIENT_SECONDARY_COLORS = [
  "#FF6B6B", // 0 - Coral red
  "#FFE66D", // 1 - Sunny yellow
  "#A3E635", // 2 - Lime green
  "#FF8C42", // 3 - Tangerine
  "#FF5E78", // 4 - Watermelon
  "#C4F54A", // 5 - Electric lime
  "#FFD93D", // 6 - Golden yellow
  "#FF7849", // 7 - Burnt orange
  "#B8F83E", // 8 - Neon green
  "#FFAB76", // 9 - Peach
] as const;

export const CATEGORY_GRADIENT_PAIRS = [
  { from: "#4ECDC4", to: "#FF8C42" }, // 1 - Teal → Orange
  { from: "#A78BFA", to: "#FB7185" }, // 2 - Violet → Rose
  { from: "#60A5FA", to: "#FBBF24" }, // 3 - Blue → Amber
  { from: "#34D399", to: "#F472B6" }, // 4 - Emerald → Pink
  { from: "#F472B6", to: "#38BDF8" }, // 5 - Pink → Sky
  { from: "#FBBF24", to: "#A78BFA" }, // 6 - Amber → Violet
  { from: "#2DD4BF", to: "#FB923C" }, // 7 - Teal → Orange
  { from: "#818CF8", to: "#4ADE80" }, // 8 - Indigo → Green
  { from: "#FB7185", to: "#22D3EE" }, // 9 - Rose → Cyan
  { from: "#A3E635", to: "#E879F9" }, // 10 - Lime → Fuchsia
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
