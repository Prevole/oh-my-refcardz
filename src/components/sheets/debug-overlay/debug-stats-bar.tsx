"use client";

import { GRID_COLUMNS } from "../sheet-grid";
import styles from "./debug-overlay.module.css";

type DebugStatsBarProps = {
  slug?: string;
  blockCount: number;
  maxRow: number;
};

/**
 * Sticky info bar shown at the top of the viewport when the debug overlay is
 * active. Reports the grid dimensions, the layout extent, the block count and
 * (if known) the cheatsheet slug. Purely informational.
 */
export function DebugStatsBar({ slug, blockCount, maxRow }: DebugStatsBarProps) {
  return (
    <div className={styles.statsBar} role="status" aria-live="off">
      <span className={styles.statsBadge}>DEBUG</span>
      {slug ? (
        <span className={styles.statsItem}>
          <span className={styles.statsLabel}>sheet</span>
          <span className={styles.statsValue}>{slug}</span>
        </span>
      ) : null}
      <span className={styles.statsItem}>
        <span className={styles.statsLabel}>grid</span>
        <span className={styles.statsValue}>
          {GRID_COLUMNS}×{maxRow}
        </span>
      </span>
      <span className={styles.statsItem}>
        <span className={styles.statsLabel}>blocks</span>
        <span className={styles.statsValue}>{blockCount}</span>
      </span>
      <span className={styles.statsHint}>Ctrl+Shift+D to toggle</span>
    </div>
  );
}
