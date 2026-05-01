"use client";

import { type ReactNode } from "react";
import styles from "./accordion.module.css";

type AccordionItemProps = {
  title: string;
  isOpen: boolean;
  onToggle: () => void;
  disabled?: boolean;
  badge?: string;
  children: ReactNode;
};

export function AccordionItem({
  title,
  isOpen,
  onToggle,
  disabled = false,
  badge,
  children,
}: AccordionItemProps) {
  return (
    <div className={`${styles.item} ${isOpen ? styles.itemOpen : ""} ${disabled ? styles.itemDisabled : ""}`}>
      <button
        className={styles.header}
        onClick={onToggle}
        disabled={disabled}
        aria-expanded={isOpen}
      >
        <svg
          className={`${styles.chevron} ${isOpen ? styles.chevronOpen : ""}`}
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M9 18l6-6-6-6" />
        </svg>
        <span className={styles.title}>{title}</span>
        {badge && <span className={styles.badge}>{badge}</span>}
      </button>
      <div
        className={`${styles.content} ${isOpen ? styles.contentOpen : ""}`}
        aria-hidden={!isOpen}
      >
        <div className={styles.contentInner}>{children}</div>
      </div>
    </div>
  );
}
