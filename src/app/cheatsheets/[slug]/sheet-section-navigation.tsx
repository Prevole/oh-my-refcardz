"use client";

import { useMemo } from "react";
import { useUISettings } from "@/hooks/use-ui-settings";
import { useSelectedSheetAccent } from "@/hooks/use-selected-sheet-accent";
import { SectionNavigation } from "@/components/navigation/section-navigation";
import { buildSectionAnchorId } from "@/lib/section-navigation";

type Props = {
  sections: Array<{ title: string }>;
  sheetColor: string;
  sheetColorFrom: string;
};

export function SheetSectionNavigation({ sections, sheetColor, sheetColorFrom }: Props) {
  const { settings } = useUISettings();
  const sessionAccentColor = useSelectedSheetAccent();

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
