"use client";

import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import cheatsheetStyles from "./cheatsheet-rendering.module.css";

export const GRID_GAP_PX = 16;
export const GRID_COLUMNS = 12;

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
      className={`${cheatsheetStyles.dashboardGrid} ${editMode ? cheatsheetStyles.dashboardGridEditMode : ""}`}
    >
      {children}
    </section>
  );
}

type SheetCardProps = {
  title: string;
  badge?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  colSpan?: number;
  rowSpan?: number;
  editMode?: boolean;
  layoutLabel?: string;
  controls?: ReactNode;
};

export function SheetCard({
  title,
  badge,
  footer,
  children,
  colSpan = 1,
  rowSpan = 1,
  editMode = false,
  layoutLabel,
  controls,
}: SheetCardProps) {
  return (
    <article
      className={`${cheatsheetStyles.card} ${editMode ? cheatsheetStyles.cardEditMode : ""}`}
      style={{
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
      <div className={cheatsheetStyles.cardHeader}>
        <h2 className={cheatsheetStyles.cardTitle}>{title}</h2>
        {badge ? <span className={cheatsheetStyles.cardBadge}>{badge}</span> : null}
      </div>
      <div className={cheatsheetStyles.cardBody}>{children}</div>
      {footer ? <div className={cheatsheetStyles.cardFooter}>{footer}</div> : null}
    </article>
  );
}
