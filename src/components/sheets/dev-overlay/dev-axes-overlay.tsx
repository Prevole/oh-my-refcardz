"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { Eraser } from "lucide-react";
import { GRID_COLUMNS } from "../sheet-grid";
import { useKeyboardScope } from "@/hooks/use-keyboard-context";
import { useAction } from "@/hooks/use-action";
import { ACTION_IDS } from "@/lib/keybindings";
import styles from "./dev-overlay.module.css";

type DevAxesProps = {
  /** Maximum row used by the layout (1-indexed; final row to label). */
  maxRow: number;
};

export type DevAxesOverlayHandle = {
  enterAxesMode: () => void;
  exitAxesMode: () => void;
  isAxesModeActive: () => boolean;
};

/**
 * Axes overlay for developer mode. Two interaction modes:
 *
 *  - Pointer mode (default). Hover bands follow the cursor inside the grid;
 *    clicking a row/column label pins it. Intersection squares highlight the
 *    crossing of active rows/columns.
 *
 *  - Keyboard mode (entered via the `dev.enter-axes-mode` action, exited via
 *    Escape). A virtual cursor (col, row) replaces pointer-driven hover.
 *    `h`/`j`/`k`/`l` (and arrow keys) move the cursor; Space pins the column,
 *    Shift+Space pins the row; `c` clears all pinned axes. Pointer tracking
 *    is suspended while in keyboard mode so the keyboard cursor remains
 *    visible.
 *
 * The component pushes a modal `dev-axes` scope while keyboard mode is
 * active; this blocks the parent `dev` scope from receiving stray keys.
 */
