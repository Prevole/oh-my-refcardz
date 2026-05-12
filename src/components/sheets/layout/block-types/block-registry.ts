import type { ComponentType, PointerEvent as ReactPointerEvent, ReactNode } from "react";

/**
 * Identifies the type of layout block.
 * Each kind has its own constraints, resize handles, and renderer.
 */
export type LayoutBlockKind = "heading" | "card";

/**
 * Resize constraints for a block type.
 * These are enforced during both mouse and keyboard resize operations.
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
 * Props passed to every block renderer component.
 * These are the common props that all block types receive.
 * Optional props like text, badge, footer, controls are passed through
 * for block types that support them.
 */
export type BlockRendererProps = {
  /** Unique identifier for the block */
  id: string;
  /** Block title */
  title: string;
  /** Optional text (for heading blocks) */
  text?: string;
  /** Badge shown next to the title (for card blocks) */
  badge?: ReactNode;
  /** Footer content (for card blocks) */
  footer?: ReactNode;
  /** Controls shown in edit mode (for card blocks) */
  controls?: ReactNode;
  /** Grid column start position (1-indexed) */
  colStart: number;
  /** Grid row start position (1-indexed) */
  rowStart: number;
  /** Width in grid columns */
  colSpan: number;
  /** Height in grid rows */
  rowSpan: number;
  /** Whether layout editing mode is active */
  editMode: boolean;
  /** Label shown in edit mode (e.g., "1,1 · 12x4") */
  layoutLabel?: string;
  /** Whether this block is currently being dragged or resized */
  dragging: boolean;
  /** Whether this block is dimmed (another block is being manipulated) */
  dimmed: boolean;
  /** Whether this block has keyboard focus for layout operations */
  keyboardFocused: boolean;
  /** Whether the focused block is actively being manipulated via keyboard */
  manipulating: boolean;
  /** Handler for pointer down on the draggable header */
  onHeaderPointerDown?: (event: ReactPointerEvent<HTMLDivElement>) => void;
  /** Handler for pointer down on resize handles */
  onResizePointerDown?: (direction: ResizeHandleDirection, event: ReactPointerEvent<HTMLDivElement>) => void;
  /** Currently active resize direction (for visual feedback) */
  activeResizeDirection?: ResizeHandleDirection | null;
  /** Resize handles that are enabled for this block type */
  enabledResizeHandles: ResizeHandleDirection[];
  /** Content to render inside the block (for card blocks) */
  children?: ReactNode;
};

/**
 * Configuration for a block type.
 * Registered via registerBlockType().
 */
export type BlockTypeConfig = {
  /** Resize constraints for this block type */
  constraints: BlockConstraints;
  /** Which resize handles to show and enable */
  resizeHandles: ResizeHandleDirection[];
  /** Component that renders this block type */
  render: ComponentType<BlockRendererProps>;
};

const registry = new Map<LayoutBlockKind, BlockTypeConfig>();

/**
 * Registers a block type with its configuration.
 * Called at module load time by each block type file.
 */
export function registerBlockType(kind: LayoutBlockKind, config: BlockTypeConfig): void {
  if (registry.has(kind)) {
    throw new Error(`Block type "${kind}" is already registered`);
  }
  registry.set(kind, config);
}

/**
 * Gets the full configuration for a block type.
 * Throws if the block type is not registered.
 */
export function getBlockConfig(kind: LayoutBlockKind): BlockTypeConfig {
  const config = registry.get(kind);
  if (!config) {
    throw new Error(`Block type "${kind}" is not registered`);
  }
  return config;
}

/**
 * Gets the resize constraints for a block type.
 */
export function getBlockConstraints(kind: LayoutBlockKind): BlockConstraints {
  return getBlockConfig(kind).constraints;
}

/**
 * Gets the enabled resize handles for a block type.
 */
export function getResizeHandles(kind: LayoutBlockKind): ResizeHandleDirection[] {
  return getBlockConfig(kind).resizeHandles;
}

/**
 * Checks if a resize direction is enabled for a block type.
 */
export function isResizeDirectionEnabled(kind: LayoutBlockKind, direction: ResizeHandleDirection): boolean {
  return getResizeHandles(kind).includes(direction);
}

/**
 * Gets all registered block kinds.
 * Useful for iteration and validation.
 */
export function getRegisteredBlockKinds(): LayoutBlockKind[] {
  return Array.from(registry.keys());
}

/**
 * Gets the resize constraints for a block type in the new solver format.
 * This is used by the V2 layout system.
 */
export function getBlockConstraintsV2(kind: LayoutBlockKind): import("@/lib/layout/solver/types").BlockConstraints {
  const config = getBlockConfig(kind);
  const { constraints, resizeHandles } = config;

  // Convert resize handles to allowed directions (excluding diagonals for solver)
  const allowedResizeDirections = resizeHandles.filter(
    (h): h is import("@/lib/layout/solver/types").ResizeDirection =>
      h === "north" || h === "south" || h === "east" || h === "west"
  );

  return {
    minW: constraints.minColSpan,
    minH: constraints.minRowSpan,
    maxW: constraints.maxColSpan < Infinity ? constraints.maxColSpan : undefined,
    maxH: constraints.maxRowSpan < Infinity ? constraints.maxRowSpan : undefined,
    allowedResizeDirections,
  };
}
