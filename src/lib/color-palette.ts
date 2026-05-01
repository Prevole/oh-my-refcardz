/**
 * Color palette for categories and sheets.
 *
 * - Each category (identified by its `order` field, 1-10) has a primary color.
 * - Each sheet within a category gets a gradient from the category's primary
 *   color to a secondary color based on its visual column position.
 */

// Primary colors for categories (indexed 1-10)
// These form a cohesive rainbow progression for a modern dark UI.
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

// Secondary colors for gradients (one per column, cycled)
// These are chosen to contrast STRONGLY with any primary color.
// Avoiding blues/cyans/magentas to ensure contrast with primary colors 1-4.
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

export type SheetGradient = {
  from: string;
  to: string;
};

/**
 * Get the primary color for a category based on its order.
 * Falls back to the first color if order is out of range.
 */
export function getCategoryPrimaryColor(order: number): string {
  const index = Math.max(0, Math.min(order - 1, CATEGORY_PRIMARY_COLORS.length - 1));
  return CATEGORY_PRIMARY_COLORS[index];
}

/**
 * Get the secondary color for a given column index.
 * Cycles through the palette if column exceeds palette size.
 */
export function getSecondaryColorForColumn(columnIndex: number): string {
  const index = columnIndex % GRADIENT_SECONDARY_COLORS.length;
  return GRADIENT_SECONDARY_COLORS[index];
}

/**
 * Get the gradient colors for a sheet based on its category order
 * and its column index (0-based, from the hex layout).
 */
export function getSheetGradient(categoryOrder: number, columnIndex: number): SheetGradient {
  const from = getCategoryPrimaryColor(categoryOrder);
  const to = getSecondaryColorForColumn(columnIndex);
  return { from, to };
}
