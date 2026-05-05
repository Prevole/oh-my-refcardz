"use client";

import { useCallback, useState } from "react";
import { SheetGrid, SheetCard } from "@/components/sheets/sheet-grid";
import { SheetCommand } from "@/components/sheets/sheet-command";
import { SheetConfig } from "@/components/sheets/sheet-config";
import { SheetShortcut } from "@/components/sheets/sheet-shortcut";
import { buildSectionAnchorId } from "@/lib/section-navigation";
import type { CheatSheetItem, YamlCheatSheetWithMeta } from "@/lib/yaml-cheatsheets";
import {
  useLayoutPersistence,
  useCardDrag,
  useCardResize,
  useCardKeyboard,
  FALLBACK_METRICS,
  type SectionMetricsState,
} from "./layout";
import cheatsheetStyles from "./cheatsheet-rendering.module.css";

type Props = {
  sheetSlug: string;
  sheet: YamlCheatSheetWithMeta;
};

export function YamlSheetRenderer({ sheetSlug, sheet }: Props) {
  const [sectionMetrics, setSectionMetrics] = useState<SectionMetricsState[]>(() =>
    sheet.sections.map(() => FALLBACK_METRICS)
  );

  const { sectionLayouts, setSectionLayouts, hydrated, hasSavedLayout, resetLayout } = useLayoutPersistence(
    sheetSlug,
    sheet
  );

  const { dragState, startCardDrag } = useCardDrag(sectionLayouts, setSectionLayouts, sectionMetrics);
  const { resizeState, startCardResize } = useCardResize(sectionLayouts, setSectionLayouts, sectionMetrics);

  const getCardCount = useCallback(
    (sectionIndex: number) => sheet.sections[sectionIndex]?.cards.length ?? 0,
    [sheet.sections]
  );

  const { focusedCard, setFocusedCard, isManipulating } = useCardKeyboard({
    sectionLayouts,
    setSectionLayouts,
    sectionCount: sheet.sections.length,
    getCardCount,
  });

  const isLayoutActive = Boolean(dragState || resizeState || focusedCard);
  const layoutMetrics = sectionMetrics[0] ?? FALLBACK_METRICS;

  function updateSectionMetrics(sectionIndex: number, nextMetrics: SectionMetricsState) {
    setSectionMetrics((currentMetrics) => {
      const previous = currentMetrics[sectionIndex];
      if (previous && previous.columns === nextMetrics.columns && previous.unitSize === nextMetrics.unitSize) {
        return currentMetrics;
      }

      return currentMetrics.map((metrics, currentIndex) => (currentIndex === sectionIndex ? nextMetrics : metrics));
    });
  }

  function handleHeaderPointerDown(
    sectionIndex: number,
    cardIndex: number,
    event: React.PointerEvent<HTMLElement>
  ) {
    setFocusedCard(null);
    startCardDrag(sectionIndex, cardIndex, event);
  }

  function handleResizePointerDown(
    sectionIndex: number,
    cardIndex: number,
    direction: "north" | "east" | "south" | "west" | "north-east" | "south-east" | "south-west" | "north-west",
    event: React.PointerEvent<HTMLElement>
  ) {
    setFocusedCard(null);
    startCardResize(sectionIndex, cardIndex, direction, event);
  }

  return (
    <>
      <div className={cheatsheetStyles.layoutToolbar}>
        <div className={cheatsheetStyles.layoutToolbarMeta}>
          <span className={cheatsheetStyles.layoutStorageStatus} suppressHydrationWarning>
            {hydrated && hasSavedLayout ? "Saved locally" : "Default layout"}
          </span>
          {isLayoutActive ? (
            <span className={cheatsheetStyles.sectionLayoutLabel}>
              {layoutMetrics.columns} cols · {Math.round(layoutMetrics.unitSize)}px
            </span>
          ) : null}
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
      </div>

      {sheet.sections.map((section, sectionIndex) => {
        return (
          <section
            key={section.title}
            id={buildSectionAnchorId("sheet-section", section.title, sectionIndex)}
            className={cheatsheetStyles.section}
          >
            <div className={cheatsheetStyles.sectionHeaderRow}>
              <h2 className={cheatsheetStyles.sectionTitle}>{section.title}</h2>
            </div>

            <SheetGrid editMode={isLayoutActive} onMetricsChange={(nextMetrics) => updateSectionMetrics(sectionIndex, nextMetrics)}>
              {section.cards.map((card, cardIndex) => {
                const baseLayout = sectionLayouts[sectionIndex]?.cards[cardIndex];
                if (!baseLayout) return null;

                const isDragging = Boolean(
                  dragState && dragState.sectionIndex === sectionIndex && dragState.cardIndex === cardIndex
                );
                const isResizing = Boolean(
                  resizeState && resizeState.sectionIndex === sectionIndex && resizeState.cardIndex === cardIndex
                );
                const isKeyboardFocused = Boolean(
                  focusedCard && focusedCard.sectionIndex === sectionIndex && focusedCard.cardIndex === cardIndex
                );
                const isDimmed = Boolean(dragState || resizeState || focusedCard) && !isDragging && !isResizing && !isKeyboardFocused;
                const previewLayout = isDragging && dragState
                    ? {
                        colStart: dragState.colStart,
                        rowStart: dragState.rowStart,
                        colSpan: dragState.colSpan,
                        rowSpan: dragState.rowSpan,
                      }
                    : isResizing && resizeState
                      ? {
                          colStart: resizeState.colStart,
                          rowStart: resizeState.rowStart,
                          colSpan: resizeState.colSpan,
                          rowSpan: resizeState.rowSpan,
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
                    editMode={isLayoutActive}
                    dragging={isDragging || isResizing}
                    dimmed={isDimmed}
                    keyboardFocused={isKeyboardFocused}
                    manipulating={isKeyboardFocused && isManipulating}
                    sectionIndex={sectionIndex}
                    cardIndex={cardIndex}
                    onHeaderPointerDown={(event) => handleHeaderPointerDown(sectionIndex, cardIndex, event)}
                    onResizePointerDown={(direction, event) =>
                      handleResizePointerDown(sectionIndex, cardIndex, direction, event)
                    }
                    activeResizeDirection={isResizing && resizeState ? resizeState.direction : null}
                    layoutLabel={`${previewLayout.colStart},${previewLayout.rowStart} · ${previewLayout.colSpan}x${previewLayout.rowSpan}`}
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
