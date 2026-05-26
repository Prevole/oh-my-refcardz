import type { ReactNode } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import {
  getBlockConfig,
  type LayoutBlockKind,
  type ResizeHandleDirection,
} from "./block-registry";

// Import block type modules to trigger their registration
import "./heading-block";
import "./card-block";

export type BlockRendererPropsFromParent = {
  /** Block type */
  kind: LayoutBlockKind;
  /** HTML id for anchor navigation (slugified, namespaced) */
  id: string;
  /** Raw block id used as the source of truth for layout lookups */
  blockId: string;
  /** Block title */
  title: string;
  /** Optional text (for headings) */
  text?: string;
  /** Badge shown next to the title (for cards) */
  badge?: ReactNode;
  /** Footer content (for cards) */
  footer?: ReactNode;
  /** Controls shown in edit mode (for cards) */
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
  /** Label shown in edit mode */
  layoutLabel?: string;
  /** Debug overlay info; when set, badge is shown even outside edit mode */
  debugInfo?: {
    debugId: string;
    blockId: string;
    current: { x: number; y: number; w: number; h: number };
    initial?: { x: number; y: number; w: number; h: number };
  };
  /** Whether this block is currently being dragged or resized */
  dragging: boolean;
  /** Whether this block is dimmed */
  dimmed: boolean;
  /** Whether this block has keyboard focus */
  keyboardFocused: boolean;
  /** Whether the focused block is actively being manipulated */
  manipulating: boolean;
  /** Handler for pointer down on the draggable header */
  onHeaderPointerDown?: (event: ReactPointerEvent<HTMLDivElement>) => void;
  /** Handler for pointer down on resize handles */
  onResizePointerDown?: (direction: ResizeHandleDirection, event: ReactPointerEvent<HTMLDivElement>) => void;
  /** Currently active resize direction */
  activeResizeDirection?: ResizeHandleDirection | null;
  /** Content to render inside the block (for cards) */
  children?: ReactNode;
};

/**
 * Renders a block using the appropriate registered renderer based on its kind.
 * This is the main entry point for rendering layout blocks.
 */
export function BlockRenderer({
  kind,
  id,
  blockId,
  title,
  text,
  badge,
  footer,
  controls,
  colStart,
  rowStart,
  colSpan,
  rowSpan,
  editMode,
  layoutLabel,
  debugInfo,
  dragging,
  dimmed,
  keyboardFocused,
  manipulating,
  onHeaderPointerDown,
  onResizePointerDown,
  activeResizeDirection,
  children,
}: BlockRendererPropsFromParent) {
  const config = getBlockConfig(kind);
  const Component = config.render;

  return (
    <Component
      id={id}
      blockId={blockId}
      title={title}
      text={text}
      badge={badge}
      footer={footer}
      controls={controls}
      colStart={colStart}
      rowStart={rowStart}
      colSpan={colSpan}
      rowSpan={rowSpan}
      editMode={editMode}
      layoutLabel={layoutLabel}
      debugInfo={debugInfo}
      dragging={dragging}
      dimmed={dimmed}
      keyboardFocused={keyboardFocused}
      manipulating={manipulating}
      onHeaderPointerDown={onHeaderPointerDown}
      onResizePointerDown={onResizePointerDown}
      activeResizeDirection={activeResizeDirection}
      enabledResizeHandles={config.resizeHandles}
    >
      {children}
    </Component>
  );
}
