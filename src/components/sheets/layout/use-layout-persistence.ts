"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { YamlCheatSheetWithMeta } from "@/lib/cheatsheet-shared";
import { syncLayoutToDev } from "@/lib/dev-layout-sync";
import { buildDefaultBlockLayouts } from "./layout-inference";
import type { BlockLayoutState } from "./layout-types";
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
  blockLayouts: BlockLayoutState[];
  setBlockLayouts: Dispatch<SetStateAction<BlockLayoutState[]>>;
  hydrated: boolean;
  hasSavedLayout: boolean;
  resetLayout: () => void;
};

export function useLayoutPersistence(sheetSlug: string, sheet: YamlCheatSheetWithMeta): UseLayoutPersistenceResult {
  const hydrated = useSyncExternalStore(subscribeToHydration, getClientSnapshot, getServerSnapshot);

  const defaultBlockLayouts = useMemo(() => {
    const inferredLayouts = buildDefaultBlockLayouts(sheet);

    if (sheet.savedBlockLayout) {
      return mergeStoredLayouts(sheet.savedBlockLayout, inferredLayouts);
    }
    return inferredLayouts;
  }, [sheet]);

  const [blockLayouts, setBlockLayouts] = useState(defaultBlockLayouts);
  const [storageHydrated, setStorageHydrated] = useState(false);
  const didHydrateStorage = useRef(false);

  const hasSavedLayout = storageHydrated && !areLayoutsEqual(blockLayouts, defaultBlockLayouts);

  useEffect(() => {
    const raw = window.localStorage.getItem(buildStorageKey(sheetSlug));
    const savedLayouts = parseStoredLayouts(raw, sheet, defaultBlockLayouts);
    const nextLayouts = savedLayouts ?? defaultBlockLayouts;

    queueMicrotask(() => {
      setBlockLayouts(nextLayouts);
      setStorageHydrated(true);
      didHydrateStorage.current = true;
    });
  }, [defaultBlockLayouts, sheet, sheetSlug]);

  useEffect(() => {
    if (!didHydrateStorage.current) return;

    const storageKey = buildStorageKey(sheetSlug);

    if (areLayoutsEqual(blockLayouts, defaultBlockLayouts)) {
      window.localStorage.removeItem(storageKey);
      return;
    }

    window.localStorage.setItem(storageKey, serializeStoredLayouts(blockLayouts));

    if (process.env.NODE_ENV === "development") {
      syncLayoutToDev(sheetSlug, blockLayouts);
    }
  }, [blockLayouts, defaultBlockLayouts, sheetSlug]);

  function resetLayout() {
    if (!hydrated) return;

    window.localStorage.removeItem(buildStorageKey(sheetSlug));
    setBlockLayouts(defaultBlockLayouts);
  }

  return {
    blockLayouts,
    setBlockLayouts,
    hydrated,
    hasSavedLayout,
    resetLayout,
  };
}
