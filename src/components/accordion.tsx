"use client";

import { type ReactNode } from "react";

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
    <div className={`accordion-item ${disabled ? "accordion-item-disabled" : ""}`}>
      <button
        className="accordion-header"
        onClick={onToggle}
        disabled={disabled}
        aria-expanded={isOpen}
      >
        <svg
          className={`accordion-chevron ${isOpen ? "accordion-chevron-open" : ""}`}
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
        <span className="accordion-title">{title}</span>
        {badge && <span className="accordion-badge">{badge}</span>}
      </button>
      <div
        className={`accordion-content ${isOpen ? "accordion-content-open" : ""}`}
        aria-hidden={!isOpen}
      >
        <div className="accordion-content-inner">{children}</div>
      </div>
    </div>
  );
}
