import styles from "../../cheatsheet-rendering.module.css";

type DebugInfo = {
  debugId: string;
  blockId: string;
  current: { x: number; y: number; w: number; h: number };
  initial?: { x: number; y: number; w: number; h: number };
};

type LayoutBadgeProps = {
  /** Fallback label used when no debug info is provided (edit-mode classic format). */
  layoutLabel?: string;
  /** Fallback dimensions when neither label nor debug info is available. */
  colSpan: number;
  rowSpan: number;
  /** When set, render the rich debug content; otherwise show `layoutLabel`. */
  debugInfo?: DebugInfo;
};

function formatPos(p: { x: number; y: number; w: number; h: number }): string {
  return `${p.x},${p.y} ${p.w}x${p.h}`;
}

/**
 * Renders the contents of the per-block layout badge. In edit-only mode it
 * shows the classic `layoutLabel` (e.g. `[A3] 5,2 · 12x6`). When `debugInfo` is
 * passed (debug overlay active), it shows a richer multi-line summary with the
 * block id, current grid position, and the initial position observed at page
 * load when it has drifted from the current.
 */
export function LayoutBadgeContent({
  layoutLabel,
  colSpan,
  rowSpan,
  debugInfo,
}: LayoutBadgeProps) {
  if (!debugInfo) {
    return <>{layoutLabel ?? `${colSpan}x${rowSpan}`}</>;
  }

  const { debugId, blockId, current, initial } = debugInfo;
  const drift =
    initial !== undefined &&
    (initial.x !== current.x ||
      initial.y !== current.y ||
      initial.w !== current.w ||
      initial.h !== current.h);

  return (
    <span className={styles.cardLayoutBadgeDebug}>
      <span className={styles.cardLayoutBadgeDebugRow}>
        <span className={styles.cardLayoutBadgeDebugId}>[{debugId}]</span>
        <span className={styles.cardLayoutBadgeDebugBlockId}>{blockId}</span>
      </span>
      <span className={styles.cardLayoutBadgeDebugRow}>
        <span className={styles.cardLayoutBadgeDebugLabel}>now</span>
        <span>{formatPos(current)}</span>
      </span>
      {drift ? (
        <span className={styles.cardLayoutBadgeDebugRow}>
          <span className={styles.cardLayoutBadgeDebugLabel}>init</span>
          <span>{formatPos(initial!)}</span>
        </span>
      ) : null}
    </span>
  );
}

export type { DebugInfo as LayoutBadgeDebugInfo };
