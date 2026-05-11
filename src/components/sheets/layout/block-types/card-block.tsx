import type { ReactNode } from "react";
import { registerBlockType, type BlockRendererProps } from "./block-registry";
import { ResizeHandles } from "./resize-handles";
import { GRID_COLUMNS } from "../../sheet-grid";
import { MAX_ROW_SPAN } from "../layout-types";
import styles from "../../cheatsheet-rendering.module.css";

type CardBlockProps = BlockRendererProps & {
  /** Badge shown next to the title */
  badge?: ReactNode;
  /** Footer content */
  footer?: ReactNode;
  /** Controls shown in edit mode */
  controls?: ReactNode;
};

function CardBlockRenderer({
  id,
  title,
  badge,
  footer,
  controls,
  children,
  colStart,
  rowStart,
  colSpan,
  rowSpan,
  editMode,
  layoutLabel,
  dragging,
  dimmed,
  keyboardFocused,
  manipulating,
  onHeaderPointerDown,
  onResizePointerDown,
  activeResizeDirection,
  enabledResizeHandles,
}: CardBlockProps) {
  const classNames = [
    styles.card,
    editMode ? styles.cardEditMode : "",
    dragging ? styles.cardDragging : "",
    dimmed ? styles.cardDimmed : "",
    keyboardFocused ? styles.cardKeyboardFocused : "",
    manipulating ? styles.cardManipulating : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <article
      id={id}
      className={classNames}
      data-layout-card="true"
      data-layout-block-id={id}
      style={{
        ["--card-col-start" as string]: String(colStart),
        ["--card-row-start" as string]: String(rowStart),
        ["--card-col-span" as string]: String(colSpan),
        ["--card-row-span" as string]: String(rowSpan),
      }}
    >
      {editMode ? (
        <div className={styles.cardLayoutBadgeRow}>
          <div className={styles.cardLayoutBadge}>{layoutLabel ?? `${colSpan}x${rowSpan}`}</div>
          {controls}
        </div>
      ) : null}
      <div
        className={`${styles.cardHeader} ${onHeaderPointerDown ? styles.cardHeaderDraggable : ""}`}
        onPointerDown={onHeaderPointerDown}
      >
        <h2 className={styles.cardTitle}>{title}</h2>
        {badge ? <span className={styles.cardBadge}>{badge}</span> : null}
      </div>
      {onResizePointerDown ? (
        <ResizeHandles
          enabledHandles={enabledResizeHandles}
          activeDirection={activeResizeDirection}
          onPointerDown={onResizePointerDown}
        />
      ) : null}
      <div className={styles.cardBody}>{children}</div>
      {footer ? <div className={styles.cardFooter}>{footer}</div> : null}
    </article>
  );
}

// Cards are fully resizable in all directions
registerBlockType("card", {
  constraints: {
    minColSpan: 6,
    maxColSpan: GRID_COLUMNS,
    minRowSpan: 4,
    maxRowSpan: MAX_ROW_SPAN,
  },
  resizeHandles: ["north", "south", "east", "west", "north-east", "north-west", "south-east", "south-west"],
  render: CardBlockRenderer as React.ComponentType<BlockRendererProps>,
});

export { CardBlockRenderer };
