import { registerBlockType, type BlockRendererProps } from "./block-registry";
import { ResizeHandles } from "./resize-handles";
import { GRID_COLUMNS } from "../../sheet-grid";
import styles from "../../cheatsheet-rendering.module.css";

type HeadingBlockProps = BlockRendererProps & {
  /** Optional descriptive text below the title */
  text?: string;
};

function HeadingBlockRenderer({
  id,
  title,
  text,
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
}: HeadingBlockProps) {
  const classNames = [
    styles.headingBlock,
    editMode ? styles.headingBlockEditMode : "",
    dragging ? styles.headingBlockDragging : "",
    dimmed ? styles.headingBlockDimmed : "",
    keyboardFocused ? styles.headingBlockKeyboardFocused : "",
    manipulating ? styles.headingBlockManipulating : "",
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
        </div>
      ) : null}
      <div
        className={`${styles.headingBlockHeader} ${onHeaderPointerDown ? styles.headingBlockHeaderDraggable : ""}`}
        onPointerDown={onHeaderPointerDown}
      >
        <h2 className={styles.headingBlockTitle}>{title}</h2>
        {text ? <p className={styles.headingBlockText}>{text}</p> : null}
      </div>
      {onResizePointerDown ? (
        <ResizeHandles
          enabledHandles={enabledResizeHandles}
          activeDirection={activeResizeDirection}
          onPointerDown={onResizePointerDown}
        />
      ) : null}
    </article>
  );
}

// Headings are horizontal dividers - fixed height, resizable width only
registerBlockType("heading", {
  constraints: {
    minColSpan: 12,
    maxColSpan: GRID_COLUMNS,
    minRowSpan: 2,
    maxRowSpan: 2, // Fixed height
  },
  resizeHandles: ["east", "west"], // Horizontal only
  render: HeadingBlockRenderer as React.ComponentType<BlockRendererProps>,
});

export { HeadingBlockRenderer };
