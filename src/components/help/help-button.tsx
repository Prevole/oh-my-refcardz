"use client";

import floatingActionStyles from "@/components/settings/floating-action-button.module.css";

type Props = {
  onClick: () => void;
};

export function HelpButton({ onClick }: Props) {
  return (
    <button
      onClick={onClick}
      className={`${floatingActionStyles.button} ${floatingActionStyles.help}`}
      aria-label="Help"
      title="Help (?)"
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
        <path d="M12 17h.01" />
      </svg>
    </button>
  );
}
