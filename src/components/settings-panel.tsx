"use client";

import { useEffect, useRef } from "react";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onOpenUI: () => void;
};

export function SettingsPanel({ isOpen, onClose, onOpenUI }: Props) {
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    // Delay to avoid closing immediately on the same click that opened it
    const timeoutId = setTimeout(() => {
      document.addEventListener("click", handleClickOutside);
    }, 0);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener("click", handleClickOutside);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="settings-panel-overlay">
      <div ref={panelRef} className="settings-panel">
        <div className="settings-panel-header">
          <h2 className="settings-panel-title">Settings</h2>
          <button onClick={onClose} className="settings-panel-close" aria-label="Close">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <nav className="settings-panel-nav">
          <button
            onClick={() => {
              onOpenUI();
              onClose();
            }}
            className="settings-panel-item"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="7" height="7" />
              <rect x="14" y="3" width="7" height="7" />
              <rect x="14" y="14" width="7" height="7" />
              <rect x="3" y="14" width="7" height="7" />
            </svg>
            <span>UI</span>
          </button>
          <button className="settings-panel-item settings-panel-item-disabled" disabled>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="2" y="4" width="20" height="16" rx="2" />
              <path d="M6 8h.01M10 8h.01M14 8h.01" />
            </svg>
            <span>Keybindings</span>
            <span className="settings-panel-badge">Soon</span>
          </button>
        </nav>
      </div>
    </div>
  );
}
