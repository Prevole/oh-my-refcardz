// Public surface for the block-types module.
// Only symbols consumed through this barrel are re-exported here.

export {
  getBlockConstraintsV2,
  isResizeDirectionEnabled,
  type LayoutBlockKind,
  type ResizeHandleDirection,
} from "./block-registry";

export { BlockRenderer } from "./block-renderer";
