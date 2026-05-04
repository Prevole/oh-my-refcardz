"use client";

import { useState } from "react";
import { SheetGrid, SheetCard, GRID_COLUMNS } from "@/components/sheets/sheet-grid";
import { SheetCommand } from "@/components/sheets/sheet-command";
import { SheetConfig } from "@/components/sheets/sheet-config";
import { SheetShortcut } from "@/components/sheets/sheet-shortcut";
import { buildSectionAnchorId } from "@/lib/section-navigation";
import type { CheatSheetItem, YamlCheatSheet } from "@/lib/yaml-cheatsheets";
import {
  useLayoutPersistence,
  useCardDrag,
  CardLayoutControls,
  resolveSectionLayout,
  clamp,
  FALLBACK_METRICS,
  MAX_ROW_SPAN,
  type SectionMetricsState,
} from "./layout";
import cheatsheetStyles from "./cheatsheet-rendering.module.css";

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

type Props = {
  sheetSlug: string;
  sheet: YamlCheatSheet;
};

export function YamlSheetRenderer({ sheetSlug, sheet }: Props) {
  const [editMode, setEditMode] = useState(false);
  const [sectionMetrics, setSectionMetrics] = useState<SectionMetricsState[]>(() =>
    sheet.sections.map(() => FALLBACK_METRICS)
  );

  const { sectionLayouts, setSectionLayouts, hydrated, hasSavedLayout, resetLayout } = useLayoutPersistence(
    sheetSlug,
    sheet
  );

  const { dragState, startCardDrag } = useCardDrag(editMode, sectionLayouts, setSectionLayouts, sectionMetrics);

  function updateSectionMetrics(sectionIndex: number, nextMetrics: SectionMetricsState) {
    setSectionMetrics((currentMetrics) => {
      const previous = currentMetrics[sectionIndex];
      if (previous && previous.columns === nextMetrics.columns && previous.unitSize === nextMetrics.unitSize) {
        return currentMetrics;
      }

      return currentMetrics.map((metrics, currentIndex) => (currentIndex === sectionIndex ? nextMetrics : metrics));
    });
  }

  function updateCardSpan(sectionIndex: number, cardIndex: number, axis: "colSpan" | "rowSpan", delta: -1 | 1) {
    setSectionLayouts((currentLayouts) =>
      currentLayouts.map((sectionLayout, currentSectionIndex) => {
        if (currentSectionIndex !== sectionIndex) return sectionLayout;

        const currentCard = sectionLayout.cards[cardIndex];
        const maxValue = axis === "colSpan" ? GRID_COLUMNS : MAX_ROW_SPAN;
        const nextValue = clamp(currentCard[axis] + delta, 1, maxValue);

        if (nextValue === currentCard[axis]) return sectionLayout;

        const resizedCard = {
          ...currentCard,
          [axis]: nextValue,
        };

        return {
          cards: resolveSectionLayout(sectionLayout.cards, cardIndex, resizedCard),
        };
      })
    );
  }

  return (
    <>
      <div className={cheatsheetStyles.layoutToolbar}>
        <div className={cheatsheetStyles.layoutToolbarMeta}>
          <span className={cheatsheetStyles.layoutStorageStatus} suppressHydrationWarning>
            {hydrated && hasSavedLayout ? "Saved locally" : "Default layout"}
          </span>
          <button
            type="button"
            className={cheatsheetStyles.layoutSecondaryButton}
            onClick={resetLayout}
            disabled={!hydrated || !hasSavedLayout}
            suppressHydrationWarning
          >
            Reset layout
          </button>
        </div>
        <button
          type="button"
          className={`${cheatsheetStyles.layoutToggleButton} ${editMode ? cheatsheetStyles.layoutToggleButtonActive : ""}`}
          onClick={() => setEditMode((current) => !current)}
        >
          {editMode ? "Exit layout mode" : "Enter layout mode"}
        </button>
      </div>

      {sheet.sections.map((section, sectionIndex) => {
        const metrics = sectionMetrics[sectionIndex] ?? FALLBACK_METRICS;

        return (
          <section
            key={section.title}
            id={buildSectionAnchorId("sheet-section", section.title, sectionIndex)}
            className={cheatsheetStyles.section}
          >
            <div className={cheatsheetStyles.sectionHeaderRow}>
              <h2 className={cheatsheetStyles.sectionTitle}>{section.title}</h2>
              {editMode ? (
                <span className={cheatsheetStyles.sectionLayoutLabel}>
                  {metrics.columns} cols · {Math.round(metrics.unitSize)}px
                </span>
              ) : null}
            </div>

            <SheetGrid editMode={editMode} onMetricsChange={(nextMetrics) => updateSectionMetrics(sectionIndex, nextMetrics)}>
              {section.cards.map((card, cardIndex) => {
                const baseLayout = sectionLayouts[sectionIndex]?.cards[cardIndex];
                if (!baseLayout) return null;

                const isDragging = Boolean(
                  dragState && dragState.sectionIndex === sectionIndex && dragState.cardIndex === cardIndex
                );
                const isDimmed = Boolean(dragState) && !isDragging;
                const previewLayout =
                  isDragging && dragState
                    ? {
                        colStart: dragState.colStart,
                        rowStart: dragState.rowStart,
                        colSpan: dragState.colSpan,
                        rowSpan: dragState.rowSpan,
                      }
                    : baseLayout;

                return (
                  <SheetCard
                    key={card.title}
                    title={card.title}
                    colStart={previewLayout.colStart}
                    rowStart={previewLayout.rowStart}
                    colSpan={previewLayout.colSpan}
                    rowSpan={previewLayout.rowSpan}
                    editMode={editMode}
                    dragging={isDragging}
                    dimmed={isDimmed}
                    onHeaderPointerDown={(event) => startCardDrag(sectionIndex, cardIndex, event)}
                    layoutLabel={`${previewLayout.colStart},${previewLayout.rowStart} · ${previewLayout.colSpan}x${previewLayout.rowSpan}`}
                    controls={
                      editMode ? (
                        <CardLayoutControls
                          colSpan={baseLayout.colSpan}
                          rowSpan={baseLayout.rowSpan}
                          onDecreaseWidth={() => updateCardSpan(sectionIndex, cardIndex, "colSpan", -1)}
                          onIncreaseWidth={() => updateCardSpan(sectionIndex, cardIndex, "colSpan", 1)}
                          onDecreaseHeight={() => updateCardSpan(sectionIndex, cardIndex, "rowSpan", -1)}
                          onIncreaseHeight={() => updateCardSpan(sectionIndex, cardIndex, "rowSpan", 1)}
                        />
                      ) : null
                    }
                  >
                    {card.items.map((item, itemIndex) => (
                      <div key={itemIndex}>
                        {itemIndex > 0 && <hr className={cheatsheetStyles.itemDivider} />}
                        <SheetItem item={item} />
                      </div>
                    ))}
                  </SheetCard>
                );
              })}
            </SheetGrid>
          </section>
        );
      })}
    </>
  );
}

// ---------------------------------------------------------------------------
// SheetItem
// ---------------------------------------------------------------------------

function SheetItem({ item }: { item: CheatSheetItem }) {
  if (item.type === "command") {
    return (
      <SheetCommand
        title={item.title}
        command={item.command}
        aliases={item.aliases}
        description={item.description}
        example={item.examples?.[0]}
      />
    );
  }

  if (item.type === "shortcut") {
    return <SheetShortcut keys={item.keys} description={item.description} />;
  }

  if (item.type === "config") {
    return (
      <SheetConfig
        title={item.title}
        file={item.file}
        context={item.context}
        entries={item.entries}
        description={item.description}
      />
    );
  }

  return null;
}
