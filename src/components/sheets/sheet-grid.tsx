"use client";

import { useEffect, useRef } from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent, ReactNode } from "react";
import cheatsheetStyles from "./cheatsheet-rendering.module.css";
import { GRID_COLUMNS, GRID_GAP_PX } from "@/lib/layout/grid-constants";

export { GRID_COLUMNS, GRID_GAP_PX };

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
  /**
   * Minimum number of rows the grid must reserve while a mouse drag or
   * resize is in progress. The grid height is purely intrinsic (driven by
   * `grid-auto-rows` and the bottom-most card), so without this floor the
   * grid can shrink under the cursor when the user drags the bottommost
   * card upward, which in turn shifts `getBoundingClientRect()` and
   * destabilizes the pointer→cell mapping. The floor is captured from the
   * snapshot at interaction start and stays constant until release; the
   * grid is still free to grow beyond it.
   */
  interactionMinRows?: number;
};

/**
 * CSS variables that drive the grid layout. They are computed during render
 * (not in an effect) so the SSR'd HTML already carries the correct values,
 * eliminating the cumulative layout shift that would otherwise occur when the
 * client overrides the defaults defined in `cheatsheet-rendering.module.css`.
 *
 * `--sheet-grid-column-size` uses `100%` (the grid's own width, since
 * column tracks resolve against the inline axis). `--sheet-grid-row-size`
 * uses `100cqi` (container inline-size) so it also resolves against the
 * grid's WIDTH rather than its HEIGHT — required because `grid-auto-rows`
 * would otherwise treat `100%` as the container's height. The grid CSS
 * module sets `container-type: inline-size` to make `cqi` work.
 *
 * `--sheet-grid-columns` is the single source of truth (`GRID_COLUMNS`).
 * `getComputedStyle()` resolves the `calc(...)` to a pixel value at read
 * time, which is what consumers like the dev-axes overlay rely on.
 */
const GRID_COLUMN_SIZE_FORMULA = `calc((100% - (var(--sheet-grid-columns) - 1) * var(--sheet-grid-gap)) / var(--sheet-grid-columns))`;
const GRID_ROW_SIZE_FORMULA = `calc((100cqi - (var(--sheet-grid-columns) - 1) * var(--sheet-grid-gap)) / var(--sheet-grid-columns))`;

const GRID_CSS_VARS = {
  "--sheet-grid-columns": String(GRID_COLUMNS),
  "--sheet-grid-gap": `${GRID_GAP_PX}px`,
  "--sheet-grid-column-size": GRID_COLUMN_SIZE_FORMULA,
  "--sheet-grid-row-size": GRID_ROW_SIZE_FORMULA,
} as CSSProperties;

export function SheetGrid({
  children,
  editMode = false,
  debugMode = false,
  layoutReady = false,
  onMetricsChange,
  style,
  onEmptyPointerDown,
  interactionMinRows,
}: SheetGridProps) {
  const ref = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const host = element;

    function publishMetrics(width: number) {
      const columns = GRID_COLUMNS;
      const unitSize = (width - (columns - 1) * GRID_GAP_PX) / columns;
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
    <div className={cheatsheetStyles.dashboardGridContainer}>
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
        style={{
          ...GRID_CSS_VARS,
          ...style,
          ...(interactionMinRows && interactionMinRows > 0
            ? {
                minHeight: `calc(${interactionMinRows} * var(--sheet-grid-row-size) + ${interactionMinRows - 1} * ${GRID_GAP_PX}px)`,
              }
            : null),
        }}
        onPointerDown={handlePointerDown}
      >
        {children}
      </section>
    </div>
  );
}
