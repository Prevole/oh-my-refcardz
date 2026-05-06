"use client";

import styles from "./cheatsheet-rendering.module.css";

type ItemActionsProps = {
  hasExample: boolean;
  onShowExample: () => void;
};

export function ItemActions({ hasExample, onShowExample }: ItemActionsProps) {
  if (!hasExample) return null;

  function handleShowExample(e: React.MouseEvent) {
    e.stopPropagation();
    onShowExample();
  }

  return (
    <div className={styles.itemActions} data-item-actions>
      <button
        type="button"
        className={styles.itemInfoButton}
        aria-label="Details"
        title="Details"
        onClick={handleShowExample}
      >
        i
      </button>
    </div>
  );
}
