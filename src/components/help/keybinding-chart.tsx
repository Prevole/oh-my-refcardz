"use client";

import { Fragment } from "react";
import type { ActionId } from "@/lib/keybindings";
import { HelpRow } from "@/components/settings/keybinding-display";
import keybindingStyles from "@/components/settings/keybinding-display.module.css";
import styles from "./keybinding-chart.module.css";

/**
 * Entry in a KeybindingChart.
 *
 * - `id`: the ActionId to render. Combos are resolved at runtime via
 *   `useKeybindings`, so reset / customisation is reflected automatically.
 * - `label?`: override the default action label (e.g. shorten "Layout
 *   navigation: focus left" to "Focus card left" in the help modal).
 */
export type ChartEntry = {
  id: ActionId;
  label?: string;
};

type KeybindingChartProps = {
  /**
   * Entries to render. The chart packs them into rows of `cols` cells
   * (default 2). Pass `null` to leave an empty cell — useful when you
   * want a section to render an odd number of entries with a deliberate
   * blank in the trailing position.
   */
  entries: ReadonlyArray<ChartEntry | null>;
  /**
   * Number of label/combo pairs per row (1 or 2). Default 2.
   */
  cols?: 1 | 2;
  /**
   * Optional `data-testid` on the table for spec targeting.
   */
  testId?: string;
};

function chunk<T>(items: ReadonlyArray<T>, size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

/**
 * Read-only keybinding chart used by help/legend surfaces.
 *
 * Renders a table where each row contains `cols` entries (default 2),
 * each entry being a `(combo, label)` pair. Pads the last row with
 * empty cells if needed to keep the column grid stable.
 */
export function KeybindingChart({ entries, cols = 2, testId }: KeybindingChartProps) {
  const rows = chunk(entries, cols);
  const totalCells = cols * 2;

  return (
    <table className={`${keybindingStyles.legendTable} ${styles.chart}`} data-testid={testId}>
      <colgroup>
        {Array.from({ length: totalCells }).map((_, index) => (
          <col key={index} />
        ))}
      </colgroup>
      <tbody>
        {rows.map((row, rowIndex) => (
          <tr key={rowIndex}>
            {row.map((entry, cellIndex) => (
              <Fragment key={cellIndex}>
                {entry ? (
                  <HelpRow actionId={entry.id} label={entry.label} />
                ) : (
                  <>
                    <td />
                    <td />
                  </>
                )}
              </Fragment>
            ))}
            {/* Pad the trailing cells of an incomplete last row. */}
            {row.length < cols &&
              Array.from({ length: cols - row.length }).map((_, padIndex) => (
                <Fragment key={`pad-${padIndex}`}>
                  <td />
                  <td />
                </Fragment>
              ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
