"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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

export function YamlSheetRenderer({ sheetSlug, sheet }: Props) {
  const [editMode, setEditMode] = useState(false);
  const defaultSectionLayouts = useMemo(() => buildDefaultSectionLayouts(sheet), [sheet]);
  const [sectionLayouts, setSectionLayouts] = useState(defaultSectionLayouts);
  const [storageHydrated, setStorageHydrated] = useState(false);
  const didHydrateStorage = useRef(false);
  const hasSavedLayout = storageHydrated && !areLayoutsEqual(sectionLayouts, defaultSectionLayouts);

  useEffect(() => {
    const savedLayouts = readStoredLayouts(sheetSlug, sheet, defaultSectionLayouts);
    const nextLayouts = savedLayouts ?? defaultSectionLayouts;

    queueMicrotask(() => {
      setSectionLayouts(nextLayouts);
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

  function updateCardSpan(sectionIndex: number, cardIndex: number, axis: "colSpan" | "rowSpan", delta: -1 | 1) {
    setSectionLayouts((currentLayouts) =>
      currentLayouts.map((sectionLayout, currentSectionIndex) => {
        if (currentSectionIndex !== sectionIndex) return sectionLayout;

        return {
          ...sectionLayout,
          cards: sectionLayout.cards.map((cardLayout, currentCardIndex) => {
            if (currentCardIndex !== cardIndex) return cardLayout;

            const maxValue = axis === "colSpan" ? sectionLayout.columns : MAX_ROW_SPAN;
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
      {sheet.sections.map((section, index) => (
        <section
          key={section.title}
          id={buildSectionAnchorId("sheet-section", section.title, index)}
          className={cheatsheetStyles.section}
        >
          <div className={cheatsheetStyles.sectionHeaderRow}>
            <h2 className={cheatsheetStyles.sectionTitle}>{section.title}</h2>
            {editMode ? (
              <span className={cheatsheetStyles.sectionLayoutLabel}>
                {sectionLayouts[index].columns} cols
              </span>
            ) : null}
          </div>
          <SheetGrid columns={sectionLayouts[index].columns} editMode={editMode}>
            {section.cards.map((card, cardIndex) => {
              const layout = sectionLayouts[index].cards[cardIndex];

              return (
                <SheetCard
                  key={card.title}
                  title={card.title}
                  colSpan={layout.colSpan}
                  rowSpan={layout.rowSpan}
                  editMode={editMode}
                  layoutLabel={`${layout.colSpan}x${layout.rowSpan}`}
                  controls={
                    editMode ? (
                      <CardLayoutControls
                        colSpan={layout.colSpan}
                        rowSpan={layout.rowSpan}
                        maxColumns={sectionLayouts[index].columns}
                        onDecreaseWidth={() => updateCardSpan(index, cardIndex, "colSpan", -1)}
                        onIncreaseWidth={() => updateCardSpan(index, cardIndex, "colSpan", 1)}
                        onDecreaseHeight={() => updateCardSpan(index, cardIndex, "rowSpan", -1)}
                        onIncreaseHeight={() => updateCardSpan(index, cardIndex, "rowSpan", 1)}
                      />
                    ) : null
                  }
                >
                  {card.items.map((item, index) => (
                    <div key={index}>
                      {index > 0 && <hr className={cheatsheetStyles.itemDivider} />}
                      <SheetItem item={item} />
                    </div>
                  ))}
                </SheetCard>
              );
            })}
          </SheetGrid>
        </section>
      ))}
    </>
  );
}

const MAX_ROW_SPAN = 4;

type SectionLayoutState = {
  columns: number;
  cards: Array<{
    colSpan: number;
    rowSpan: number;
  }>;
};

function buildDefaultSectionLayouts(sheet: YamlCheatSheet): SectionLayoutState[] {
  return sheet.sections.map((section) => {
    const columns = inferSectionColumns(section.cards.length);

    return {
      columns,
      cards: section.cards.map((card) => ({
        colSpan: inferCardColSpan(card, columns),
        rowSpan: inferCardRowSpan(card),
      })),
    };
  });
}

function inferSectionColumns(cardCount: number) {
  if (cardCount <= 1) return 1;
  if (cardCount === 2) return 2;
  return 3;
}

function inferCardColSpan(card: CheatSheetCard, columns: number) {
  const itemCount = card.items.length;

  if (columns === 1) return 1;
  if (columns === 2) {
    return itemCount >= 4 ? 2 : 1;
  }

  if (itemCount >= 5) return 2;
  return 1;
}

function inferCardRowSpan(card: CheatSheetCard) {
  const itemCount = card.items.length;
  const hasConfig = card.items.some((item) => item.type === "config");
  const hasCommand = card.items.some((item) => item.type === "command");

  if (hasConfig || itemCount >= 4) return 2;
  if (hasCommand && itemCount >= 3) return 2;
  return 1;
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

function readStoredLayouts(
  sheetSlug: string,
  sheet: YamlCheatSheet,
  defaultSectionLayouts: SectionLayoutState[]
) {
  const raw = window.localStorage.getItem(buildStorageKey(sheetSlug));

  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    return isValidStoredLayout(parsed, sheet, defaultSectionLayouts) ? parsed : null;
  } catch {
    return null;
  }
}

function isValidStoredLayout(
  value: unknown,
  sheet: YamlCheatSheet,
  defaultSectionLayouts: SectionLayoutState[]
): value is SectionLayoutState[] {
  if (!Array.isArray(value) || value.length !== sheet.sections.length) return false;

  return value.every((sectionLayout: unknown, sectionIndex) => {
    if (!sectionLayout || typeof sectionLayout !== "object") return false;
    if (!("columns" in sectionLayout) || !("cards" in sectionLayout)) return false;
    if (typeof sectionLayout.columns !== "number") return false;
    if (sectionLayout.columns !== defaultSectionLayouts[sectionIndex].columns) return false;
    if (!Array.isArray(sectionLayout.cards) || sectionLayout.cards.length !== sheet.sections[sectionIndex].cards.length) {
      return false;
    }

    const maxColumns = sectionLayout.columns;

    return sectionLayout.cards.every((cardLayout: unknown) => {
      if (!cardLayout || typeof cardLayout !== "object") return false;
      if (!("colSpan" in cardLayout) || !("rowSpan" in cardLayout)) return false;
      if (typeof cardLayout.colSpan !== "number" || typeof cardLayout.rowSpan !== "number") return false;

      return (
        Number.isInteger(cardLayout.colSpan) &&
        Number.isInteger(cardLayout.rowSpan) &&
        cardLayout.colSpan >= 1 &&
        cardLayout.colSpan <= maxColumns &&
        cardLayout.rowSpan >= 1 &&
        cardLayout.rowSpan <= MAX_ROW_SPAN
      );
    });
  });
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
