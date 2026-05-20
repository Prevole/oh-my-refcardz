"use client";

import { useMemo } from "react";
import { useUISettings } from "@/hooks/use-ui-settings";
import { useSelectedSheetAccent } from "@/hooks/use-selected-sheet-accent";
import { AnchorNavigation } from "@/components/navigation/anchor-navigation";
import { buildBlockAnchorId } from "@/lib/anchor-navigation";
import { sortByLayoutOrder, useLayoutSnapshot } from "@/components/sheets/layout";

type Props = {
  sections: Array<{ id: string; title: string }>;
  sheetColor: string;
  sheetColorFrom: string;
};

export function SheetHeadingNavigation({ sections, sheetColor, sheetColorFrom }: Props) {
  const { settings } = useUISettings();
  const sessionAccentColor = useSelectedSheetAccent();
  const snapshot = useLayoutSnapshot();

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

  // Reorder sections by their current layout position. The colour gradient
  // is then computed in display order so that the colour ramp follows the
  // visible vertical flow, not the YAML declaration order.
  const orderedSections = useMemo(
    () => sortByLayoutOrder(sections, snapshot),
    [sections, snapshot]
  );

  const items = useMemo(() => {
    return orderedSections.map((section, index) => ({
      id: buildBlockAnchorId("sheet-heading", section.id),
      label: section.title,
      color: `color-mix(in srgb, ${baseColor} ${Math.max(40, 92 - index * 12)}%, white)`,
    }));
  }, [orderedSections, baseColor]);

  return <AnchorNavigation items={items} ariaLabel="Heading navigation" />;
}
