"use client";

import { RotateCcw, Undo2, Redo2 } from "lucide-react";

import styles from "./layout-action-group.module.css";

type Props = {
  onUndo: () => void;
  onRedo: () => void;
  onReset: () => void;
  canUndo: boolean;
  canRedo: boolean;
  /**
   * Reset has two meanings depending on layout mode (revert buffered session
   * vs. revert to YAML default). The label / tooltip are provided by the
   * caller so this component stays mode-agnostic.
   */
  resetLabel: string;
  resetTooltip: string;
  /**
   * When false, the reset button is rendered disabled. The Undo / Redo
   * disabled states are derived from `canUndo` / `canRedo`.
   */
  canReset: boolean;
};

export function LayoutActionGroup({
  onUndo,
  onRedo,
  onReset,
  canUndo,
  canRedo,
  canReset,
  resetLabel,
  resetTooltip,
}: Props) {
  return (
    <div className={styles.group} role="toolbar" aria-label="Layout actions">
      <button
        type="button"
        onClick={onUndo}
        disabled={!canUndo}
        className={styles.button}
        aria-label="Undo last layout change"
        title="Undo (u)"
        data-testid="layout-undo-button"
      >
        <Undo2 size={14} strokeWidth={2} aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={onRedo}
        disabled={!canRedo}
        className={styles.button}
        aria-label="Redo last undone layout change"
        title="Redo (z)"
        data-testid="layout-redo-button"
      >
        <Redo2 size={14} strokeWidth={2} aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={onReset}
        disabled={!canReset}
        className={`${styles.button} ${styles.reset}`}
        aria-label={resetLabel}
        title={resetTooltip}
        data-testid="layout-reset-button"
      >
        <RotateCcw size={14} strokeWidth={2} aria-hidden="true" />
      </button>
    </div>
  );
}
