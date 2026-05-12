import { GRID_COLUMNS } from "../sheet-grid";

// Re-export types from block-types for backwards compatibility
export type { LayoutBlockKind, ResizeHandleDirection } from "./block-types";

export type CardLayoutState = {
  colStart: number;
  rowStart: number;
  colSpan: number;
  rowSpan: number;
};

export type BlockLayoutState = CardLayoutState & {
  id: string;
  kind: import("./block-types").LayoutBlockKind;
};

export type GridMetricsState = {
  columns: number;
  unitSize: number;
};

export const MAX_ROW_SPAN = 72;

export const FALLBACK_METRICS: GridMetricsState = {
  columns: GRID_COLUMNS,
  unitSize: 96,
};
