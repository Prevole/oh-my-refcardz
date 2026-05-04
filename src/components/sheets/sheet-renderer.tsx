"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SheetGrid, SheetCard } from "@/components/sheets/sheet-grid";
import { SheetCommand } from "@/components/sheets/sheet-command";
import { SheetConfig } from "@/components/sheets/sheet-config";
import { SheetShortcut } from "@/components/sheets/sheet-shortcut";
import { buildSectionAnchorId } from "@/lib/section-navigation";
import type { YamlCheatSheet, CheatSheetItem, CheatSheetCard } from "@/lib/yaml-cheatsheets";
import cheatsheetStyles from "./cheatsheet-rendering.module.css";

type Props = {
  sheetSlug: string;
  sheet: YamlCheatSheet;
};

const MAX_ROW_SPAN = 24;

type CardLayoutState = {
  colSpan: number;
  rowSpan: number;
};

type SectionLayoutState = {
  cards: CardLayoutState[];
};

type SectionMetricsState = {
  columns: number;
  unitSize: number;
};

const FALLBACK_METRICS: SectionMetricsState = {
  columns: 12,
  unitSize: 96,
};

export function YamlSheetRenderer({ sheetSlug, sheet }: Props) {
  const [editMode, setEditMode] = useState(false);
  const defaultSectionLayouts = useMemo(() => buildDefaultSectionLayouts(sheet), [sheet]);
  const [sectionLayouts, setSectionLayouts] = useState(defaultSectionLayouts);
  const [storageHydrated, setStorageHydrated] = useState(false);
  const [sectionMetrics, setSectionMetrics] = useState<SectionMetricsState[]>(() =>
    sheet.sections.map(() => FALLBACK_METRICS)
  );
  const didHydrateStorage = useRef(false);
  const hasSavedLayout = storageHydrated && !areLayoutsEqual(sectionLayouts, defaultSectionLayouts);

  useEffect(() => {
    const savedLayouts = readStoredLayouts(sheetSlug, sheet, defaultSectionLayouts);
    const nextLayouts = savedLayouts ?? defaultSectionLayouts;

    queueMicrotask(() => {
      setSectionLayouts(nextLayouts);
      setSectionMetrics(sheet.sections.map(() => FALLBACK_METRICS));
      setStorageHydrated(true);
      didHydrateStorage.current = true;
    });
  }, [defaultSectionLayouts, sheet, sheetSlug]);

  useEffect(() => {
    if (!didHydrateStorage.current) return;

    const storageKey = buildStorageKey(sheetSlug);

    if (areLayoutsEqual(sectionLayouts, defaultSectionLayouts)) {
      window.localStorage.removeItem(storageKey);
      return;
    }

    window.localStorage.setItem(storageKey, JSON.stringify(sectionLayouts));
  }, [defaultSectionLayouts, sectionLayouts, sheetSlug]);

  const updateSectionMetrics = useCallback((sectionIndex: number, nextMetrics: SectionMetricsState) => {
    setSectionMetrics((currentMetrics) => {
      const previous = currentMetrics[sectionIndex];
      if (previous && previous.columns === nextMetrics.columns && previous.unitSize === nextMetrics.unitSize) {
        return currentMetrics;
      }

      return currentMetrics.map((metrics, currentIndex) =>
        currentIndex === sectionIndex ? nextMetrics : metrics
      );
    });
  }, []);

  function updateCardSpan(sectionIndex: number, cardIndex: number, axis: keyof CardLayoutState, delta: -1 | 1) {
    setSectionLayouts((currentLayouts) =>
      currentLayouts.map((sectionLayout, currentSectionIndex) => {
        if (currentSectionIndex !== sectionIndex) return sectionLayout;

        return {
          ...sectionLayout,
          cards: sectionLayout.cards.map((cardLayout, currentCardIndex) => {
            if (currentCardIndex !== cardIndex) return cardLayout;

            const maxValue = axis === "colSpan" ? sectionMetrics[sectionIndex]?.columns ?? FALLBACK_METRICS.columns : MAX_ROW_SPAN;
            const nextValue = clamp(cardLayout[axis] + delta, 1, maxValue);

            if (nextValue === cardLayout[axis]) return cardLayout;

            return {
              ...cardLayout,
              [axis]: nextValue,
            };
          }),
        };
      })
    );
  }

  function resetLayout() {
    window.localStorage.removeItem(buildStorageKey(sheetSlug));
    setSectionLayouts(defaultSectionLayouts);
  }

  return (
    <>
      <div className={cheatsheetStyles.layoutToolbar}>
        <div className={cheatsheetStyles.layoutToolbarMeta}>
          <span className={cheatsheetStyles.layoutStorageStatus}>{hasSavedLayout ? "Saved locally" : "Default layout"}</span>
          <button
            type="button"
            className={cheatsheetStyles.layoutSecondaryButton}
            onClick={resetLayout}
            disabled={!hasSavedLayout}
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

            <SheetGrid
              editMode={editMode}
              onMetricsChange={(nextMetrics) => updateSectionMetrics(sectionIndex, nextMetrics)}
            >
              {section.cards.map((card, cardIndex) => {
                const layout = sectionLayouts[sectionIndex].cards[cardIndex];

                return (
                  <SheetCard
                    key={card.title}
                    title={card.title}
                    colSpan={clamp(layout.colSpan, 1, metrics.columns)}
                    rowSpan={layout.rowSpan}
                    editMode={editMode}
                    layoutLabel={`${layout.colSpan}x${layout.rowSpan}`}
                    controls={
                      editMode ? (
                        <CardLayoutControls
                          colSpan={layout.colSpan}
                          rowSpan={layout.rowSpan}
                          maxColumns={metrics.columns}
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

function buildDefaultSectionLayouts(sheet: YamlCheatSheet): SectionLayoutState[] {
  return sheet.sections.map((section) => ({
    cards: section.cards.map((card) => ({
      colSpan: inferCardColSpan(card),
      rowSpan: inferCardRowSpan(card),
    })),
  }));
}

function inferCardColSpan(card: CheatSheetCard) {
  const itemCount = card.items.length;
  const hasConfig = card.items.some((item) => item.type === "config");

  if (hasConfig) return 8;
  if (itemCount >= 5) return 8;
  if (itemCount >= 3) return 6;
  return 4;
}

function inferCardRowSpan(card: CheatSheetCard) {
  const itemCount = card.items.length;
  const hasConfig = card.items.some((item) => item.type === "config");
  const hasCommand = card.items.some((item) => item.type === "command");

  if (hasConfig) return 8;
  if (itemCount >= 5) return 8;
  if (hasCommand && itemCount >= 3) return 6;
  if (itemCount >= 3) return 5;
  return 4;
}

type CardLayoutControlsProps = {
  colSpan: number;
  rowSpan: number;
  maxColumns: number;
  onDecreaseWidth: () => void;
  onIncreaseWidth: () => void;
  onDecreaseHeight: () => void;
  onIncreaseHeight: () => void;
};

function CardLayoutControls({
  colSpan,
  rowSpan,
  maxColumns,
  onDecreaseWidth,
  onIncreaseWidth,
  onDecreaseHeight,
  onIncreaseHeight,
}: CardLayoutControlsProps) {
  return (
    <div className={cheatsheetStyles.cardLayoutControls}>
      <LayoutAxisControl
        label="W"
        value={colSpan}
        minValue={1}
        maxValue={maxColumns}
        onDecrease={onDecreaseWidth}
        onIncrease={onIncreaseWidth}
      />
      <LayoutAxisControl
        label="H"
        value={rowSpan}
        minValue={1}
        maxValue={MAX_ROW_SPAN}
        onDecrease={onDecreaseHeight}
        onIncrease={onIncreaseHeight}
      />
    </div>
  );
}

type LayoutAxisControlProps = {
  label: string;
  value: number;
  minValue: number;
  maxValue: number;
  onDecrease: () => void;
  onIncrease: () => void;
};

function LayoutAxisControl({ label, value, minValue, maxValue, onDecrease, onIncrease }: LayoutAxisControlProps) {
  return (
    <div className={cheatsheetStyles.layoutAxisControl}>
      <span className={cheatsheetStyles.layoutAxisLabel}>{label}</span>
      <button
        type="button"
        className={cheatsheetStyles.layoutAxisButton}
        onClick={onDecrease}
        disabled={value <= minValue}
        aria-label={`Decrease ${label === "W" ? "width" : "height"}`}
      >
        -
      </button>
      <span className={cheatsheetStyles.layoutAxisValue}>{value}</span>
      <button
        type="button"
        className={cheatsheetStyles.layoutAxisButton}
        onClick={onIncrease}
        disabled={value >= maxValue}
        aria-label={`Increase ${label === "W" ? "width" : "height"}`}
      >
        +
      </button>
    </div>
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function buildStorageKey(sheetSlug: string) {
  return `sheet-layout:${sheetSlug}`;
}

function readStoredLayouts(sheetSlug: string, sheet: YamlCheatSheet, defaultSectionLayouts: SectionLayoutState[]) {
  const raw = window.localStorage.getItem(buildStorageKey(sheetSlug));

  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    return isValidStoredLayout(parsed, sheet) ? mergeStoredLayouts(parsed, defaultSectionLayouts) : null;
  } catch {
    return null;
  }
}

function isValidStoredLayout(value: unknown, sheet: YamlCheatSheet): value is SectionLayoutState[] {
  if (!Array.isArray(value) || value.length !== sheet.sections.length) return false;

  return value.every((sectionLayout: unknown, sectionIndex) => {
    if (!sectionLayout || typeof sectionLayout !== "object") return false;
    if (!("cards" in sectionLayout)) return false;
    if (!Array.isArray(sectionLayout.cards) || sectionLayout.cards.length !== sheet.sections[sectionIndex].cards.length) {
      return false;
    }

    return sectionLayout.cards.every((cardLayout: unknown) => {
      if (!cardLayout || typeof cardLayout !== "object") return false;
      if (!("colSpan" in cardLayout) || !("rowSpan" in cardLayout)) return false;
      if (typeof cardLayout.colSpan !== "number" || typeof cardLayout.rowSpan !== "number") return false;

      return (
        Number.isInteger(cardLayout.colSpan) &&
        Number.isInteger(cardLayout.rowSpan) &&
        cardLayout.colSpan >= 1 &&
        cardLayout.rowSpan >= 1 &&
        cardLayout.rowSpan <= MAX_ROW_SPAN
      );
    });
  });
}

function mergeStoredLayouts(storedLayouts: SectionLayoutState[], defaultLayouts: SectionLayoutState[]) {
  return defaultLayouts.map((defaultSection, sectionIndex) => ({
    cards: defaultSection.cards.map((defaultCard, cardIndex) => ({
      colSpan: storedLayouts[sectionIndex].cards[cardIndex]?.colSpan ?? defaultCard.colSpan,
      rowSpan: storedLayouts[sectionIndex].cards[cardIndex]?.rowSpan ?? defaultCard.rowSpan,
    })),
  }));
}

function areLayoutsEqual(left: SectionLayoutState[], right: SectionLayoutState[]) {
  return JSON.stringify(left) === JSON.stringify(right);
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
