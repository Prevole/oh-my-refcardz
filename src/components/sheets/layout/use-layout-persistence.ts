"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { YamlCheatSheet } from "@/lib/yaml-cheatsheets";
import { buildDefaultSectionLayouts } from "./layout-inference";
import type { SectionLayoutState } from "./layout-types";
import {
  areLayoutsEqual,
  buildStorageKey,
  parseStoredLayouts,
} from "./layout-persistence";

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
    const raw = window.localStorage.getItem(buildStorageKey(sheetSlug));
    const savedLayouts = parseStoredLayouts(raw, sheet, defaultSectionLayouts);
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
