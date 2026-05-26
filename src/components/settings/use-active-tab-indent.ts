"use client";

import { useEffect, type RefObject } from "react";

type Options = {
  /** Strip containing the parent tabs (e.g. L1 in help, L2 in settings). */
  parentStripRef: RefObject<HTMLElement | null>;
  /** Strip whose left padding should be aligned under the active parent tab. */
  childStripRef: RefObject<HTMLElement | null>;
  /** Active parent tab id (used to locate its DOM element via data-testid). */
  activeParentId: string;
  /** Prefix used by the parent Tabs component to build data-testid values. */
  parentTestIdPrefix: string;
  /** When false, the effect is a no-op (skip work when child strip is hidden). */
  enabled?: boolean;
};

/**
 * Aligns a child tab strip's left edge with the active tab of its parent
 * strip. Measures the active parent tab's offsetLeft within the parent strip
 * and writes it as `--child-tab-indent` on the child strip element. The
 * shared `Tabs` variants `tertiary` and `secondaryInverted` consume that
 * variable via `padding-left`.
 *
 * Re-measures on resize via a ResizeObserver bound to the parent strip.
 */
export function useActiveTabIndent({
  parentStripRef,
  childStripRef,
  activeParentId,
  parentTestIdPrefix,
  enabled = true,
}: Options) {
  useEffect(() => {
    if (!enabled) return;
    const parent = parentStripRef.current;
    const child = childStripRef.current;
    if (!parent || !child) return;

    const measure = () => {
      const selector = `[data-testid="${parentTestIdPrefix}-${activeParentId}"]`;
      const tab = parent.querySelector<HTMLElement>(selector);
      if (!tab) return;
      const stripRect = parent.getBoundingClientRect();
      const tabRect = tab.getBoundingClientRect();
      const indent = Math.max(0, tabRect.left - stripRect.left);
      child.style.setProperty("--child-tab-indent", `${indent}px`);
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(parent);
    return () => observer.disconnect();
  }, [enabled, parentStripRef, childStripRef, activeParentId, parentTestIdPrefix]);
}
