/**
 * Block type definitions and registry.
 *
 * Importing this module triggers registration of all built-in block kinds
 * (heading, card) via side-effect imports. Consumers should depend on this
 * barrel rather than the individual files to ensure the registry is populated.
 *
 * This module is server-safe: no React, no DOM. Renderers live in the
 * components layer (src/components/sheets/layout/blocks/).
 */

import "./heading";
import "./card";

export type {
  BlockConstraints,
  BlockTypeDefinition,
  LayoutBlockKind,
  ResizeHandleDirection,
} from "./block-types";

export {
  getBlockConstraints,
  getBlockConstraintsV2,
  getBlockTypeDefinition,
  getRegisteredBlockKinds,
  getResizeHandles,
  isRegisteredBlockKind,
  isResizeDirectionEnabled,
  registerBlockType,
} from "./blocks-registry";
