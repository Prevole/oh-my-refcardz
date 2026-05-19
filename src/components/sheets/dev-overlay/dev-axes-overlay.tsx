"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Eraser } from "lucide-react";
import { GRID_COLUMNS } from "../sheet-grid";
import styles from "./dev-overlay.module.css";

type DevAxesProps = {
  /** Maximum row used by the layout (1-indexed; final row to label). */
  maxRow: number;
};

/**
 * Axes overlay for developer mode. Renders:
 *  - A top ruler with column indices 0..GRID_COLUMNS-1.
 *  - A left ruler with row indices 0..maxRow-1.
 *  - Hover bands highlighting the currently hovered row/column. Hover is
 *    driven by both the axis labels AND the pointer position inside the grid:
 *    moving the cursor over a block updates the hovered row/column derived
 *    from the grid sizing variables.
 *  - Click bands for any row/column the user has toggled via the axis labels.
 *  - Intersection squares between any active (hover or clicked) row and any
 *    active (hover or clicked) column. Squares are styled with the stronger
 *    "clicked" appearance when both axes are clicked, otherwise with the
 *    "hover" appearance.
 *
 * Hover and click use different hues (teal for hover, amber for click) so the
 * two layers remain distinguishable when they overlap; hover bands sit above
 * click bands via z-index so the hover hue is always visible on top.
 *
 * The grid pointer tracking attaches a `pointermove`/`pointerleave` listener
 * to the closest `[data-sheet-grid]` ancestor; this keeps blocks fully
 * interactive (no extra pointer-capturing layer) while still feeding hover
 * state from anywhere inside the grid.
 */
