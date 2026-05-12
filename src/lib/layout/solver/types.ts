/**
 * Layout Solver V2 Types
 *
 * Core types for the new layout engine based on:
 * - Constraint propagation
 * - Deterministic collision solving
 * - Immutable snapshots
 *
 * Coordinates are 0-indexed (unlike the old 1-indexed system).
 * The coordinate system is half-open: a block at (x, y) with size (w, h)
 * occupies cells from x to x+w-1 and y to y+h-1.
 */

// -----------------------------------------------------------------------------
// Grid Position
// -----------------------------------------------------------------------------

/**
 * Grid coordinates (0-indexed, half-open).
 *
 * - x: column index (0 = first column)
 * - y: row index (0 = first row)
 * - w: width in columns
 * - h: height in rows
 *
 * A block occupies the rectangle [x, x+w) x [y, y+h).
 */
export type GridPosition = {
  x: number;
  y: number;
  w: number;
  h: number;
};

// -----------------------------------------------------------------------------
// Block Types
// -----------------------------------------------------------------------------

/**
 * Identifies the type of layout block.
 * Reusing the existing type from block-registry for compatibility.
 */
export type LayoutBlockKind = "heading" | "card";

/**
 * A block with its position in the grid.
 */
export type LayoutBlock = {
  id: string;
  kind: LayoutBlockKind;
  position: GridPosition;
};

// -----------------------------------------------------------------------------
// Resize Direction
// -----------------------------------------------------------------------------

/**
 * Cardinal directions for resize operations.
 * Diagonal directions are intentionally excluded from the UI.
 */
export type ResizeDirection = "north" | "south" | "east" | "west";

// -----------------------------------------------------------------------------
// Block Constraints
// -----------------------------------------------------------------------------

/**
 * Constraints that define valid sizes and resize operations for a block type.
 */
export type BlockConstraints = {
  /** Minimum width in columns */
  minW: number;
  /** Minimum height in rows */
  minH: number;
  /** Maximum width in columns (undefined = grid width) */
  maxW?: number;
  /** Maximum height in rows (undefined = unlimited) */
  maxH?: number;
  /** Directions in which the block can be resized */
  allowedResizeDirections: ResizeDirection[];
};

// -----------------------------------------------------------------------------
// Intents
// -----------------------------------------------------------------------------

/**
 * Intent to move a block to a new position.
 */
export type MoveIntent = {
  type: "move";
  blockId: string;
  /** Target x position (0-indexed) */
  x: number;
  /** Target y position (0-indexed) */
  y: number;
};

/**
 * Intent to resize a block.
 *
 * The `delta` value is signed:
 * - Positive: expand in the given direction
 * - Negative: shrink from the given direction
 *
 * For example:
 * - direction: "east", delta: 2 → grow 2 columns to the right
 * - direction: "west", delta: -1 → shrink 1 column from the left
 */
export type ResizeIntent = {
  type: "resize";
  blockId: string;
  /** Which edge is being moved */
  direction: ResizeDirection;
  /** Change in size (positive = expand, negative = shrink) */
  delta: number;
  /** Whether to compact neighboring blocks toward freed space */
  compact: boolean;
};

/**
 * Union of all possible intents the solver can process.
 */
export type LayoutIntent = MoveIntent | ResizeIntent;

// -----------------------------------------------------------------------------
// Solver Result
// -----------------------------------------------------------------------------

/**
 * Result of solving a layout intent.
 */
export type LayoutCandidate = {
  /** The resulting layout after applying the intent */
  layout: LayoutBlock[];
  /** Whether the intent was fully applied */
  accepted: boolean;
  /** Reason why the intent was blocked or partially applied */
  blockedReason?: string;
};

// -----------------------------------------------------------------------------
// Snapshot
// -----------------------------------------------------------------------------

/**
 * Source of a layout change, used for tracking and debugging.
 */
export type LayoutChangeSource =
  | "initial"
  | "drag"
  | "resize"
  | "keyboard"
  | "reset"
  | "load";

/**
 * Phase of a layout snapshot.
 * - preview: candidate layout during interaction (not committed)
 * - commit: final layout after interaction ends
 */
export type LayoutPhase = "preview" | "commit";

/**
 * A snapshot of the layout state, published to consumers.
 *
 * This is the contract between the layout system and its consumers
 * (heading navigation, overlays, etc.).
 */
export type LayoutSnapshot = {
  /** Block positions indexed by block ID */
  blocks: Record<string, GridPosition>;
  /** Whether this is a preview or committed layout */
  phase: LayoutPhase;
  /** What triggered this snapshot */
  source: LayoutChangeSource;
};

// -----------------------------------------------------------------------------
// Solver Options
// -----------------------------------------------------------------------------

/**
 * Options passed to the layout solver.
 */
export type SolverOptions = {
  /** Number of columns in the grid */
  gridColumns: number;
  /** Constraints for each block, indexed by block ID */
  constraints: Map<string, BlockConstraints>;
};
