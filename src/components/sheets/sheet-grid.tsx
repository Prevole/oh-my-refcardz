"use client";

import { useEffect, useRef } from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent, ReactNode } from "react";
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
  debugMode?: boolean;
  layoutReady?: boolean;
  onMetricsChange?: (metrics: SheetGridMetrics) => void;
  style?: CSSProperties;
  /**
   * Fires when a pointerdown lands on the grid background — that is,
   * anywhere outside a `[data-layout-card]` descendant. Used by the
   * sheet renderer to exit a buffered keyboard layout session when
   * the user clicks on the empty grid area (Phase FA6).
   */
  onEmptyPointerDown?: (event: ReactPointerEvent<HTMLElement>) => void;
};

export function SheetGrid({
  children,
  editMode = false,
  debugMode = false,
  layoutReady = false,
  onMetricsChange,
  style,
  onEmptyPointerDown,
}: SheetGridProps) {
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

  function handlePointerDown(event: ReactPointerEvent<HTMLElement>) {
    if (!onEmptyPointerDown) return;
    // Only fire when the pointerdown originated on the grid itself
    // (or its non-card whitespace), not when it bubbled up from a
    // card. `closest` walks ancestors including the target itself.
    if (!(event.target instanceof Element)) return;
    if (event.target.closest("[data-layout-card]")) return;
    onEmptyPointerDown(event);
  }

  return (
    <section
      ref={ref}
      data-sheet-grid
      data-layout-ready={layoutReady ? "true" : "false"}
      className={[
        cheatsheetStyles.dashboardGrid,
        editMode ? cheatsheetStyles.dashboardGridEditMode : "",
        debugMode ? cheatsheetStyles.dashboardGridDebug : "",
      ]
        .filter(Boolean)
        .join(" ")}
      style={style}
      onPointerDown={handlePointerDown}
    >
      {children}
    </section>
  );
}
