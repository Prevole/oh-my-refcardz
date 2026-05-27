import type { PointerEvent as ReactPointerEvent, ReactNode } from "react";
import type { ResizeHandleDirection } from "@/lib/layout/blocks";

/**
 * Props passed to every block renderer component.
 *
 * Common props (id, blockId, title, position, edit state) apply to all kinds.
 * Optional props (text, badge, footer, controls) are kind-specific and
 * passed through transparently.
 */
export type BlockRendererProps = {
  /** HTML id for anchor navigation (slugified, namespaced) */
  id: string;
  /** Raw block id used as the source of truth for layout lookups */
  blockId: string;
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
  /**
   * When set, the block badge is rendered even outside edit mode and shows
   * additional debug info: id, current 0-indexed position (x,y,w,h), and the
   * initial position observed at page load when it differs from the current.
   */
  debugInfo?: {
    debugId: string;
    blockId: string;
    current: { x: number; y: number; w: number; h: number };
    initial?: { x: number; y: number; w: number; h: number };
  };
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
  onResizePointerDown?: (
    direction: ResizeHandleDirection,
    event: ReactPointerEvent<HTMLDivElement>
  ) => void;
  /** Currently active resize direction (for visual feedback) */
  activeResizeDirection?: ResizeHandleDirection | null;
  /** Resize handles that are enabled for this block kind */
  enabledResizeHandles: ResizeHandleDirection[];
  /** Content to render inside the block (for card blocks) */
  children?: ReactNode;
};
