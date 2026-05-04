"use client";

import { useMemo, type ReactNode, type CSSProperties } from "react";
import { useUISettings } from "@/hooks/use-ui-settings";
import { useSelectedSheetAccent } from "@/hooks/use-selected-sheet-accent";

type Props = {
  sheetColor: string;
  sheetColorFrom: string;
  children: ReactNode;
};

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
