// Block types system
export {
  registerBlockType,
  getBlockConfig,
  getBlockConstraints,
  getBlockConstraintsV2,
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

// Hooks (V1 - existing)
export { useLayoutPersistence } from "./use-layout-persistence";
export type { UseLayoutPersistenceResult } from "./use-layout-persistence";

export { useCardDrag } from "./use-card-drag";
export type { UseCardDragResult } from "./use-card-drag";

export { useCardResize } from "./use-card-resize";
export type { UseCardResizeResult } from "./use-card-resize";

export { useCardKeyboard } from "./use-card-keyboard";
export type { UseCardKeyboardResult, CardFocus } from "./use-card-keyboard";

// Hooks (V2 - new layout system)
export { useLayoutEditor } from "./use-layout-editor";
export type { UseLayoutEditorResult, InteractionState } from "./use-layout-editor";

export { useCardDragV2 } from "./use-card-drag-v2";
export type { UseCardDragV2Result, DragStateV2 } from "./use-card-drag-v2";

export { useCardResizeV2 } from "./use-card-resize-v2";
export type { UseCardResizeV2Result, ResizeStateV2 } from "./use-card-resize-v2";

export { useCardKeyboardV2 } from "./use-card-keyboard-v2";
export type { UseCardKeyboardV2Result, CardFocusV2 } from "./use-card-keyboard-v2";
