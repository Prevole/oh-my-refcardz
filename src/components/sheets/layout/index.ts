// Public surface for the layout module.
// Only symbols consumed through this barrel are re-exported here.
// Internal consumers within the layout/ folder import directly from sibling files.

export { BlockRenderer } from "./blocks";
export { getBlockConstraintsV2 } from "@/lib/layout/blocks";
export type { ResizeHandleDirection } from "@/lib/layout/blocks";

export type { GridMetricsState } from "./layout-types";
export { FALLBACK_METRICS } from "./layout-types";

export { useLayoutPersistence } from "./use-layout-persistence";

export { useLayoutEditor } from "./use-layout-editor";

export { useCardDragV2 } from "./use-card-drag-v2";

export { useCardResizeV2 } from "./use-card-resize-v2";

export { useLayoutKeyboard } from "./use-layout-keyboard";

export { useLayoutBufferState } from "./use-layout-buffer-state";

export { useLayoutHistory } from "./use-layout-history";

export {
  LayoutSnapshotProvider,
  useLayoutSnapshot,
  usePublishLayoutSnapshot,
  sortByLayoutOrder,
} from "./layout-snapshot";
