import type { BlockConstraints as EngineBlockConstraints, Direction } from "../engine";
import type {
  BlockConstraints,
  BlockTypeDefinition,
  LayoutBlockKind,
  ResizeHandleDirection,
} from "./block-types";

/**
 * Central registry of block type definitions.
 *
 * Block kinds are registered at module load time by side-effect-only files
 * (heading.ts, card.ts). Consumers query the registry to obtain constraints,
 * resize behavior, and the set of available kinds.
 *
 * Renderers (React components) are intentionally not stored here. They live
 * in the components layer (blocks-renderers).
 */

const registry = new Map<LayoutBlockKind, BlockTypeDefinition>();

/**
 * Registers a block type definition. Called once per kind at module load time.
 * Throws if the kind is already registered.
 */
export function registerBlockType(kind: LayoutBlockKind, definition: BlockTypeDefinition): void {
  if (registry.has(kind)) {
    throw new Error(`Block type "${kind}" is already registered`);
  }
  registry.set(kind, definition);
}

/**
 * Gets the definition for a block kind.
 * Throws if the kind is not registered.
 */
export function getBlockTypeDefinition(kind: LayoutBlockKind): BlockTypeDefinition {
  const definition = registry.get(kind);
  if (!definition) {
    throw new Error(`Block type "${kind}" is not registered`);
  }
  return definition;
}

/**
 * Checks whether a block kind is registered. Useful for validating
 * persisted layouts: unknown kinds should be dropped, not rendered.
 */
export function isRegisteredBlockKind(value: unknown): value is LayoutBlockKind {
  return typeof value === "string" && registry.has(value as LayoutBlockKind);
}

/**
 * Gets the size constraints for a block kind.
 */
export function getBlockConstraints(kind: LayoutBlockKind): BlockConstraints {
  return getBlockTypeDefinition(kind).constraints;
}

/**
 * Gets the enabled resize handles for a block kind.
 */
export function getResizeHandles(kind: LayoutBlockKind): ResizeHandleDirection[] {
  return getBlockTypeDefinition(kind).resizeHandles;
}

/**
 * Checks if a resize direction is enabled for a block kind.
 */
export function isResizeDirectionEnabled(
  kind: LayoutBlockKind,
  direction: ResizeHandleDirection
): boolean {
  return getResizeHandles(kind).includes(direction);
}

/**
 * Gets all registered block kinds. Useful for iteration and validation.
 */
export function getRegisteredBlockKinds(): LayoutBlockKind[] {
  return Array.from(registry.keys());
}

/**
 * Gets the size constraints for a block kind in the layout engine's
 * solver format. Cardinal-only resize directions; maxW/maxH are omitted
 * when the value is Infinity.
 */
export function getBlockConstraintsV2(kind: LayoutBlockKind): EngineBlockConstraints {
  const definition = getBlockTypeDefinition(kind);
  const { constraints, resizeHandles } = definition;

  const allowedResizeDirections = resizeHandles.filter(
    (h): h is Direction => h === "north" || h === "south" || h === "east" || h === "west"
  );

  return {
    minW: constraints.minColSpan,
    minH: constraints.minRowSpan,
    maxW: constraints.maxColSpan < Infinity ? constraints.maxColSpan : undefined,
    maxH: constraints.maxRowSpan < Infinity ? constraints.maxRowSpan : undefined,
    allowedResizeDirections,
  };
}
