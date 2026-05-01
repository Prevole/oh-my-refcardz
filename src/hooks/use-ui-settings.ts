"use client";

import { useState, useEffect, useCallback } from "react";

export type ColorMode = "hexa" | "grid" | "category" | "normal";
export type BorderStyle = "full" | "left" | "right" | "both";
export type GradientDirection = "tl-br" | "tr-bl" | "l-r";

export interface ModernSettings {
  random: boolean;
  colorMode: ColorMode;
  border: BorderStyle;
  direction: GradientDirection;
}

export interface AccordionState {
  ui: boolean;
  keybindings: boolean;
}

export interface UISettings {
  modern: ModernSettings;
  accordion: AccordionState;
}

const STORAGE_KEY = "oh-my-refcardz:ui-settings";

const DEFAULT_SETTINGS: UISettings = {
  modern: {
    random: false,
    colorMode: "normal",
    border: "both",
    direction: "l-r",
  },
  accordion: {
    ui: true,
    keybindings: false,
  },
};

const COLOR_MODE_OPTIONS: ColorMode[] = ["hexa", "grid", "category", "normal"];
const RANDOM_COLOR_MODE_OPTIONS: ColorMode[] = ["hexa", "grid", "category", "normal"];
const BORDER_OPTIONS: BorderStyle[] = ["full", "left", "right", "both"];
const DIRECTION_OPTIONS: GradientDirection[] = ["tl-br", "tr-bl", "l-r"];

function getRandomModernSettings(): ModernSettings {
  const colorMode = RANDOM_COLOR_MODE_OPTIONS[Math.floor(Math.random() * RANDOM_COLOR_MODE_OPTIONS.length)];
  const border = BORDER_OPTIONS[Math.floor(Math.random() * BORDER_OPTIONS.length)];
  const direction = DIRECTION_OPTIONS[Math.floor(Math.random() * DIRECTION_OPTIONS.length)];
  return { random: true, colorMode, border, direction };
}

function loadSettings(): UISettings {
  if (typeof window === "undefined") {
    return DEFAULT_SETTINGS;
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as UISettings;
      // Merge with defaults to handle missing fields
      const merged = {
        ...DEFAULT_SETTINGS,
        ...parsed,
        modern: { ...DEFAULT_SETTINGS.modern, ...parsed.modern },
        accordion: { ...DEFAULT_SETTINGS.accordion, ...parsed.accordion },
      };
      // If random is enabled, randomize the settings on load
      if (merged.modern?.random) {
        return {
          ...merged,
          modern: getRandomModernSettings(),
        };
      }
      return merged;
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

  const setModernSettings = useCallback((modern: Partial<ModernSettings>) => {
    setSettingsState((prev) => {
      const newSettings = { ...prev, modern: { ...prev.modern, ...modern } };
      saveSettings(newSettings);
      return newSettings;
    });
  }, []);

  const toggleRandom = useCallback(() => {
    setSettingsState((prev) => {
      const newRandom = !prev.modern.random;
      const newSettings = newRandom
        ? { ...prev, modern: getRandomModernSettings() }
        : { ...prev, modern: { ...prev.modern, random: false } };
      saveSettings(newSettings);
      return newSettings;
    });
  }, []);

  const setColorMode = useCallback((colorMode: ColorMode) => {
    setModernSettings({ colorMode, random: false });
  }, [setModernSettings]);

  const setBorder = useCallback((border: BorderStyle) => {
    setModernSettings({ border, random: false });
  }, [setModernSettings]);

  const setDirection = useCallback((direction: GradientDirection) => {
    setModernSettings({ direction, random: false });
  }, [setModernSettings]);

  const toggleAccordion = useCallback((section: keyof AccordionState) => {
    setSettings({
      ...settings,
      accordion: {
        ...settings.accordion,
        [section]: !settings.accordion[section],
      },
    });
  }, [settings, setSettings]);

  const resetModern = useCallback(() => {
    setSettings({ ...settings, modern: DEFAULT_SETTINGS.modern });
  }, [settings, setSettings]);

  const resetAll = useCallback(() => {
    setSettings(DEFAULT_SETTINGS);
  }, [setSettings]);

  return {
    settings,
    isLoaded,
    setColorMode,
    toggleRandom,
    setBorder,
    setDirection,
    toggleAccordion,
    resetModern,
    resetAll,
  };
}
