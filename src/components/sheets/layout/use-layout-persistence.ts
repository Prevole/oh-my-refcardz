"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { YamlCheatSheetWithMeta } from "@/lib/yaml-cheatsheets";
import { syncLayoutToDev } from "@/lib/dev-layout-sync";
import { buildDefaultSectionLayouts } from "./layout-inference";
import type { SectionLayoutState } from "./layout-types";
import {
  areLayoutsEqual,
  buildStorageKey,
  mergeStoredLayouts,
  parseStoredLayouts,
  serializeStoredLayouts,
} from "./layout-persistence";

function subscribeToHydration() {
  return () => {};
}

function getClientSnapshot() {
  return true;
}

function getServerSnapshot() {
  return false;
}

export type UseLayoutPersistenceResult = {
  sectionLayouts: SectionLayoutState[];
  setSectionLayouts: Dispatch<SetStateAction<SectionLayoutState[]>>;
  hydrated: boolean;
  hasSavedLayout: boolean;
  resetLayout: () => void;
};

export function useLayoutPersistence(sheetSlug: string, sheet: YamlCheatSheetWithMeta): UseLayoutPersistenceResult {
  const hydrated = useSyncExternalStore(subscribeToHydration, getClientSnapshot, getServerSnapshot);

  const defaultSectionLayouts = useMemo(() => {
    const inferredLayouts = buildDefaultSectionLayouts(sheet);

    if (sheet.savedLayout) {
      return mergeStoredLayouts(sheet.savedLayout, inferredLayouts);
    }
    return inferredLayouts;
  }, [sheet]);

  const [sectionLayouts, setSectionLayouts] = useState(defaultSectionLayouts);
  const [storageHydrated, setStorageHydrated] = useState(false);
  const didHydrateStorage = useRef(false);

  const hasSavedLayout = storageHydrated && !areLayoutsEqual(sectionLayouts, defaultSectionLayouts);

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

  useEffect(() => {
    if (!didHydrateStorage.current) return;

    const storageKey = buildStorageKey(sheetSlug);

    if (areLayoutsEqual(sectionLayouts, defaultSectionLayouts)) {
      window.localStorage.removeItem(storageKey);
      return;
    }

    window.localStorage.setItem(storageKey, serializeStoredLayouts(sectionLayouts));

    if (process.env.NODE_ENV === "development") {
      syncLayoutToDev(sheetSlug, sectionLayouts);
    }
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
