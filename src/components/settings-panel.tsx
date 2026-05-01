"use client";

import { useCallback, useEffect, useRef } from "react";
import type { ColorMode, BorderStyle, GradientDirection, UISettings, AccordionState } from "@/hooks/use-ui-settings";
import { useScopedKeyboardHandler } from "@/hooks/use-keyboard-context";
import { AccordionItem } from "./accordion";
import { KeybindingEditor } from "./keybinding-editor";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  settings: UISettings;
  onSetColorMode: (colorMode: ColorMode) => void;
  onToggleRandom: () => void;
  onSetBorder: (border: BorderStyle) => void;
  onSetDirection: (direction: GradientDirection) => void;
  onToggleAccordion: (section: keyof AccordionState) => void;
  onResetModern: () => void;
};

const COLOR_MODE_OPTIONS: { value: ColorMode; label: string }[] = [
  { value: "hexa", label: "Hexa" },
  { value: "grid", label: "Grid" },
  { value: "category", label: "Category" },
  { value: "normal", label: "Normal" },
];

const BORDER_OPTIONS: { value: BorderStyle; label: string }[] = [
  { value: "full", label: "Full" },
  { value: "left", label: "Left" },
  { value: "right", label: "Right" },
  { value: "both", label: "Both sides" },
];

const ArrowTLBR = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M7 7l10 10M17 7v10H7" />
  </svg>
);

const ArrowTRBL = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 7L7 17M7 7v10h10" />
  </svg>
);

const ArrowLR = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);

type DirectionOption = { value: GradientDirection; icon: React.ReactNode; label: string };

const DIRECTION_OPTIONS: DirectionOption[] = [
  { value: "tl-br", icon: <ArrowTLBR />, label: "Top Left" },
  { value: "tr-bl", icon: <ArrowTRBL />, label: "Top Right" },
  { value: "l-r", icon: <ArrowLR />, label: "Left" },
];

export function SettingsPanel({
  isOpen,
  onClose,
  settings,
  onSetColorMode,
  onToggleRandom,
  onSetBorder,
  onSetDirection,
  onToggleAccordion,
  onResetModern,
}: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  // Handle Escape key to close panel (only when settings scope is active)
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    },
    [onClose]
  );

  useScopedKeyboardHandler("settings", handleKeyDown, [handleKeyDown]);

  // Focus trap and focus management
  useEffect(() => {
    if (!isOpen) return;

    const panel = panelRef.current;
    if (!panel) return;

    // Store currently focused element to restore later
    previousActiveElement.current = document.activeElement as HTMLElement;

    // Focus the first focusable element in the panel
    const focusableElements = panel.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const firstElement = focusableElements[0];
    if (firstElement) {
      // Small delay to ensure the panel is rendered
      requestAnimationFrame(() => firstElement.focus());
    }

    // Handle Tab key for focus trap
    const handleTabKey = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;

      const focusable = panel.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );

      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey) {
        // Shift+Tab: if on first element, wrap to last
        if (document.activeElement === first) {
          event.preventDefault();
          last.focus();
        }
      } else {
        // Tab: if on last element, wrap to first
        if (document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener("keydown", handleTabKey);

    return () => {
      document.removeEventListener("keydown", handleTabKey);
      // Restore focus when panel closes
      previousActiveElement.current?.focus();
    };
  }, [isOpen]);

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const timeoutId = setTimeout(() => {
      document.addEventListener("click", handleClickOutside);
    }, 0);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener("click", handleClickOutside);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const showDirectionOptions = settings.modern.border !== "full";

  return (
    <div className="settings-panel-overlay">
      <div ref={panelRef} className="settings-panel">
        {/* Header */}
        <div className="settings-panel-header">
          <h2 className="settings-panel-title">Settings</h2>
          <button onClick={onClose} className="settings-panel-close" aria-label="Close">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Accordion Content */}
        <div className="settings-panel-content">
          {/* UI Section */}
          <AccordionItem
            title="UI"
            isOpen={settings.accordion.ui}
            onToggle={() => onToggleAccordion("ui")}
          >
            <div className="settings-section">
              {/* Random Toggle */}
              <div className="settings-row">
                <label className="settings-toggle">
                  <input
                    type="checkbox"
                    checked={settings.modern.random}
                    onChange={onToggleRandom}
                  />
                  <span className="settings-toggle-label">Random on refresh</span>
                </label>
              </div>

              {/* Color Mode */}
              <div className="settings-grid">
                <div className="settings-grid-item settings-grid-item-full">
                  <span className="settings-label">Color mode:</span>
                  <div className="settings-button-group settings-button-group-full">
                    {COLOR_MODE_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        onClick={() => onSetColorMode(option.value)}
                        className={`settings-group-btn settings-group-btn-flex ${settings.modern.colorMode === option.value ? "settings-group-btn-active" : ""}`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Border Style */}
              <div className="settings-grid">
                <div className="settings-grid-item settings-grid-item-full">
                  <span className="settings-label">Border style:</span>
                  <div className="settings-button-group settings-button-group-full">
                    {BORDER_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        onClick={() => onSetBorder(option.value)}
                        className={`settings-group-btn settings-group-btn-flex ${settings.modern.border === option.value ? "settings-group-btn-active" : ""}`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>

              </div>

              {/* Orientation */}
              <div className="settings-grid">
                <div className={`settings-grid-item settings-grid-item-full ${!showDirectionOptions ? "settings-grid-item-disabled" : ""}`}>
                  <span className="settings-label">Orientation from:</span>
                  <div className="settings-button-group settings-button-group-full">
                    {DIRECTION_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        onClick={() => showDirectionOptions && onSetDirection(option.value)}
                        disabled={!showDirectionOptions}
                        className={`settings-group-btn settings-group-btn-flex settings-group-btn-with-icon ${settings.modern.direction === option.value && showDirectionOptions ? "settings-group-btn-active" : ""}`}
                      >
                        <span className="settings-group-btn-icon" aria-hidden="true">{option.icon}</span>
                        <span>{option.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="settings-section-reset">
                <button className="keybinding-reset-all-btn" onClick={onResetModern}>
                  Reset UI settings
                </button>
              </div>
            </div>
          </AccordionItem>

          {/* Keybindings Section */}
          <AccordionItem
            title="Keybindings"
            isOpen={settings.accordion.keybindings}
            onToggle={() => onToggleAccordion("keybindings")}
          >
            <KeybindingEditor />
          </AccordionItem>
        </div>
      </div>
    </div>
  );
}
