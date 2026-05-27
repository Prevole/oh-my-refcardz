/**
 * Identifies the type of layout block.
 * Each kind has its own constraints, resize handles, and renderer.
 */
export type LayoutBlockKind = "heading" | "card";

/**
 * Resize constraints for a block type.
 * These are enforced during both mouse and keyboard resize operations,
 * and used to clamp persisted layouts at load time.
 *
 * Constraints apply to size only (colSpan / rowSpan), never to position.
 */
export type BlockConstraints = {
  minColSpan: number;
  maxColSpan: number;
  minRowSpan: number;
  maxRowSpan: number;
};

/**
 * Resize handle directions that can be enabled for a block type.
 * Handles not in this list will be hidden and their resize operations blocked.
 */
export type ResizeHandleDirection =
  | "north"
  | "south"
  | "east"
  | "west"
  | "north-east"
  | "north-west"
  | "south-east"
  | "south-west";

/**
 * Definition of a block type. Pure data, no React.
 *
 * This is the single source of truth for a block kind's constraints and
 * resize behavior. Renderers (React components) are registered separately
 * via blocks-renderers in the components layer.
 *
 * Constraints live here exclusively. They must never appear in persisted
 * layouts (JSON files or localStorage). Persisted data carries only
 * positions and sizes; constraints are applied at load time.
 */
export type BlockTypeDefinition = {
  /** Resize constraints for this block kind */
  constraints: BlockConstraints;
  /** Which resize handles are enabled for this block kind */
  resizeHandles: ResizeHandleDirection[];
};