export const DevAxesOverlay = forwardRef<DevAxesOverlayHandle, DevAxesProps>(
  function DevAxesOverlay({ maxRow }, ref) {
    const cols = useMemo(
      () => Array.from({ length: GRID_COLUMNS }, (_, i) => i),
      [],
    );
    const rowCount = Math.max(maxRow, 1);
    const rows = useMemo(
      () => Array.from({ length: rowCount }, (_, i) => i),
      [rowCount],
    );

    const containerRef = useRef<HTMLDivElement>(null);
    const [hoveredRow, setHoveredRow] = useState<number | null>(null);
    const [hoveredCol, setHoveredCol] = useState<number | null>(null);
    const [clickedRows, setClickedRows] = useState<Set<number>>(() => new Set());
    const [clickedCols, setClickedCols] = useState<Set<number>>(() => new Set());

    const [keyboardMode, setKeyboardMode] = useState(false);
    const [cursorCol, setCursorCol] = useState(0);
    const [cursorRow, setCursorRow] = useState(0);

    useKeyboardScope("dev-axes", keyboardMode, { modal: true });

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

    const enterAxesMode = useCallback(() => {
      setKeyboardMode(true);
      setCursorCol((c) => Math.min(Math.max(c, 0), GRID_COLUMNS - 1));
      setCursorRow((r) => Math.min(Math.max(r, 0), rowCount - 1));
    }, [rowCount]);

    const exitAxesMode = useCallback(() => {
      setKeyboardMode(false);
    }, []);

    useImperativeHandle(
      ref,
      () => ({
        enterAxesMode,
        exitAxesMode,
        isAxesModeActive: () => keyboardMode,
      }),
      [enterAxesMode, exitAxesMode, keyboardMode],
    );

    // -- Keyboard actions (scope `dev-axes`) ---------------------------------
    useAction(ACTION_IDS.DEV_AXES_CURSOR_LEFT, "dev-axes", () => {
      setCursorCol((c) => Math.max(0, c - 1));
    });
    useAction(ACTION_IDS.DEV_AXES_CURSOR_RIGHT, "dev-axes", () => {
      setCursorCol((c) => Math.min(GRID_COLUMNS - 1, c + 1));
    });
    useAction(ACTION_IDS.DEV_AXES_CURSOR_UP, "dev-axes", () => {
      setCursorRow((r) => Math.max(0, r - 1));
    });
    useAction(ACTION_IDS.DEV_AXES_CURSOR_DOWN, "dev-axes", () => {
      setCursorRow((r) => Math.min(rowCount - 1, r + 1));
    });
    useAction(ACTION_IDS.DEV_AXES_TOGGLE_COL, "dev-axes", () => {
      toggleCol(cursorCol);
    });
    useAction(ACTION_IDS.DEV_AXES_TOGGLE_ROW, "dev-axes", () => {
      toggleRow(cursorRow);
    });
    useAction(ACTION_IDS.DEV_AXES_CLEAR_ALL, "dev-axes", () => {
      clearAll();
    });
    useAction(ACTION_IDS.DEV_AXES_EXIT, "dev-axes", () => {
      exitAxesMode();
    });

    const hasAnyPinned = clickedRows.size > 0 || clickedCols.size > 0;

    // Pointer tracking: disabled while keyboard mode is active so the virtual
    // cursor stays put and is not overridden by accidental mouse motion.
    useEffect(() => {
      if (keyboardMode) return;
      const overlay = containerRef.current;
      if (!overlay) return;
      const grid = overlay.closest<HTMLElement>("[data-sheet-grid]");
      if (!grid) return;

      function readSize(name: string): number {
        const raw = getComputedStyle(grid!).getPropertyValue(name).trim();
        if (raw.endsWith("px")) return parseFloat(raw);
        const probe = document.createElement("div");
        probe.style.cssText = `position:absolute;visibility:hidden;width:${raw}`;
        grid!.appendChild(probe);
        const px = probe.getBoundingClientRect().width;
        probe.remove();
        return px;
      }

      function indexFromCoord(coord: number, cellSize: number, gap: number): number {
        const stride = cellSize + gap;
        if (stride <= 0) return -1;
        const i = Math.floor(coord / stride);
        const local = coord - i * stride;
        if (local > cellSize) return -1;
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
        setHoveredRow(row >= 0 && row < rowCount ? row : null);
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
    }, [keyboardMode, rowCount]);

    // Clear any leftover hover state when entering keyboard mode.
    useEffect(() => {
      if (keyboardMode) {
        setHoveredRow(null);
        setHoveredCol(null);
      }
    }, [keyboardMode]);

    // In keyboard mode, the virtual cursor drives the "hover" highlight.
    const effectiveHoveredRow = keyboardMode ? cursorRow : hoveredRow;
    const effectiveHoveredCol = keyboardMode ? cursorCol : hoveredCol;

    const activeRows = new Set<number>(clickedRows);
    if (effectiveHoveredRow !== null) activeRows.add(effectiveHoveredRow);
    const activeCols = new Set<number>(clickedCols);
    if (effectiveHoveredCol !== null) activeCols.add(effectiveHoveredCol);

    const intersections: { row: number; col: number; strong: boolean }[] = [];
    for (const r of activeRows) {
      for (const c of activeCols) {
        const strong = clickedRows.has(r) && clickedCols.has(c);
        intersections.push({ row: r, col: c, strong });
      }
    }

    return (
      <div
        className={`${styles.axes} ${keyboardMode ? styles.axesKeyboardMode : ""}`}
        aria-hidden="true"
        ref={containerRef}
      >
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

        {effectiveHoveredRow !== null ? (
          <div
            className={`${styles.rowBand} ${styles.rowBandHover}`}
            style={{ "--axis-index": effectiveHoveredRow } as React.CSSProperties}
          />
        ) : null}
        {effectiveHoveredCol !== null ? (
          <div
            className={`${styles.colBand} ${styles.colBandHover}`}
            style={{ "--axis-index": effectiveHoveredCol } as React.CSSProperties}
          />
        ) : null}

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

        <div className={styles.colAxis}>
          {cols.map((c) => {
            const isClicked = clickedCols.has(c);
            const isHovered = effectiveHoveredCol === c;
            return (
              <button
                type="button"
                key={c}
                className={[
                  styles.colLabel,
                  isClicked ? styles.colLabelClick : "",
                  isHovered ? styles.axisLabelHover : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                onMouseEnter={() => {
                  if (!keyboardMode) setHoveredCol(c);
                }}
                onMouseLeave={() => {
                  if (!keyboardMode) setHoveredCol((cur) => (cur === c ? null : cur));
                }}
                onClick={() => toggleCol(c)}
              >
                {c}
              </button>
            );
          })}
        </div>

        <div className={styles.rowAxis}>
          {rows.map((r) => {
            const isClicked = clickedRows.has(r);
            const isHovered = effectiveHoveredRow === r;
            return (
              <button
                type="button"
                key={r}
                className={[
                  styles.rowLabel,
                  isClicked ? styles.rowLabelClick : "",
                  isHovered ? styles.axisLabelHover : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                onMouseEnter={() => {
                  if (!keyboardMode) setHoveredRow(r);
                }}
                onMouseLeave={() => {
                  if (!keyboardMode) setHoveredRow((cur) => (cur === r ? null : cur));
                }}
                onClick={() => toggleRow(r)}
              >
                {r}
              </button>
            );
          })}
        </div>
      </div>
    );
  },
);
