"use client";

import styles from "./cheatsheet-rendering.module.css";

type ItemActionsProps = {
  hasExample: boolean;
};

export function ItemActions({ hasExample }: ItemActionsProps) {
  if (!hasExample) return null;

  return (
    <div className={styles.itemActions} data-item-actions>
      <button
        type="button"
        className={styles.itemInfoButton}
        aria-label="Details"
        title="Details"
        data-show-details-button
      >
        i
      </button>
    </div>
  );
}
