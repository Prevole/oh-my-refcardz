"use client";

import { useMemo, type ReactNode, type CSSProperties } from "react";
import { useUISettings } from "@/hooks/use-ui-settings";
import { useSelectedSheetAccent } from "@/hooks/use-selected-sheet-accent";

type Props = {
  /** The sheet's own color (from frontmatter) */
  sheetColor: string;
  /** The sheet's category color (colorFrom) */
  sheetColorFrom: string;
  children: ReactNode;
};

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
  const sessionAccentColor = useSelectedSheetAccent();

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
