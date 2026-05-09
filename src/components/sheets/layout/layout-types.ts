import { GRID_COLUMNS } from "../sheet-grid";

export type CardLayoutState = {
  colStart: number;
  rowStart: number;
  colSpan: number;
  rowSpan: number;
};

export type LayoutBlockKind = "heading" | "card";

export type BlockLayoutState = CardLayoutState & {
  id: string;
  kind: LayoutBlockKind;
};

export type GridMetricsState = {
  columns: number;
  unitSize: number;
};

export type DragState = {
  blockId: string;
  colStart: number;
  rowStart: number;
  colSpan: number;
  rowSpan: number;
  gridRect: DOMRect;
  unitSize: number;
  pointerOffsetX: number;
  pointerOffsetY: number;
};

export type ResizeHandleDirection =
  | "north"
  | "east"
  | "south"
  | "west"
  | "north-east"
  | "south-east"
  | "south-west"
  | "north-west";

export type ResizeState = {
  blockId: string;
  colStart: number;
  rowStart: number;
  colSpan: number;
  rowSpan: number;
  direction: ResizeHandleDirection;
  startClientX: number;
  startClientY: number;
  originColStart: number;
  originRowStart: number;
  originColSpan: number;
  originRowSpan: number;
  unitSize: number;
};

export const MAX_ROW_SPAN = 72;

export const FALLBACK_METRICS: GridMetricsState = {
  columns: GRID_COLUMNS,
  unitSize: 96,
};
