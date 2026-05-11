"use client";

import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
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
