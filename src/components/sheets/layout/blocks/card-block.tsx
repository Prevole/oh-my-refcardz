import type { ReactNode } from "react";
import { registerBlockRenderer } from "./blocks-renderers";
import { ResizeHandles } from "./resize-handles";
import { LayoutBadgeContent } from "./layout-badge-content";
import type { BlockRendererProps } from "./block-renderer-types";
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
  blockId,
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
  debugInfo,
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
      data-layout-block-kind="card"
      data-layout-block-id={blockId}
      data-keyboard-focused={keyboardFocused ? "true" : undefined}
      style={{
        ["--card-col-start" as string]: String(colStart),
        ["--card-row-start" as string]: String(rowStart),
        ["--card-col-span" as string]: String(colSpan),
        ["--card-row-span" as string]: String(rowSpan),
      }}
    >
      {editMode || debugInfo ? (
        <div className={styles.cardLayoutBadgeRow}>
          <div className={styles.cardLayoutBadge}>
            <LayoutBadgeContent
              layoutLabel={layoutLabel}
              colSpan={colSpan}
              rowSpan={rowSpan}
              debugInfo={debugInfo}
            />
          </div>
          {editMode ? controls : null}
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

registerBlockRenderer("card", CardBlockRenderer);

export { CardBlockRenderer };
