"use client";

import { useMemo, useSyncExternalStore } from "react";
import { useUISettings } from "@/hooks/use-ui-settings";
import { SELECTED_SHEET_ACCENT_KEY } from "@/lib/constants";
import { SectionNavigation } from "@/components/navigation/section-navigation";
import { buildSectionAnchorId } from "@/lib/section-navigation";

type Props = {
  sections: Array<{ title: string }>;
  sheetColor: string;
  sheetColorFrom: string;
};

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

export function SheetSectionNavigation({ sections, sheetColor, sheetColorFrom }: Props) {
  const { settings } = useUISettings();
  const sessionAccentColor = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const baseColor = useMemo(() => {
    switch (settings.modern.colorMode) {
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

  const items = useMemo(() => {
    return sections.map((section, index) => ({
      id: buildSectionAnchorId("sheet-section", section.title, index),
      label: section.title,
      color: `color-mix(in srgb, ${baseColor} ${Math.max(40, 92 - index * 12)}%, white)`,
    }));
  }, [sections, baseColor]);

  return <SectionNavigation items={items} ariaLabel="Section navigation" />;
}
