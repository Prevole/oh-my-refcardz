export type {
  CardLayoutState,
  SectionLayoutState,
  SectionMetricsState,
  DragState,
  ResizeHandleDirection,
  ResizeState,
} from "./layout-types";
export { MAX_ROW_SPAN, FALLBACK_METRICS } from "./layout-types";

export {
  clamp,
  pointerToGridPosition,
  hasCollision,
  markOccupied,
  clampCardLayoutToGrid,
  placeCardAtNearestSlot,
  resolveSectionLayout,
} from "./layout-algorithms";

export {
  inferCardColSpan,
  inferCardRowSpan,
  buildDefaultSectionLayouts,
} from "./layout-inference";

export { useLayoutPersistence } from "./use-layout-persistence";
export type { UseLayoutPersistenceResult } from "./use-layout-persistence";

export { useCardDrag } from "./use-card-drag";
export type { UseCardDragResult } from "./use-card-drag";

export { useCardResize } from "./use-card-resize";
export type { UseCardResizeResult } from "./use-card-resize";

export { useCardKeyboard } from "./use-card-keyboard";
export type { UseCardKeyboardResult, CardFocus } from "./use-card-keyboard";
