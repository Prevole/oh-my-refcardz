"use client";

import { useEffect, useRef } from "react";
import type { UIMode, BorderStyle, GradientDirection, UISettings } from "@/hooks/use-ui-settings";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  settings: UISettings;
  onSetMode: (mode: UIMode) => void;
  onToggleRandom: () => void;
  onSetBorder: (border: BorderStyle) => void;
  onSetDirection: (direction: GradientDirection) => void;
};

const MODE_OPTIONS: { value: UIMode; label: string; disabled: boolean }[] = [
  { value: "hex-gradient", label: "Gradient per hexagon", disabled: true },
  { value: "grid-gradient", label: "Gradient per grid", disabled: true },
  { value: "modern", label: "Modern", disabled: false },
];

const BORDER_OPTIONS: { value: BorderStyle; label: string }[] = [
  { value: "full", label: "Full" },
  { value: "left", label: "Angle L" },
  { value: "right", label: "Angle R" },
  { value: "both", label: "Angle LR" },
];

const DIRECTION_OPTIONS: { value: GradientDirection; label: string }[] = [
  { value: "tl-br", label: "\u2198 TL" },
  { value: "tr-bl", label: "\u2199 TR" },
  { value: "l-r", label: "\u2192 LR" },
];

export function UISettingsModal({
  isOpen,
  onClose,
  settings,
  onSetMode,
  onToggleRandom,
  onSetBorder,
  onSetDirection,
}: Props) {
  const modalRef = useRef<HTMLDivElement>(null);

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
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
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
    <div className="ui-settings-overlay">
      <div ref={modalRef} className="ui-settings-modal">
        <div className="ui-settings-header">
          <h2 className="ui-settings-title">UI Settings</h2>
          <button onClick={onClose} className="ui-settings-close" aria-label="Close">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="ui-settings-content">
          {/* Mode Selection */}
          <section className="ui-settings-section">
            <h3 className="ui-settings-section-title">Mode</h3>
            <div className="ui-settings-radio-group">
              {MODE_OPTIONS.map((option) => (
                <label
                  key={option.value}
                  className={`ui-settings-radio ${option.disabled ? "ui-settings-radio-disabled" : ""}`}
                >
                  <input
                    type="radio"
                    name="mode"
                    value={option.value}
                    checked={settings.mode === option.value}
                    onChange={() => onSetMode(option.value)}
                    disabled={option.disabled}
                  />
                  <span className="ui-settings-radio-label">{option.label}</span>
                  {option.disabled && <span className="ui-settings-badge">Soon</span>}
                </label>
              ))}
            </div>
          </section>

          {/* Modern Settings */}
          {settings.mode === "modern" && (
            <section className="ui-settings-section">
              <h3 className="ui-settings-section-title">Modern Configuration</h3>

              {/* Random Toggle */}
              <div className="ui-settings-row">
                <label className="ui-settings-toggle">
                  <input
                    type="checkbox"
                    checked={settings.modern.random}
                    onChange={onToggleRandom}
                  />
                  <span className="ui-settings-toggle-slider" />
                  <span className="ui-settings-toggle-label">Random on refresh</span>
                </label>
              </div>

              {/* Border Selection */}
              <div className="ui-settings-row">
                <span className="ui-settings-label">Border:</span>
                <div className="ui-settings-button-group">
                  {BORDER_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => onSetBorder(option.value)}
                      className={`ui-settings-button ${settings.modern.border === option.value ? "ui-settings-button-active" : ""}`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Direction Selection */}
              {showDirectionOptions && (
                <div className="ui-settings-row">
                  <span className="ui-settings-label">Direction:</span>
                  <div className="ui-settings-button-group">
                    {DIRECTION_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        onClick={() => onSetDirection(option.value)}
                        className={`ui-settings-button ${settings.modern.direction === option.value ? "ui-settings-button-active" : ""}`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
