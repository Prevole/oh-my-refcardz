"use client";

import { createContext, useContext, useCallback, useSyncExternalStore, type ReactNode } from "react";

export type ColorMode = "hexa" | "grid" | "category" | "normal";
export type BorderStyle = "full" | "left" | "right" | "both";
export type GradientDirection = "tl-br" | "tr-bl" | "l-r";

interface ModernSettings {
  random: boolean;
  colorMode: ColorMode;
  border: BorderStyle;
  direction: GradientDirection;
}

export type SettingsTopTab = "ui" | "keybindings";
export type KeybindingsSubTab = "general" | "home" | "cheatsheet";
export type KeybindingsSubSubTab = "general" | "layout" | "developer";

interface PanelTabsState {
  active: SettingsTopTab;
  keybindingsSub: KeybindingsSubTab;
  keybindingsSubSub: KeybindingsSubSubTab;
}

export interface UISettings {
  modern: ModernSettings;
  panelTabs: PanelTabsState;
}

const STORAGE_KEY = "oh-my-refcardz:ui-settings";

export const DEFAULT_MODERN_SETTINGS: ModernSettings = {
  random: false,
  colorMode: "normal",
  border: "both",
  direction: "l-r",
};

const DEFAULT_SETTINGS: UISettings = {
  modern: DEFAULT_MODERN_SETTINGS,
  panelTabs: {
    active: "ui",
    keybindingsSub: "general",
    keybindingsSubSub: "general",
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

let hasRandomizedThisSession = false;
let cachedSettings: UISettings | null = null;

function migratePanelTabs(raw: unknown): PanelTabsState {
  const base = DEFAULT_SETTINGS.panelTabs;
  if (!raw || typeof raw !== "object") return base;
  const partial = raw as Partial<PanelTabsState> & { keybindingsSub?: string; keybindingsSubSub?: string };

  let sub: KeybindingsSubTab = base.keybindingsSub;
  let subSub: KeybindingsSubSubTab = base.keybindingsSubSub;

  const legacySub = partial.keybindingsSub;
  if (legacySub === "general" || legacySub === "home" || legacySub === "cheatsheet") {
    sub = legacySub;
  } else if (legacySub === "global") {
    sub = "general";
  } else if (legacySub === "layout") {
    sub = "cheatsheet";
    subSub = "layout";
  } else if (legacySub === "developer") {
    sub = "cheatsheet";
    subSub = "developer";
  }

  const legacySubSub = partial.keybindingsSubSub;
  if (legacySubSub === "general" || legacySubSub === "layout" || legacySubSub === "developer") {
    subSub = legacySubSub;
  }

  const active = partial.active === "keybindings" ? "keybindings" : "ui";

  return { active, keybindingsSub: sub, keybindingsSubSub: subSub };
}

function loadSettings(): UISettings {
  if (typeof window === "undefined") {
    return DEFAULT_SETTINGS;
  }

  if (cachedSettings !== null) {
    return cachedSettings;
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as Partial<UISettings>;
      const merged: UISettings = {
        modern: { ...DEFAULT_SETTINGS.modern, ...(parsed.modern ?? {}) },
        panelTabs: migratePanelTabs(parsed.panelTabs),
      };
      if (merged.modern.random && !hasRandomizedThisSession) {
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
    window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY }));
  } catch {
  }
}

function subscribe(callback: () => void): () => void {
  const handleStorageChange = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY || event.key === null) {
      cachedSettings = null;
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

interface UISettingsContextValue {
  settings: UISettings;
  isLoaded: boolean;
  setColorMode: (colorMode: ColorMode) => void;
  toggleRandom: () => void;
  setBorder: (border: BorderStyle) => void;
  setDirection: (direction: GradientDirection) => void;
  setActivePanelTab: (tab: SettingsTopTab) => void;
  setActiveKeybindingsSubTab: (tab: KeybindingsSubTab) => void;
  setActiveKeybindingsSubSubTab: (tab: KeybindingsSubSubTab) => void;
  resetModern: () => void;
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

  const setActivePanelTab = useCallback((tab: SettingsTopTab) => {
    const current = loadSettings();
    const newSettings: UISettings = {
      ...current,
      panelTabs: { ...current.panelTabs, active: tab },
    };
    saveSettings(newSettings);
  }, []);

  const setActiveKeybindingsSubTab = useCallback((tab: KeybindingsSubTab) => {
    const current = loadSettings();
    const newSettings: UISettings = {
      ...current,
      panelTabs: { ...current.panelTabs, keybindingsSub: tab },
    };
    saveSettings(newSettings);
  }, []);

  const setActiveKeybindingsSubSubTab = useCallback((tab: KeybindingsSubSubTab) => {
    const current = loadSettings();
    const newSettings: UISettings = {
      ...current,
      panelTabs: { ...current.panelTabs, keybindingsSubSub: tab },
    };
    saveSettings(newSettings);
  }, []);

  const resetModern = useCallback(() => {
    const current = loadSettings();
    const newSettings = { ...current, modern: DEFAULT_SETTINGS.modern };
    saveSettings(newSettings);
  }, []);

  const value: UISettingsContextValue = {
    settings,
    isLoaded: true, // Always loaded with useSyncExternalStore
    setColorMode,
    toggleRandom,
    setBorder,
    setDirection,
    setActivePanelTab,
    setActiveKeybindingsSubTab,
    setActiveKeybindingsSubSubTab,
    resetModern,
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
