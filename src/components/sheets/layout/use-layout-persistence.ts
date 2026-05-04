"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { YamlCheatSheet } from "@/lib/yaml-cheatsheets";
import { GRID_COLUMNS } from "../sheet-grid";
import { buildDefaultSectionLayouts } from "./layout-inference";
import { MAX_ROW_SPAN, type SectionLayoutState } from "./layout-types";

// ---------------------------------------------------------------------------
// Hydration helpers (for SSR/client sync)
// ---------------------------------------------------------------------------

function subscribeToHydration() {
  return () => {};
}

function getClientSnapshot() {
  return true;
}

function getServerSnapshot() {
  return false;
}

// ---------------------------------------------------------------------------
// Storage helpers
// ---------------------------------------------------------------------------

function buildStorageKey(sheetSlug: string): string {
  return `sheet-layout:${sheetSlug}`;
}

function areLayoutsEqual(left: SectionLayoutState[], right: SectionLayoutState[]): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
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

function mergeStoredLayouts(storedLayouts: SectionLayoutState[], defaultLayouts: SectionLayoutState[]): SectionLayoutState[] {
  return defaultLayouts.map((defaultSection, sectionIndex) => ({
    cards: defaultSection.cards.map((defaultCard, cardIndex) => ({
      colStart: storedLayouts[sectionIndex].cards[cardIndex]?.colStart ?? defaultCard.colStart,
      rowStart: storedLayouts[sectionIndex].cards[cardIndex]?.rowStart ?? defaultCard.rowStart,
      colSpan: storedLayouts[sectionIndex].cards[cardIndex]?.colSpan ?? defaultCard.colSpan,
      rowSpan: storedLayouts[sectionIndex].cards[cardIndex]?.rowSpan ?? defaultCard.rowSpan,
    })),
  }));
}

function readStoredLayouts(
  sheetSlug: string,
  sheet: YamlCheatSheet,
  defaultSectionLayouts: SectionLayoutState[]
): SectionLayoutState[] | null {
  const raw = window.localStorage.getItem(buildStorageKey(sheetSlug));

  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    return isValidStoredLayout(parsed, sheet) ? mergeStoredLayouts(parsed, defaultSectionLayouts) : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export type UseLayoutPersistenceResult = {
  sectionLayouts: SectionLayoutState[];
  setSectionLayouts: Dispatch<SetStateAction<SectionLayoutState[]>>;
  hydrated: boolean;
  hasSavedLayout: boolean;
  resetLayout: () => void;
};

export function useLayoutPersistence(sheetSlug: string, sheet: YamlCheatSheet): UseLayoutPersistenceResult {
  const hydrated = useSyncExternalStore(subscribeToHydration, getClientSnapshot, getServerSnapshot);
  const defaultSectionLayouts = useMemo(() => buildDefaultSectionLayouts(sheet), [sheet]);
  const [sectionLayouts, setSectionLayouts] = useState(defaultSectionLayouts);
  const [storageHydrated, setStorageHydrated] = useState(false);
  const didHydrateStorage = useRef(false);

  const hasSavedLayout = storageHydrated && !areLayoutsEqual(sectionLayouts, defaultSectionLayouts);

  // Read from localStorage on mount
  useEffect(() => {
    const savedLayouts = readStoredLayouts(sheetSlug, sheet, defaultSectionLayouts);
    const nextLayouts = savedLayouts ?? defaultSectionLayouts;

    queueMicrotask(() => {
      setSectionLayouts(nextLayouts);
      setStorageHydrated(true);
      didHydrateStorage.current = true;
    });
  }, [defaultSectionLayouts, sheet, sheetSlug]);

  // Write to localStorage on change
  useEffect(() => {
    if (!didHydrateStorage.current) return;

    const storageKey = buildStorageKey(sheetSlug);

    if (areLayoutsEqual(sectionLayouts, defaultSectionLayouts)) {
      window.localStorage.removeItem(storageKey);
      return;
    }

    window.localStorage.setItem(storageKey, JSON.stringify(sectionLayouts));
  }, [defaultSectionLayouts, sectionLayouts, sheetSlug]);

  function resetLayout() {
    if (!hydrated) return;

    window.localStorage.removeItem(buildStorageKey(sheetSlug));
    setSectionLayouts(defaultSectionLayouts);
  }

  return {
    sectionLayouts,
    setSectionLayouts,
    hydrated,
    hasSavedLayout,
    resetLayout,
  };
}
