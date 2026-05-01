"use client";

import { useState, useEffect, useCallback } from "react";

export type UIMode = "hex-gradient" | "grid-gradient" | "modern";
export type BorderStyle = "full" | "left" | "right" | "both";
export type GradientDirection = "tl-br" | "tr-bl" | "l-r";

export interface ModernSettings {
  random: boolean;
  border: BorderStyle;
  direction: GradientDirection;
}

export interface UISettings {
  mode: UIMode;
  modern: ModernSettings;
}

const STORAGE_KEY = "oh-my-refcardz:ui-settings";

const DEFAULT_SETTINGS: UISettings = {
  mode: "modern",
  modern: {
    random: false,
    border: "both",
    direction: "l-r",
  },
};

const BORDER_OPTIONS: BorderStyle[] = ["full", "left", "right", "both"];
const DIRECTION_OPTIONS: GradientDirection[] = ["tl-br", "tr-bl", "l-r"];

function getRandomModernSettings(): ModernSettings {
  const border = BORDER_OPTIONS[Math.floor(Math.random() * BORDER_OPTIONS.length)];
  const direction = DIRECTION_OPTIONS[Math.floor(Math.random() * DIRECTION_OPTIONS.length)];
  return { random: true, border, direction };
}

function loadSettings(): UISettings {
  if (typeof window === "undefined") {
    return DEFAULT_SETTINGS;
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as UISettings;
      // If random is enabled, randomize the settings on load
      if (parsed.modern?.random) {
        return {
          ...parsed,
          modern: getRandomModernSettings(),
        };
      }
      return parsed;
    }
  } catch {
    // Ignore parse errors
  }

  return DEFAULT_SETTINGS;
}

function saveSettings(settings: UISettings): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Ignore storage errors
  }
}

export function useUISettings() {
  const [settings, setSettingsState] = useState<UISettings>(DEFAULT_SETTINGS);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load settings on mount
  useEffect(() => {
    const loaded = loadSettings();
    setSettingsState(loaded);
    setIsLoaded(true);
  }, []);

  const setSettings = useCallback((newSettings: UISettings) => {
    setSettingsState(newSettings);
    saveSettings(newSettings);
  }, []);

  const setMode = useCallback((mode: UIMode) => {
    setSettings({ ...settings, mode });
  }, [settings, setSettings]);

  const setModernSettings = useCallback((modern: Partial<ModernSettings>) => {
    const newModern = { ...settings.modern, ...modern };
    setSettings({ ...settings, modern: newModern });
  }, [settings, setSettings]);

  const toggleRandom = useCallback(() => {
    const newRandom = !settings.modern.random;
    if (newRandom) {
      // When enabling random, immediately randomize
      setSettings({
        ...settings,
        modern: getRandomModernSettings(),
      });
    } else {
      setSettings({
        ...settings,
        modern: { ...settings.modern, random: false },
      });
    }
  }, [settings, setSettings]);

  const setBorder = useCallback((border: BorderStyle) => {
    setModernSettings({ border, random: false });
  }, [setModernSettings]);

  const setDirection = useCallback((direction: GradientDirection) => {
    setModernSettings({ direction, random: false });
  }, [setModernSettings]);

  return {
    settings,
    isLoaded,
    setMode,
    setModernSettings,
    toggleRandom,
    setBorder,
    setDirection,
  };
}
