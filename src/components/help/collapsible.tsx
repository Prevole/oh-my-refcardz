"use client";

import { useState, type ReactNode } from "react";
import styles from "./collapsible.module.css";

type CollapsibleProps = {
  summary: string;
  defaultOpen?: boolean;
  children: ReactNode;
  testId?: string;
};

/**
 * Lightweight disclosure widget tuned for the help modal: a single
 * summary button toggles a content region. Not part of the general
 * settings accordion (which is being retired) — this one is purpose-built
 * for "show advanced variants" style controls.
 */
export function Collapsible({
  summary,
  defaultOpen = false,
  children,
  testId,
}: CollapsibleProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className={styles.root} data-testid={testId} data-open={open}>
      <button
        type="button"
        className={styles.summary}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <svg
          className={`${styles.chevron} ${open ? styles.chevronOpen : ""}`}
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M9 18l6-6-6-6" />
        </svg>
        <span>{summary}</span>
      </button>
      {open && <div className={styles.content}>{children}</div>}
    </div>
  );
}