export function DevAxesOverlay({ maxRow }: DevAxesProps) {
  const cols = Array.from({ length: GRID_COLUMNS }, (_, i) => i);
  const rows = Array.from({ length: Math.max(maxRow, 1) }, (_, i) => i);

  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredRow, setHoveredRow] = useState<number | null>(null);
  const [hoveredCol, setHoveredCol] = useState<number | null>(null);
  const [clickedRows, setClickedRows] = useState<Set<number>>(() => new Set());
  const [clickedCols, setClickedCols] = useState<Set<number>>(() => new Set());

  const toggleRow = useCallback((r: number) => {
    setClickedRows((prev) => {
      const next = new Set(prev);
      if (next.has(r)) next.delete(r);
      else next.add(r);
      return next;
    });
  }, []);

  const toggleCol = useCallback((c: number) => {
    setClickedCols((prev) => {
      const next = new Set(prev);
      if (next.has(c)) next.delete(c);
      else next.add(c);
      return next;
    });
  }, []);

  const clearAll = useCallback(() => {
    setClickedRows(new Set());
    setClickedCols(new Set());
  }, []);

  const hasAnyPinned = clickedRows.size > 0 || clickedCols.size > 0;

  // Track pointer position over the parent grid so hover follows the cursor
  // even when it sits over a block, not just over the ruler labels.
  useEffect(() => {
    const overlay = containerRef.current;
    if (!overlay) return;
    const grid = overlay.closest<HTMLElement>("[data-sheet-grid]");
    if (!grid) return;

    function readSize(name: string): number {
      const raw = getComputedStyle(grid!).getPropertyValue(name).trim();
      if (raw.endsWith("px")) return parseFloat(raw);
      // Fallback: compute via a probe element. This is only used for `rem`
      // values; the sheet grid uses pixel-resolved values at render time.
      const probe = document.createElement("div");
      probe.style.cssText = `position:absolute;visibility:hidden;width:${raw}`;
      grid!.appendChild(probe);
      const px = probe.getBoundingClientRect().width;
      probe.remove();
      return px;
    }

    function indexFromCoord(coord: number, cellSize: number, gap: number): number {
      // Each cell occupies cellSize px, separated by gap px. We accept hover
      // inside the gap as belonging to the preceding cell.
      const stride = cellSize + gap;
      if (stride <= 0) return -1;
      const i = Math.floor(coord / stride);
      const local = coord - i * stride;
      if (local > cellSize) return -1; // cursor sits in the gap after cell i
      return i;
    }

    function onMove(event: PointerEvent) {
      const rect = grid!.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      const colSize = readSize("--sheet-grid-column-size");
      const rowSize = readSize("--sheet-grid-row-size");
      const gap = readSize("--sheet-grid-gap");

      const col = indexFromCoord(x, colSize, gap);
      const row = indexFromCoord(y, rowSize, gap);

      setHoveredCol(col >= 0 && col < GRID_COLUMNS ? col : null);
      setHoveredRow(row >= 0 && row < Math.max(maxRow, 1) ? row : null);
    }

    function onLeave() {
      setHoveredCol(null);
      setHoveredRow(null);
    }

    grid.addEventListener("pointermove", onMove);
    grid.addEventListener("pointerleave", onLeave);
    return () => {
      grid.removeEventListener("pointermove", onMove);
      grid.removeEventListener("pointerleave", onLeave);
    };
  }, [maxRow]);

  // Active sets (hover ∪ clicked) for intersection rendering.
  const activeRows = new Set<number>(clickedRows);
  if (hoveredRow !== null) activeRows.add(hoveredRow);
  const activeCols = new Set<number>(clickedCols);
  if (hoveredCol !== null) activeCols.add(hoveredCol);

  const intersections: { row: number; col: number; strong: boolean }[] = [];
  for (const r of activeRows) {
    for (const c of activeCols) {
      const strong = clickedRows.has(r) && clickedCols.has(c);
      intersections.push({ row: r, col: c, strong });
    }
  }

  return (
    <div className={styles.axes} aria-hidden="true" ref={containerRef}>
      {/* Corner button (NW): clears all pinned rows and columns. ------- */}
      <button
        type="button"
        className={styles.cornerClearButton}
        onClick={clearAll}
        disabled={!hasAnyPinned}
        title="Clear all pinned rows and columns"
        aria-label="Clear all pinned rows and columns"
      >
        <span className={styles.cornerClearButtonInner}>
          <Eraser className={styles.toolbarIcon} size={14} strokeWidth={2} aria-hidden="true" />
        </span>
      </button>

      {/* Click bands (rendered first so hover bands stack on top) -------- */}
      {[...clickedRows].map((r) => (
        <div
          key={`rc-${r}`}
          className={`${styles.rowBand} ${styles.rowBandClick}`}
          style={{ "--axis-index": r } as React.CSSProperties}
        />
      ))}
      {[...clickedCols].map((c) => (
        <div
          key={`cc-${c}`}
          className={`${styles.colBand} ${styles.colBandClick}`}
          style={{ "--axis-index": c } as React.CSSProperties}
        />
      ))}

      {/* Hover bands — stacked above click bands so the hover hue is
          always visible, even on a pinned row/column. ------------------- */}
      {hoveredRow !== null ? (
        <div
          className={`${styles.rowBand} ${styles.rowBandHover}`}
          style={{ "--axis-index": hoveredRow } as React.CSSProperties}
        />
      ) : null}
      {hoveredCol !== null ? (
        <div
          className={`${styles.colBand} ${styles.colBandHover}`}
          style={{ "--axis-index": hoveredCol } as React.CSSProperties}
        />
      ) : null}

      {/* Intersections ------------------------------------------------- */}
      {intersections.map(({ row, col, strong }) => (
        <div
          key={`i-${row}-${col}`}
          className={`${styles.intersection} ${
            strong ? styles.intersectionClick : styles.intersectionHover
          }`}
          style={
            {
              "--axis-row": row,
              "--axis-col": col,
            } as React.CSSProperties
          }
        />
      ))}

      {/* Column labels (top ruler) ------------------------------------- */}
      <div className={styles.colAxis}>
        {cols.map((c) => {
          const isClicked = clickedCols.has(c);
          return (
            <button
              type="button"
              key={c}
              className={`${styles.colLabel} ${isClicked ? styles.colLabelClick : ""}`}
              onMouseEnter={() => setHoveredCol(c)}
              onMouseLeave={() => setHoveredCol((cur) => (cur === c ? null : cur))}
              onClick={() => toggleCol(c)}
            >
              {c}
            </button>
          );
        })}
      </div>

      {/* Row labels (left ruler) --------------------------------------- */}
      <div className={styles.rowAxis}>
        {rows.map((r) => {
          const isClicked = clickedRows.has(r);
          return (
            <button
              type="button"
              key={r}
              className={`${styles.rowLabel} ${isClicked ? styles.rowLabelClick : ""}`}
              onMouseEnter={() => setHoveredRow(r)}
              onMouseLeave={() => setHoveredRow((cur) => (cur === r ? null : cur))}
              onClick={() => toggleRow(r)}
            >
              {r}
            </button>
          );
        })}
      </div>
    </div>
  );
}
