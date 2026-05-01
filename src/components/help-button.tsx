"use client";

import styles from "./floating-action-button.module.css";

type Props = {
  onClick: () => void;
};

export function HelpButton({ onClick }: Props) {
  return (
    <button
      onClick={onClick}
      className={`${styles.button} ${styles.help}`}
      aria-label="Help"
      title="Help (?)"
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="10" />
        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
        <path d="M12 17h.01" />
      </svg>
    </button>
  );
}
