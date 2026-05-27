import { GRID_COLUMNS, MAX_ROW_SPAN } from "@/lib/layout/grid-constants";

// Re-export types from the central block-types definitions for compat.
export type { LayoutBlockKind, ResizeHandleDirection } from "@/lib/layout/blocks";

export type CardLayoutState = {
  colStart: number;
  rowStart: number;
  colSpan: number;
  rowSpan: number;
};

export type BlockLayoutState = CardLayoutState & {
  id: string;
  kind: import("@/lib/layout/blocks").LayoutBlockKind;
};

export type GridMetricsState = {
  columns: number;
  unitSize: number;
};

export { MAX_ROW_SPAN };

export const FALLBACK_METRICS: GridMetricsState = {
  columns: GRID_COLUMNS,
  unitSize: 96,
};
