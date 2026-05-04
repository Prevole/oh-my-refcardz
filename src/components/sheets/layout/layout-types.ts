import { GRID_COLUMNS } from "../sheet-grid";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CardLayoutState = {
  colStart: number;
  rowStart: number;
  colSpan: number;
  rowSpan: number;
};

export type SectionLayoutState = {
  cards: CardLayoutState[];
};

export type SectionMetricsState = {
  columns: number;
  unitSize: number;
};

export type DragState = {
  sectionIndex: number;
  cardIndex: number;
  colStart: number;
  rowStart: number;
  colSpan: number;
  rowSpan: number;
  gridRect: DOMRect;
  unitSize: number;
  pointerOffsetX: number;
  pointerOffsetY: number;
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const MAX_ROW_SPAN = 24;

export const FALLBACK_METRICS: SectionMetricsState = {
  columns: GRID_COLUMNS,
  unitSize: 96,
};
