"use client";

import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import type { ResizeHandleDirection } from "./layout";
import cheatsheetStyles from "./cheatsheet-rendering.module.css";

export const GRID_GAP_PX = 16;
export const GRID_COLUMNS = 36;

type SheetGridMetrics = {
  columns: number;
  unitSize: number;
};

type SheetGridProps = {
  children: ReactNode;
  editMode?: boolean;
  onMetricsChange?: (metrics: SheetGridMetrics) => void;
};

export function SheetGrid({ children, editMode = false, onMetricsChange }: SheetGridProps) {
  const ref = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const host = element;

    function publishMetrics(width: number) {
      const columns = GRID_COLUMNS;
      const unitSize = (width - (columns - 1) * GRID_GAP_PX) / columns;

      host.style.setProperty("--sheet-grid-columns", String(columns));
      host.style.setProperty("--sheet-grid-column-size", `${unitSize}px`);
      host.style.setProperty("--sheet-grid-row-size", `${unitSize}px`);

      onMetricsChange?.({ columns, unitSize });
    }

    publishMetrics(host.getBoundingClientRect().width);

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      publishMetrics(entry.contentRect.width);
    });

    observer.observe(host);
    return () => observer.disconnect();
  }, [onMetricsChange]);

  return (
    <section
      ref={ref}
      data-sheet-grid
      className={`${cheatsheetStyles.dashboardGrid} ${editMode ? cheatsheetStyles.dashboardGridEditMode : ""}`}
    >
      {children}
    </section>
  );
}

type SheetCardProps = {
  id?: string;
  title: string;
  badge?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  colStart?: number;
  rowStart?: number;
  colSpan?: number;
  rowSpan?: number;
  editMode?: boolean;
  layoutLabel?: string;
  controls?: ReactNode;
  dragging?: boolean;
  dimmed?: boolean;
  keyboardFocused?: boolean;
  manipulating?: boolean;
  blockId?: string;
  onHeaderPointerDown?: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onResizePointerDown?: (direction: ResizeHandleDirection, event: ReactPointerEvent<HTMLDivElement>) => void;
  activeResizeDirection?: ResizeHandleDirection | null;
};

