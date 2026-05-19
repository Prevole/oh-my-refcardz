"use client";

import type { ReactNode } from "react";
import { RotateCcw, Save } from "lucide-react";
import { InlineKeybinding } from "@/components/help/inline-keybinding-help";
import { ACTION_IDS } from "@/lib/keybindings";
import { GRID_COLUMNS } from "../sheet-grid";
import styles from "./dev-overlay.module.css";

type DevModeBarProps = {
  slug?: string;
  blockCount: number;
  maxRow: number;
  /** Whether the current layout differs from the default (persisted locally). */
  hasSavedLayout: boolean;
  /** Reset the layout to the cheatsheet's default. */
  onReset: () => void;
  /**
   * Persist the current layout to the source YAML via `/api/dev/layouts/[slug]`.
   * Only invoked in development; the Save button is hidden otherwise.
   */
  onSave: () => void;
  /**
   * Slot for the recording control. Rendered next to Save so the recording
   * lifecycle lives entirely inside the dev-mode bar.
   */
  recordingSlot?: ReactNode;
  /**
   * Slot for the logs dropdown (added in Phase 4).
   */
  logsSlot?: ReactNode;
};

/**
 * Sticky dev-mode bar shown at the top of the viewport when developer mode is
 * active. Provides:
 *  - Layout stats (sheet, grid extent, block count).
 *  - A toolbar with Reset / Save / Recording / Logs controls.
 *  - The toggle shortcut, rendered as an inline-help binding.
 *
 * Save is only shown in development. Reset is always shown but disabled when
 * there is no saved layout.
 */
export function DevModeBar({
  slug,
  blockCount,
  maxRow,
  hasSavedLayout,
  onReset,
  onSave,
  recordingSlot,
  logsSlot,
}: DevModeBarProps) {
  const isDev = process.env.NODE_ENV === "development";

  return (
    <div className={styles.statsBar} role="status" aria-live="off">
      <span className={styles.statsBadge}>DEV</span>
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
      <span className={styles.statsItem}>
        <span className={styles.statsLabel}>state</span>
        <span className={styles.statsValue}>
          {hasSavedLayout ? "modified" : "default"}
        </span>
      </span>

      <span className={styles.statsSep} aria-hidden="true" />

      <span className={styles.statsToolbar}>
        <span className={styles.toolbarGroup}>
          <button
            type="button"
            className={`${styles.toolbarButton} ${styles.toolbarButtonGrouped}`}
            onClick={onReset}
            disabled={!hasSavedLayout}
            title="Reset the layout to the cheatsheet's default"
            aria-label="Reset layout"
          >
            <RotateCcw className={styles.toolbarIcon} size={14} strokeWidth={2} aria-hidden="true" />
          </button>
          {isDev ? (
            <button
              type="button"
              className={`${styles.toolbarButton} ${styles.toolbarButtonGrouped} ${styles.toolbarButtonPrimary}`}
              onClick={onSave}
              title="Persist current layout to the source YAML (development only)"
              aria-label="Save layout to source"
            >
              <Save className={styles.toolbarIcon} size={14} strokeWidth={2} aria-hidden="true" />
            </button>
          ) : null}
        </span>
        {recordingSlot}
        {logsSlot}
      </span>

      <span className={styles.statsSep} aria-hidden="true" />

      <span className={styles.toolbarShortcut}>
        toggle
        <InlineKeybinding actionId={ACTION_IDS.TOGGLE_DEVELOPER_MODE} />
      </span>
    </div>
  );
}
