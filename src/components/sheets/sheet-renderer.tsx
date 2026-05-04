"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { SheetGrid, SheetCard, GRID_COLUMNS, GRID_GAP_PX } from "@/components/sheets/sheet-grid";
import { SheetCommand } from "@/components/sheets/sheet-command";
import { SheetConfig } from "@/components/sheets/sheet-config";
import { SheetShortcut } from "@/components/sheets/sheet-shortcut";
import { buildSectionAnchorId } from "@/lib/section-navigation";
import type { CheatSheetCard, CheatSheetItem, YamlCheatSheet } from "@/lib/yaml-cheatsheets";
import cheatsheetStyles from "./cheatsheet-rendering.module.css";

type Props = {
  sheetSlug: string;
  sheet: YamlCheatSheet;
};

const MAX_ROW_SPAN = 24;

type CardLayoutState = {
  colStart: number;
  rowStart: number;
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

type DragState = {
  sectionIndex: number;
  cardIndex: number;
  colStart: number;
  rowStart: number;
  colSpan: number;
  rowSpan: number;
  gridRect: DOMRect;
  unitSize: number;
  pointerOffsetX: number;
  pointerOffsetY: number;
};

const FALLBACK_METRICS: SectionMetricsState = {
  columns: GRID_COLUMNS,
  unitSize: 96,
};

export function YamlSheetRenderer({ sheetSlug, sheet }: Props) {
  const [editMode, setEditMode] = useState(false);
  const hydrated = useSyncExternalStore(subscribeToHydration, getClientSnapshot, getServerSnapshot);
  const defaultSectionLayouts = useMemo(() => buildDefaultSectionLayouts(sheet), [sheet]);
  const [sectionLayouts, setSectionLayouts] = useState(defaultSectionLayouts);
  const [storageHydrated, setStorageHydrated] = useState(false);
  const [sectionMetrics, setSectionMetrics] = useState<SectionMetricsState[]>(() => sheet.sections.map(() => FALLBACK_METRICS));
  const [dragState, setDragState] = useState<DragState | null>(null);
  const dragStateRef = useRef<DragState | null>(null);
  const didHydrateStorage = useRef(false);
  const hasSavedLayout = storageHydrated && !areLayoutsEqual(sectionLayouts, defaultSectionLayouts);

  useEffect(() => {
    dragStateRef.current = dragState;
  }, [dragState]);

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

  useEffect(() => {
    if (!editMode || !dragState) return;

    function handlePointerMove(event: PointerEvent) {
      const active = dragStateRef.current;
      if (!active) return;

      const nextPosition = pointerToGridPosition(
        event.clientX - active.pointerOffsetX,
        event.clientY - active.pointerOffsetY,
        active.gridRect,
        active.unitSize,
        active.colSpan
      );

      if (nextPosition.colStart === active.colStart && nextPosition.rowStart === active.rowStart) {
        return;
      }

      setDragState({ ...active, ...nextPosition });
    }

    function handlePointerUp() {
      const active = dragStateRef.current;
      if (!active) return;

      setSectionLayouts((currentLayouts) =>
        currentLayouts.map((sectionLayout, sectionIndex) => {
          if (sectionIndex !== active.sectionIndex) return sectionLayout;

          return {
            cards: resolveSectionLayout(sectionLayout.cards, active.cardIndex, {
              colStart: active.colStart,
              rowStart: active.rowStart,
              colSpan: active.colSpan,
              rowSpan: active.rowSpan,
            }),
          };
        })
      );

      setDragState(null);
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [dragState, editMode]);

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

  function startCardDrag(sectionIndex: number, cardIndex: number, event: ReactPointerEvent<HTMLElement>) {
    if (!editMode) return;

    if ((event.target as HTMLElement).closest("[data-card-layout-controls]")) return;

    const grid = event.currentTarget.closest("[data-sheet-grid]");
    if (!(grid instanceof HTMLElement)) return;

    const metrics = sectionMetrics[sectionIndex] ?? FALLBACK_METRICS;
    const cardLayout = sectionLayouts[sectionIndex].cards[cardIndex];

    event.preventDefault();

    setDragState({
      sectionIndex,
      cardIndex,
      colStart: cardLayout.colStart,
      rowStart: cardLayout.rowStart,
      colSpan: cardLayout.colSpan,
      rowSpan: cardLayout.rowSpan,
      gridRect: grid.getBoundingClientRect(),
      unitSize: metrics.unitSize,
      pointerOffsetX: event.clientX - (grid.getBoundingClientRect().left + (cardLayout.colStart - 1) * (metrics.unitSize + GRID_GAP_PX)),
      pointerOffsetY: event.clientY - (grid.getBoundingClientRect().top + (cardLayout.rowStart - 1) * (metrics.unitSize + GRID_GAP_PX)),
    });
  }

  function resetLayout() {
    if (!hydrated) return;

    window.localStorage.removeItem(buildStorageKey(sheetSlug));
    setSectionLayouts(defaultSectionLayouts);
    setDragState(null);
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
                const baseLayout = sectionLayouts[sectionIndex].cards[cardIndex];
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
                          maxColumns={GRID_COLUMNS}
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
  return sheet.sections.map((section) => {
    const cards = section.cards.map((card) => ({
      colStart: 1,
      rowStart: 1,
      colSpan: inferCardColSpan(card),
      rowSpan: inferCardRowSpan(card),
    }));

    return {
      cards: resolveSectionLayout(cards),
    };
  });
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
    <div className={cheatsheetStyles.cardLayoutControls} data-card-layout-controls>
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

function pointerToGridPosition(
  clientX: number,
  clientY: number,
  gridRect: DOMRect,
  unitSize: number,
  colSpan: number
) {
  const pitch = unitSize + GRID_GAP_PX;
  const rawCol = 1 + Math.floor((clientX - gridRect.left) / pitch);
  const rawRow = 1 + Math.floor((clientY - gridRect.top) / pitch);

  return {
    colStart: clamp(rawCol, 1, GRID_COLUMNS - colSpan + 1),
    rowStart: Math.max(1, rawRow),
  };
}

function resolveSectionLayout(cards: CardLayoutState[], pinnedIndex?: number, pinnedLayout?: CardLayoutState) {
  const nextCards = cards.map((card) => ({ ...card }));
  const occupied = new Set<string>();

  if (pinnedIndex !== undefined && pinnedLayout) {
    const pinned = clampCardLayoutToGrid(pinnedLayout);
    nextCards[pinnedIndex] = pinned;
    markOccupied(occupied, pinned);
  }

  for (let index = 0; index < nextCards.length; index++) {
    if (index === pinnedIndex) continue;

    const preferred = clampCardLayoutToGrid(nextCards[index]);
    const placed = placeCardAtNearestSlot(preferred, occupied);
    nextCards[index] = placed;
    markOccupied(occupied, placed);
  }

  return nextCards;
}

function placeCardAtNearestSlot(card: CardLayoutState, occupied: Set<string>) {
  const startCol = clamp(card.colStart, 1, GRID_COLUMNS - card.colSpan + 1);
  const startRow = Math.max(1, card.rowStart);

  for (let row = startRow; row < startRow + 200; row++) {
    for (let col = row === startRow ? startCol : 1; col <= GRID_COLUMNS - card.colSpan + 1; col++) {
      const candidate = { ...card, colStart: col, rowStart: row };
      if (!hasCollision(occupied, candidate)) {
        return candidate;
      }
    }
  }

  return { ...card, colStart: 1, rowStart: startRow };
}

function clampCardLayoutToGrid(card: CardLayoutState) {
  const colSpan = clamp(card.colSpan, 1, GRID_COLUMNS);
  const rowSpan = clamp(card.rowSpan, 1, MAX_ROW_SPAN);

  return {
    colSpan,
    rowSpan,
    colStart: clamp(card.colStart, 1, GRID_COLUMNS - colSpan + 1),
    rowStart: Math.max(1, card.rowStart),
  };
}

function hasCollision(occupied: Set<string>, card: CardLayoutState) {
  for (let row = card.rowStart; row < card.rowStart + card.rowSpan; row++) {
    for (let col = card.colStart; col < card.colStart + card.colSpan; col++) {
      if (occupied.has(`${col}:${row}`)) {
        return true;
      }
    }
  }

  return false;
}

function markOccupied(occupied: Set<string>, card: CardLayoutState) {
  for (let row = card.rowStart; row < card.rowStart + card.rowSpan; row++) {
    for (let col = card.colStart; col < card.colStart + card.colSpan; col++) {
      occupied.add(`${col}:${row}`);
    }
  }
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
    if (!("cards" in sectionLayout) || !Array.isArray(sectionLayout.cards)) return false;
    if (sectionLayout.cards.length !== sheet.sections[sectionIndex].cards.length) return false;

    return sectionLayout.cards.every((cardLayout: unknown) => {
      if (!cardLayout || typeof cardLayout !== "object") return false;
      if (!("colStart" in cardLayout) || !("rowStart" in cardLayout) || !("colSpan" in cardLayout) || !("rowSpan" in cardLayout)) {
        return false;
      }

      return (
        typeof cardLayout.colStart === "number" &&
        typeof cardLayout.rowStart === "number" &&
        typeof cardLayout.colSpan === "number" &&
        typeof cardLayout.rowSpan === "number" &&
        Number.isInteger(cardLayout.colStart) &&
        Number.isInteger(cardLayout.rowStart) &&
        Number.isInteger(cardLayout.colSpan) &&
        Number.isInteger(cardLayout.rowSpan) &&
        cardLayout.colStart >= 1 &&
        cardLayout.rowStart >= 1 &&
        cardLayout.colSpan >= 1 &&
        cardLayout.colSpan <= GRID_COLUMNS &&
        cardLayout.rowSpan >= 1 &&
        cardLayout.rowSpan <= MAX_ROW_SPAN
      );
    });
  });
}

function mergeStoredLayouts(storedLayouts: SectionLayoutState[], defaultLayouts: SectionLayoutState[]) {
  return defaultLayouts.map((defaultSection, sectionIndex) => ({
    cards: defaultSection.cards.map((defaultCard, cardIndex) => ({
      colStart: storedLayouts[sectionIndex].cards[cardIndex]?.colStart ?? defaultCard.colStart,
      rowStart: storedLayouts[sectionIndex].cards[cardIndex]?.rowStart ?? defaultCard.rowStart,
      colSpan: storedLayouts[sectionIndex].cards[cardIndex]?.colSpan ?? defaultCard.colSpan,
      rowSpan: storedLayouts[sectionIndex].cards[cardIndex]?.rowSpan ?? defaultCard.rowSpan,
    })),
  }));
}

function areLayoutsEqual(left: SectionLayoutState[], right: SectionLayoutState[]) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function subscribeToHydration() {
  return () => {};
}

function getClientSnapshot() {
  return true;
}

function getServerSnapshot() {
  return false;
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