export function SheetCard({
  id,
  title,
  badge,
  footer,
  children,
  colStart = 1,
  rowStart = 1,
  colSpan = 1,
  rowSpan = 1,
  editMode = false,
  layoutLabel,
  controls,
  dragging = false,
  dimmed = false,
  keyboardFocused = false,
  manipulating = false,
  blockId,
  onHeaderPointerDown,
  onResizePointerDown,
  activeResizeDirection = null,
}: SheetCardProps) {
  const classNames = [
    cheatsheetStyles.card,
    editMode ? cheatsheetStyles.cardEditMode : "",
    dragging ? cheatsheetStyles.cardDragging : "",
    dimmed ? cheatsheetStyles.cardDimmed : "",
    keyboardFocused ? cheatsheetStyles.cardKeyboardFocused : "",
    manipulating ? cheatsheetStyles.cardManipulating : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <article
      id={id}
      className={classNames}
      data-layout-card={blockId ? "true" : undefined}
      data-layout-block-id={blockId}
      style={{
        ["--card-col-start" as string]: String(colStart),
        ["--card-row-start" as string]: String(rowStart),
        ["--card-col-span" as string]: String(colSpan),
        ["--card-row-span" as string]: String(rowSpan),
      }}
    >
      {editMode ? (
        <div className={cheatsheetStyles.cardLayoutBadgeRow}>
          <div className={cheatsheetStyles.cardLayoutBadge}>{layoutLabel ?? `${colSpan}x${rowSpan}`}</div>
          {controls}
        </div>
      ) : null}
      <div
        className={`${cheatsheetStyles.cardHeader} ${onHeaderPointerDown ? cheatsheetStyles.cardHeaderDraggable : ""}`}
        onPointerDown={onHeaderPointerDown}
      >
        <h2 className={cheatsheetStyles.cardTitle}>{title}</h2>
        {badge ? <span className={cheatsheetStyles.cardBadge}>{badge}</span> : null}
      </div>
      {onResizePointerDown ? (
        <>
          <div
            className={`${cheatsheetStyles.cardResizeHandle} ${cheatsheetStyles.cardResizeHandleNorth}`}
            data-card-resize-handle
            data-active={activeResizeDirection === "north" || activeResizeDirection === "north-east" || activeResizeDirection === "north-west"}
            onPointerDown={(event) => onResizePointerDown("north", event)}
          />
          <div
            className={`${cheatsheetStyles.cardResizeHandle} ${cheatsheetStyles.cardResizeHandleNorthEast}`}
            data-card-resize-handle
            data-active={activeResizeDirection === "north-east"}
            onPointerDown={(event) => onResizePointerDown("north-east", event)}
          />
          <div
            className={`${cheatsheetStyles.cardResizeHandle} ${cheatsheetStyles.cardResizeHandleEast}`}
            data-card-resize-handle
            data-active={activeResizeDirection === "east" || activeResizeDirection === "north-east" || activeResizeDirection === "south-east"}
            onPointerDown={(event) => onResizePointerDown("east", event)}
          />
          <div
            className={`${cheatsheetStyles.cardResizeHandle} ${cheatsheetStyles.cardResizeHandleSouth}`}
            data-card-resize-handle
            data-active={activeResizeDirection === "south" || activeResizeDirection === "south-east" || activeResizeDirection === "south-west"}
            onPointerDown={(event) => onResizePointerDown("south", event)}
          />
          <div
            className={`${cheatsheetStyles.cardResizeHandle} ${cheatsheetStyles.cardResizeHandleSouthEast}`}
            data-card-resize-handle
            data-active={activeResizeDirection === "south-east"}
            onPointerDown={(event) => onResizePointerDown("south-east", event)}
          />
          <div
            className={`${cheatsheetStyles.cardResizeHandle} ${cheatsheetStyles.cardResizeHandleSouthWest}`}
            data-card-resize-handle
            data-active={activeResizeDirection === "south-west"}
            onPointerDown={(event) => onResizePointerDown("south-west", event)}
          />
          <div
            className={`${cheatsheetStyles.cardResizeHandle} ${cheatsheetStyles.cardResizeHandleWest}`}
            data-card-resize-handle
            data-active={activeResizeDirection === "west" || activeResizeDirection === "north-west" || activeResizeDirection === "south-west"}
            onPointerDown={(event) => onResizePointerDown("west", event)}
          />
          <div
            className={`${cheatsheetStyles.cardResizeHandle} ${cheatsheetStyles.cardResizeHandleNorthWest}`}
            data-card-resize-handle
            data-active={activeResizeDirection === "north-west"}
            onPointerDown={(event) => onResizePointerDown("north-west", event)}
          />
        </>
      ) : null}
      <div className={cheatsheetStyles.cardBody}>{children}</div>
      {footer ? <div className={cheatsheetStyles.cardFooter}>{footer}</div> : null}
    </article>
  );
}

type SheetHeadingBlockProps = {
  id?: string;
  title: string;
  text?: string;
  colStart?: number;
  rowStart?: number;
  colSpan?: number;
  rowSpan?: number;
  editMode?: boolean;
  layoutLabel?: string;
  dragging?: boolean;
  dimmed?: boolean;
  keyboardFocused?: boolean;
  manipulating?: boolean;
  blockId?: string;
  onHeaderPointerDown?: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onResizePointerDown?: (direction: ResizeHandleDirection, event: ReactPointerEvent<HTMLDivElement>) => void;
  activeResizeDirection?: ResizeHandleDirection | null;
};

