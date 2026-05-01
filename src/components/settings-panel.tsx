"use client";

import { useEffect, useRef } from "react";
import type { UIMode, BorderStyle, GradientDirection, UISettings, AccordionState } from "@/hooks/use-ui-settings";
import { AccordionItem } from "./accordion";
import { Tabs } from "./tabs";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  settings: UISettings;
  onSetMode: (mode: UIMode) => void;
  onToggleRandom: () => void;
  onSetBorder: (border: BorderStyle) => void;
  onSetDirection: (direction: GradientDirection) => void;
  onToggleAccordion: (section: keyof AccordionState) => void;
  onResetModern: () => void;
  onResetAll: () => void;
};

const MODE_TABS = [
  { id: "hex-gradient", label: "Hex", disabled: true },
  { id: "grid-gradient", label: "Grid", disabled: true },
  { id: "modern", label: "Modern", disabled: false },
];

const BORDER_OPTIONS: { value: BorderStyle; label: string }[] = [
  { value: "full", label: "F" },
  { value: "left", label: "L" },
  { value: "right", label: "R" },
  { value: "both", label: "LR" },
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

type DirectionOption = { value: GradientDirection; icon: React.ReactNode };

const DIRECTION_OPTIONS: DirectionOption[] = [
  { value: "tl-br", icon: <ArrowTLBR /> },
  { value: "tr-bl", icon: <ArrowTRBL /> },
  { value: "l-r", icon: <ArrowLR /> },
];

export function SettingsPanel({
  isOpen,
  onClose,
  settings,
  onSetMode,
  onToggleRandom,
  onSetBorder,
  onSetDirection,
  onToggleAccordion,
  onResetModern,
  onResetAll,
}: Props) {
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
            {/* Mode Tabs */}
            <div className="settings-section">
              <Tabs
                tabs={MODE_TABS}
                activeTab={settings.mode}
                onChange={(id) => onSetMode(id as UIMode)}
              />
            </div>

            {/* Modern Configuration */}
            {settings.mode === "modern" && (
              <div className="settings-section">
                <h4 className="settings-section-title">Modern Configuration</h4>

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

                {/* Border, Orientation & Reset */}
                <div className="settings-grid">
                  <div className="settings-grid-item">
                    <span className="settings-label">Border:</span>
                    <div className="settings-button-group">
                      {BORDER_OPTIONS.map((option) => (
                        <button
                          key={option.value}
                          onClick={() => onSetBorder(option.value)}
                          className={`settings-group-btn settings-group-btn-square ${settings.modern.border === option.value ? "settings-group-btn-active" : ""}`}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className={`settings-grid-item ${!showDirectionOptions ? "settings-grid-item-disabled" : ""}`}>
                    <span className="settings-label">Orientation:</span>
                    <div className="settings-button-group">
                      {DIRECTION_OPTIONS.map((option) => (
                        <button
                          key={option.value}
                          onClick={() => showDirectionOptions && onSetDirection(option.value)}
                          disabled={!showDirectionOptions}
                          className={`settings-group-btn settings-group-btn-square ${settings.modern.direction === option.value && showDirectionOptions ? "settings-group-btn-active" : ""}`}
                        >
                          {option.icon}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="settings-grid-item">
                    <span className="settings-label">Reset:</span>
                    <button onClick={onResetModern} className="settings-reset-button settings-reset-small">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                        <path d="M3 3v5h5" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </AccordionItem>

          {/* Keybindings Section */}
          <AccordionItem
            title="Keybindings"
            isOpen={settings.accordion.keybindings}
            onToggle={() => onToggleAccordion("keybindings")}
            disabled
            badge="Soon"
          >
            <div className="settings-section">
              <p className="settings-placeholder">Keybindings configuration coming soon.</p>
            </div>
          </AccordionItem>
        </div>

        {/* Footer */}
        <div className="settings-panel-footer">
          <button onClick={onResetAll} className="settings-reset-button settings-reset-all">
            Reset All to Defaults
          </button>
        </div>
      </div>
    </div>
  );
}
