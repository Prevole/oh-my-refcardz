// Block types system
export {
  registerBlockType,
  getBlockConfig,
  getBlockConstraints,
  getResizeHandles,
  isResizeDirectionEnabled,
  getRegisteredBlockKinds,
  BlockRenderer,
  type LayoutBlockKind,
  type BlockConstraints,
  type ResizeHandleDirection,
  type BlockRendererProps,
  type BlockTypeConfig,
  type BlockRendererPropsFromParent,
} from "./block-types";

// Layout types (some re-exported from block-types for compatibility)
export type {
  CardLayoutState,
  BlockLayoutState,
  GridMetricsState,
  DragState,
  ResizeState,
} from "./layout-types";
export { MAX_ROW_SPAN, FALLBACK_METRICS } from "./layout-types";

// Layout algorithms
export {
  clamp,
  pointerToGridPosition,
  hasCollision,
  markOccupied,
  clampCardLayoutToGrid,
  placeCardAtNearestSlot,
  resolveBlockLayout,
} from "./layout-algorithms";

// Layout inference
export {
  inferCardColSpan,
  inferCardRowSpan,
  buildDefaultBlockLayouts,
} from "./layout-inference";

// Hooks
export { useLayoutPersistence } from "./use-layout-persistence";
export type { UseLayoutPersistenceResult } from "./use-layout-persistence";

export { useCardDrag } from "./use-card-drag";
export type { UseCardDragResult } from "./use-card-drag";

export { useCardResize } from "./use-card-resize";
export type { UseCardResizeResult } from "./use-card-resize";

export { useCardKeyboard } from "./use-card-keyboard";
export type { UseCardKeyboardResult, CardFocus } from "./use-card-keyboard";