export function SheetHeadingBlock({
  id,
  title,
  text,
  colStart = 1,
  rowStart = 1,
  colSpan = 36,
  rowSpan = 2,
  editMode = false,
  layoutLabel,
  dragging = false,
  dimmed = false,
  keyboardFocused = false,
  manipulating = false,
  blockId,
  onHeaderPointerDown,
  onResizePointerDown,
  activeResizeDirection = null,
}: SheetHeadingBlockProps) {
  const classNames = [
    cheatsheetStyles.headingBlock,
    editMode ? cheatsheetStyles.headingBlockEditMode : "",
    dragging ? cheatsheetStyles.headingBlockDragging : "",
    dimmed ? cheatsheetStyles.headingBlockDimmed : "",
    keyboardFocused ? cheatsheetStyles.headingBlockKeyboardFocused : "",
    manipulating ? cheatsheetStyles.headingBlockManipulating : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <article
      id={id}
      className={classNames}
      data-layout-card={blockId ? "true" : undefined}
      data-layout-block-id={blockId}
      style={{
        ["--card-col-start" as string]: String(colStart),
        ["--card-row-start" as string]: String(rowStart),
        ["--card-col-span" as string]: String(colSpan),
        ["--card-row-span" as string]: String(rowSpan),
      }}
    >
      {editMode ? (
        <div className={cheatsheetStyles.cardLayoutBadgeRow}>
          <div className={cheatsheetStyles.cardLayoutBadge}>{layoutLabel ?? `${colSpan}x${rowSpan}`}</div>
        </div>
      ) : null}
      <div
        className={`${cheatsheetStyles.headingBlockHeader} ${onHeaderPointerDown ? cheatsheetStyles.headingBlockHeaderDraggable : ""}`}
        onPointerDown={onHeaderPointerDown}
      >
        <h2 className={cheatsheetStyles.headingBlockTitle}>{title}</h2>
        {text ? <p className={cheatsheetStyles.headingBlockText}>{text}</p> : null}
      </div>
      {onResizePointerDown ? (
        <>
          <div
            className={`${cheatsheetStyles.cardResizeHandle} ${cheatsheetStyles.cardResizeHandleNorth}`}
            data-card-resize-handle
            data-active={activeResizeDirection === "north" || activeResizeDirection === "north-east" || activeResizeDirection === "north-west"}
            onPointerDown={(event) => onResizePointerDown("north", event)}
          />
          <div
            className={`${cheatsheetStyles.cardResizeHandle} ${cheatsheetStyles.cardResizeHandleNorthEast}`}
            data-card-resize-handle
            data-active={activeResizeDirection === "north-east"}
            onPointerDown={(event) => onResizePointerDown("north-east", event)}
          />
          <div
            className={`${cheatsheetStyles.cardResizeHandle} ${cheatsheetStyles.cardResizeHandleEast}`}
            data-card-resize-handle
            data-active={activeResizeDirection === "east" || activeResizeDirection === "north-east" || activeResizeDirection === "south-east"}
            onPointerDown={(event) => onResizePointerDown("east", event)}
          />
          <div
            className={`${cheatsheetStyles.cardResizeHandle} ${cheatsheetStyles.cardResizeHandleSouth}`}
            data-card-resize-handle
            data-active={activeResizeDirection === "south" || activeResizeDirection === "south-east" || activeResizeDirection === "south-west"}
            onPointerDown={(event) => onResizePointerDown("south", event)}
          />
          <div
            className={`${cheatsheetStyles.cardResizeHandle} ${cheatsheetStyles.cardResizeHandleSouthEast}`}
            data-card-resize-handle
            data-active={activeResizeDirection === "south-east"}
            onPointerDown={(event) => onResizePointerDown("south-east", event)}
          />
          <div
            className={`${cheatsheetStyles.cardResizeHandle} ${cheatsheetStyles.cardResizeHandleSouthWest}`}
            data-card-resize-handle
            data-active={activeResizeDirection === "south-west"}
            onPointerDown={(event) => onResizePointerDown("south-west", event)}
          />
          <div
            className={`${cheatsheetStyles.cardResizeHandle} ${cheatsheetStyles.cardResizeHandleWest}`}
            data-card-resize-handle
            data-active={activeResizeDirection === "west" || activeResizeDirection === "north-west" || activeResizeDirection === "south-west"}
            onPointerDown={(event) => onResizePointerDown("west", event)}
          />
          <div
            className={`${cheatsheetStyles.cardResizeHandle} ${cheatsheetStyles.cardResizeHandleNorthWest}`}
            data-card-resize-handle
            data-active={activeResizeDirection === "north-west"}
            onPointerDown={(event) => onResizePointerDown("north-west", event)}
          />
        </>
      ) : null}
    </article>
  );
}
