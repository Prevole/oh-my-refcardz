"use client";

import type { CSSProperties } from "react";
import type { LayoutSubMode } from "./use-layout-keyboard";
import styles from "./layout-mode-pill.module.css";

type Props = {
  mode: LayoutSubMode;
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

export function LayoutModePill({ mode }: Props) {
  const style = { "--layout-mode-color": COLORS[mode] } as CSSProperties;
  return (
    <div
      className={styles.pill}
      style={style}
      role="status"
      aria-live="polite"
      data-testid="layout-mode-pill"
      data-mode={mode}
    >
      {LABELS[mode]}
    </div>
  );
}
