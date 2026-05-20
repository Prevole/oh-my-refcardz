"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  ColorMode,
  BorderStyle,
  GradientDirection,
  UISettings,
  SettingsTopTab,
} from "@/hooks/use-ui-settings";
import { useScopedKeyboardHandler } from "@/hooks/use-keyboard-context";
import { Tabs } from "./tabs";
import { KeybindingEditor } from "./keybinding-editor";
import styles from "./settings-panel.module.css";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  settings: UISettings;
  onSetColorMode: (colorMode: ColorMode) => void;
  onToggleRandom: () => void;
  onSetBorder: (border: BorderStyle) => void;
  onSetDirection: (direction: GradientDirection) => void;
  onSetActivePanelTab: (tab: SettingsTopTab) => void;
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

const TOP_TABS: { id: SettingsTopTab; label: string }[] = [
  { id: "ui", label: "UI" },
  { id: "keybindings", label: "Keybindings" },
];

export function SettingsPanel({
  isOpen,
  onClose,
  settings,
  onSetColorMode,
  onToggleRandom,
  onSetBorder,
  onSetDirection,
  onSetActivePanelTab,
  onResetModern,
}: Props) {
  const CLOSE_ANIMATION_MS = 220;
  const panelRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);
  const closeTimeoutRef = useRef<number | null>(null);
  const [isClosing, setIsClosing] = useState(false);

  const activeTab = settings.panelTabs.active;

  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current !== null) {
        window.clearTimeout(closeTimeoutRef.current);
      }
    };
  }, []);

  const requestClose = useCallback(() => {
    if (isClosing) {
      return;
    }

    setIsClosing(true);
    closeTimeoutRef.current = window.setTimeout(() => {
      setIsClosing(false);
      closeTimeoutRef.current = null;
      onClose();
    }, CLOSE_ANIMATION_MS);
  }, [isClosing, onClose]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        requestClose();
      }
    },
    [requestClose]
  );

  useScopedKeyboardHandler("settings", handleKeyDown, [handleKeyDown]);

  useEffect(() => {
    if (!isOpen) return;

    const panel = panelRef.current;
    if (!panel) return;

    previousActiveElement.current = document.activeElement as HTMLElement;
    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;

    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    const focusableElements = panel.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const firstElement = focusableElements[0];
    if (firstElement) {
      requestAnimationFrame(() => firstElement.focus());
    }

    const handleTabKey = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;

      const focusable = panel.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );

      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey) {
        if (document.activeElement === first) {
          event.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener("keydown", handleTabKey);

    return () => {
      document.removeEventListener("keydown", handleTabKey);
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
      previousActiveElement.current?.focus();
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("[data-recording-overlay-root]")) {
        return;
      }

      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        requestClose();
      }
    };

    const timeoutId = setTimeout(() => {
      document.addEventListener("click", handleClickOutside);
    }, 0);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener("click", handleClickOutside);
    };
  }, [isOpen, requestClose]);

  if (!isOpen) return null;

  const showDirectionOptions = settings.modern.border !== "full";

  return (
    <div className={styles.overlay} data-closing={isClosing ? "true" : undefined} data-testid="settings-overlay">
      <div ref={panelRef} className={styles.panel} data-closing={isClosing ? "true" : undefined} data-testid="settings-panel">
        <div className={styles.header}>
          <h2 className={styles.title}>Settings</h2>
          <button onClick={requestClose} className={styles.close} aria-label="Close" data-testid="settings-close">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className={styles.tabsBar}>
          <Tabs
            tabs={TOP_TABS}
            activeTab={activeTab}
            onChange={(id) => onSetActivePanelTab(id as SettingsTopTab)}
          />
        </div>

        <div className={styles.content}>
          {activeTab === "ui" && (
            <div data-testid="settings-tab-ui">
              <section className={styles.tabSection}>
                <header className={styles.tabSectionHeader}>
                  <h3 className={styles.tabSectionTitle}>Appearance</h3>
                  <p className={styles.tabSectionLead}>
                    Control how cheatsheet cards look on the home grid. Changes apply instantly and are saved automatically.
                  </p>
                </header>

                <div className={styles.section}>
                  <div className={styles.row}>
                    <label className={styles.toggle}>
                      <input
                        type="checkbox"
                        checked={settings.modern.random}
                        onChange={onToggleRandom}
                      />
                      <span className={styles.toggleLabel}>Random on refresh</span>
                    </label>
                    <span className={styles.fieldHelp}>
                      Picks a fresh combination of color, border and orientation each time the page loads.
                    </span>
                  </div>

                  <div className={styles.field}>
                    <div className={styles.fieldHeader}>
                      <span className={styles.label}>Color mode</span>
                      <span className={styles.fieldHelp}>How card colors are derived.</span>
                    </div>
                    <div className={`${styles.buttonGroup} ${styles.buttonGroupFull}`}>
                      {COLOR_MODE_OPTIONS.map((option) => (
                        <button
                          key={option.value}
                          onClick={() => onSetColorMode(option.value)}
                          className={`${styles.groupButton} ${styles.groupButtonFlex} ${settings.modern.colorMode === option.value ? styles.groupButtonActive : ""}`}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className={styles.field}>
                    <div className={styles.fieldHeader}>
                      <span className={styles.label}>Border style</span>
                      <span className={styles.fieldHelp}>Which edges of each card carry a colored stroke.</span>
                    </div>
                    <div className={`${styles.buttonGroup} ${styles.buttonGroupFull}`}>
                      {BORDER_OPTIONS.map((option) => (
                        <button
                          key={option.value}
                          onClick={() => onSetBorder(option.value)}
                          className={`${styles.groupButton} ${styles.groupButtonFlex} ${settings.modern.border === option.value ? styles.groupButtonActive : ""}`}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className={`${styles.field} ${!showDirectionOptions ? styles.fieldDisabled : ""}`}>
                    <div className={styles.fieldHeader}>
                      <span className={styles.label}>Orientation from</span>
                      <span className={styles.fieldHelp}>
                        {showDirectionOptions
                          ? "Origin used by the color gradient."
                          : "Available when the border style is not Full."}
                      </span>
                    </div>
                    <div className={`${styles.buttonGroup} ${styles.buttonGroupFull}`}>
                      {DIRECTION_OPTIONS.map((option) => (
                        <button
                          key={option.value}
                          onClick={() => showDirectionOptions && onSetDirection(option.value)}
                          disabled={!showDirectionOptions}
                          className={`${styles.groupButton} ${styles.groupButtonFlex} ${styles.groupButtonWithIcon} ${settings.modern.direction === option.value && showDirectionOptions ? styles.groupButtonActive : ""}`}
                        >
                          <span className={styles.groupButtonIcon} aria-hidden="true">{option.icon}</span>
                          <span>{option.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className={styles.sectionReset}>
                    <button className={styles.resetButton} onClick={onResetModern}>
                      Reset UI settings
                    </button>
                  </div>
                </div>
              </section>
            </div>
          )}

          {activeTab === "keybindings" && (
            <div data-testid="settings-tab-keybindings">
              <section className={styles.tabSection}>
                <header className={styles.tabSectionHeader}>
                  <h3 className={styles.tabSectionTitle}>Keybindings</h3>
                  <p className={styles.tabSectionLead}>
                    Customize the keyboard shortcuts used across the app. Click a keybinding to record a new one. Press <kbd>Shift</kbd>+<kbd>Click</kbd> on a secondary binding to promote it to primary.
                  </p>
                </header>
                <KeybindingEditor />
              </section>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
