// Types and constants
export type {
  CardLayoutState,
  SectionLayoutState,
  SectionMetricsState,
  DragState,
} from "./layout-types";
export { MAX_ROW_SPAN, FALLBACK_METRICS } from "./layout-types";

// Algorithms
export {
  clamp,
  pointerToGridPosition,
  hasCollision,
  markOccupied,
  clampCardLayoutToGrid,
  placeCardAtNearestSlot,
  resolveSectionLayout,
} from "./layout-algorithms";

// Inference
export {
  inferCardColSpan,
  inferCardRowSpan,
  buildDefaultSectionLayouts,
} from "./layout-inference";

// Hooks
export { useLayoutPersistence } from "./use-layout-persistence";
export type { UseLayoutPersistenceResult } from "./use-layout-persistence";

export { useCardDrag } from "./use-card-drag";
export type { UseCardDragResult } from "./use-card-drag";

// Components
export { CardLayoutControls } from "./card-layout-controls";
