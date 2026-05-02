"use client";

import { useMemo, useSyncExternalStore, type ReactNode, type CSSProperties } from "react";
import { useUISettings } from "@/hooks/use-ui-settings";
import { SELECTED_SHEET_ACCENT_KEY } from "@/lib/constants";

type Props = {
  /** The sheet's own color (from frontmatter) */
  sheetColor: string;
  /** The sheet's category color (colorFrom) */
  sheetColorFrom: string;
  children: ReactNode;
};

// Subscribe to session storage changes
function subscribe(callback: () => void): () => void {
  const handleStorageChange = (event: StorageEvent) => {
    if (event.key === SELECTED_SHEET_ACCENT_KEY || event.key === null) {
      callback();
    }
  };
  window.addEventListener("storage", handleStorageChange);
  return () => window.removeEventListener("storage", handleStorageChange);
}

function getSnapshot(): string | null {
  if (typeof window === "undefined") return null;
  return window.sessionStorage.getItem(SELECTED_SHEET_ACCENT_KEY);
}

function getServerSnapshot(): string | null {
  return null;
}

/**
 * SheetAccentProvider manages the dynamic accent color for cheatsheet pages.
 * 
 * It reads the accent color from session storage (set by home page navigation)
 * and recalculates the effective color based on the current colorMode setting.
 * 
 * Color modes:
 * - normal: uses the sheet's own color (sheetColor)
 * - category: uses the category color (sheetColorFrom)
 * - hexa/grid: uses the session storage color (from home navigation) or fallback to sheetColorFrom
 */
export function SheetAccentProvider({ sheetColor, sheetColorFrom, children }: Props) {
  const { settings } = useUISettings();
  const sessionAccentColor = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const accentColor = useMemo(() => {
    const colorMode = settings.modern.colorMode;

    switch (colorMode) {
      case "normal":
        return sheetColor;
      case "category":
        return sheetColorFrom;
      case "hexa":
      case "grid":
        // Use the color from session storage (set during navigation from home)
        // Fallback to category color if not available (e.g., direct URL access)
        return sessionAccentColor ?? sheetColorFrom;
      default:
        return sheetColor;
    }
  }, [settings.modern.colorMode, sheetColor, sheetColorFrom, sessionAccentColor]);

  const style: CSSProperties = {
    "--accent": accentColor,
    "--sheet-accent": accentColor,
  } as CSSProperties;

  return (
    <div style={style}>
      {children}
    </div>
  );
}
