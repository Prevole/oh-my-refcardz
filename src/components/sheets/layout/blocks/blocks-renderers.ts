import type { ComponentType } from "react";
import type { LayoutBlockKind } from "@/lib/layout/blocks";
import type { BlockRendererProps } from "./block-renderer-types";

/**
 * Renderer registry for layout blocks.
 *
 * Maps each block kind to its React component. Renderers register themselves
 * at module load time via the side-effect imports in ./index.ts. Constraints
 * and resize handles are stored separately in the data registry under
 * src/lib/layout/blocks/.
 */

const renderers = new Map<LayoutBlockKind, ComponentType<BlockRendererProps>>();

/**
 * Registers a React renderer for a block kind. Called once per kind at
 * module load time. Throws if a renderer is already registered.
 */
export function registerBlockRenderer(
  kind: LayoutBlockKind,
  component: ComponentType<BlockRendererProps>
): void {
  if (renderers.has(kind)) {
    throw new Error(`Block renderer for "${kind}" is already registered`);
  }
  renderers.set(kind, component);
}

/**
 * Gets the registered renderer for a block kind.
 * Throws if no renderer is registered for the kind.
 */
export function getBlockRenderer(kind: LayoutBlockKind): ComponentType<BlockRendererProps> {
  const component = renderers.get(kind);
  if (!component) {
    throw new Error(`Block renderer for "${kind}" is not registered`);
  }
  return component;
}

/**
 * Returns all block kinds with a registered renderer. Useful in tests.
 */
export function getRegisteredRendererKinds(): LayoutBlockKind[] {
  return Array.from(renderers.keys());
}
