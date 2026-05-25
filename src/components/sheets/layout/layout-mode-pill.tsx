"use client";

import type { CSSProperties } from "react";
import type { LayoutSubMode } from "./use-layout-keyboard";
import { formatChangesCount } from "./format-changes-count";
import styles from "./layout-mode-pill.module.css";

type Props = {
  mode: LayoutSubMode;
  /**
   * Number of staged buffer changes from the active layout-mode
   * session. When greater than zero, the pill appends a muted
   * counter suffix like ` · 3 changes`. Defaults to 0 (no suffix).
   */
  changesCount?: number;
};

const LABELS: Record<LayoutSubMode, string> = {
  navigation: "Navigation",
  move: "Move",
  resize: "Resize",
};

const COLORS: Record<LayoutSubMode, string> = {
  navigation: "var(--sheet-accent, var(--accent))",
  move: "var(--success)",
  resize: "var(--warning)",
};

export const LAYOUT_MODE_COLORS = COLORS;

export function LayoutModePill({ mode, changesCount = 0 }: Props) {
  const style = { "--layout-mode-color": COLORS[mode] } as CSSProperties;
  const showCounter = changesCount > 0;
  return (
    <div
      className={styles.pill}
      style={style}
      role="status"
      aria-live="polite"
      data-testid="layout-mode-pill"
      data-mode={mode}
      data-changes-count={changesCount}
    >
      <span className={styles.label}>{LABELS[mode]}</span>
      {showCounter ? (
        <span className={styles.counter} data-testid="layout-mode-pill-counter">
          <span aria-hidden="true" className={styles.separator}>
            ·
          </span>
          {formatChangesCount(changesCount)}
        </span>
      ) : null}
    </div>
  );
}
