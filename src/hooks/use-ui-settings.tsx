"use client";

import { createContext, useContext, useCallback, useSyncExternalStore, type ReactNode } from "react";

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

const RANDOM_COLOR_MODE_OPTIONS: ColorMode[] = ["hexa", "grid", "category", "normal"];
const BORDER_OPTIONS: BorderStyle[] = ["full", "left", "right", "both"];
const DIRECTION_OPTIONS: GradientDirection[] = ["tl-br", "tr-bl", "l-r"];

function getRandomModernSettings(): ModernSettings {
  const colorMode = RANDOM_COLOR_MODE_OPTIONS[Math.floor(Math.random() * RANDOM_COLOR_MODE_OPTIONS.length)];
  const border = BORDER_OPTIONS[Math.floor(Math.random() * BORDER_OPTIONS.length)];
  const direction = DIRECTION_OPTIONS[Math.floor(Math.random() * DIRECTION_OPTIONS.length)];
  return { random: true, colorMode, border, direction };
}

// In-memory cache to track if we've already randomized
let hasRandomizedThisSession = false;
let cachedSettings: UISettings | null = null;

function loadSettings(): UISettings {
  if (typeof window === "undefined") {
    return DEFAULT_SETTINGS;
  }

  // Return cached settings if we've already loaded them
  if (cachedSettings !== null) {
    return cachedSettings;
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
      // If random is enabled and we haven't randomized this session, randomize
      if (merged.modern?.random && !hasRandomizedThisSession) {
        hasRandomizedThisSession = true;
        cachedSettings = {
          ...merged,
          modern: getRandomModernSettings(),
        };
        return cachedSettings;
      }
      cachedSettings = merged;
      return merged;
    }
  } catch {
    // Ignore parse errors
  }

  cachedSettings = DEFAULT_SETTINGS;
  return DEFAULT_SETTINGS;
}

function saveSettings(settings: UISettings): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    cachedSettings = settings;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    // Dispatch storage event to notify other subscribers
    window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY }));
  } catch {
    // Ignore storage errors
  }
}

// Subscribe to storage changes
function subscribe(callback: () => void): () => void {
  const handleStorageChange = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY || event.key === null) {
      cachedSettings = null; // Invalidate cache
      callback();
    }
  };
  window.addEventListener("storage", handleStorageChange);
  return () => window.removeEventListener("storage", handleStorageChange);
}

function getSnapshot(): UISettings {
  return loadSettings();
}

function getServerSnapshot(): UISettings {
  return DEFAULT_SETTINGS;
}

// Context type
interface UISettingsContextValue {
  settings: UISettings;
  isLoaded: boolean;
  setColorMode: (colorMode: ColorMode) => void;
  toggleRandom: () => void;
  setBorder: (border: BorderStyle) => void;
  setDirection: (direction: GradientDirection) => void;
  toggleAccordion: (section: keyof AccordionState) => void;
  resetModern: () => void;
  resetAll: () => void;
}

const UISettingsContext = createContext<UISettingsContextValue | null>(null);
const Provider = UISettingsContext.Provider;

type ProviderProps = {
  children: ReactNode;
};

export function UISettingsProvider({ children }: ProviderProps) {
  const settings = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setModernSettings = useCallback((modern: Partial<ModernSettings>) => {
    const current = loadSettings();
    const newSettings = { ...current, modern: { ...current.modern, ...modern } };
    saveSettings(newSettings);
  }, []);

  const toggleRandom = useCallback(() => {
    const current = loadSettings();
    const newRandom = !current.modern.random;
    const newSettings = newRandom
      ? { ...current, modern: getRandomModernSettings() }
      : { ...current, modern: { ...current.modern, random: false } };
    saveSettings(newSettings);
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
    const current = loadSettings();
    const newSettings = {
      ...current,
      accordion: {
        ...current.accordion,
        [section]: !current.accordion[section],
      },
    };
    saveSettings(newSettings);
  }, []);

  const resetModern = useCallback(() => {
    const current = loadSettings();
    const newSettings = { ...current, modern: DEFAULT_SETTINGS.modern };
    saveSettings(newSettings);
  }, []);

  const resetAll = useCallback(() => {
    saveSettings(DEFAULT_SETTINGS);
  }, []);

  const value: UISettingsContextValue = {
    settings,
    isLoaded: true, // Always loaded with useSyncExternalStore
    setColorMode,
    toggleRandom,
    setBorder,
    setDirection,
    toggleAccordion,
    resetModern,
    resetAll,
  };

  return (
    <Provider value={value}>
      {children}
    </Provider>
  );
}

export function useUISettings(): UISettingsContextValue {
  const context = useContext(UISettingsContext);
  if (!context) {
    throw new Error("useUISettings must be used within a UISettingsProvider");
  }
  return context;
}
