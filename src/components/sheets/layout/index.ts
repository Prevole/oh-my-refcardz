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
export type { CardLayoutState, BlockLayoutState, GridMetricsState } from "./layout-types";
export { MAX_ROW_SPAN, FALLBACK_METRICS } from "./layout-types";

// Layout algorithms (still needed for layout-inference)
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
export { inferCardColSpan, inferCardRowSpan, buildDefaultBlockLayouts } from "./layout-inference";

// Persistence hook
export { useLayoutPersistence } from "./use-layout-persistence";
export type { UseLayoutPersistenceResult } from "./use-layout-persistence";

// Layout editor (V2 orchestrator)
export { useLayoutEditor } from "./use-layout-editor";
export type {
  UseLayoutEditorResult,
  InteractionState,
  InteractionKind,
} from "./use-layout-editor";

// Interaction hooks (V2)
export { useCardDragV2 } from "./use-card-drag-v2";
export type { UseCardDragV2Result, DragStateV2, DragMove } from "./use-card-drag-v2";

export { useCardResizeV2 } from "./use-card-resize-v2";
export type { UseCardResizeV2Result, ResizeStateV2, ResizeMove } from "./use-card-resize-v2";

export { useCardKeyboardV2 } from "./use-card-keyboard-v2";
export type { UseCardKeyboardV2Result, CardFocusV2 } from "./use-card-keyboard-v2";

// Layout snapshot: publishes the live layout for sibling consumers
// (heading navigation today; possibly more in the future).
export {
  LayoutSnapshotProvider,
  useLayoutSnapshot,
  usePublishLayoutSnapshot,
  sortByLayoutOrder,
} from "./layout-snapshot";
export type { LayoutSnapshot } from "./layout-snapshot";
