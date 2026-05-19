"use client";

import { GRID_COLUMNS } from "../sheet-grid";
import styles from "./debug-overlay.module.css";

type DebugAxesProps = {
  /** Maximum row used by the layout (1-indexed; final row to label). */
  maxRow: number;
};

/**
 * Axes overlay for the layout debug mode. Renders:
 *  - A top ruler with column indices 0..GRID_COLUMNS-1.
 *  - A left ruler with row indices 0..maxRow-1.
 *
 * Positioned absolutely inside the `[data-sheet-grid]` host so it does not
 * participate in the CSS grid flow. The ruler cells use the same grid sizing
 * variables (`--sheet-grid-column-size`, `--sheet-grid-row-size`,
 * `--sheet-grid-gap`) as the layout itself.
 */
export function DebugAxesOverlay({ maxRow }: DebugAxesProps) {
  const cols = Array.from({ length: GRID_COLUMNS }, (_, i) => i);
  const rows = Array.from({ length: Math.max(maxRow, 1) }, (_, i) => i);

  return (
    <div className={styles.axes} aria-hidden="true">
      <div className={styles.colAxis}>
        {cols.map((c) => (
          <span key={c} className={styles.colLabel}>
            {c}
          </span>
        ))}
      </div>
      <div className={styles.rowAxis}>
        {rows.map((r) => (
          <span key={r} className={styles.rowLabel}>
            {r}
          </span>
        ))}
      </div>
    </div>
  );
}
