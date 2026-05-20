"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { YamlCheatSheetWithMeta } from "@/lib/cheatsheet-shared";
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
  originalLayout: BlockLayoutState[];
  isModifiedFromOriginal: boolean;
  resetToOriginal: () => void;
};

export function useLayoutPersistence(sheetSlug: string, sheet: YamlCheatSheetWithMeta): UseLayoutPersistenceResult {
  const hydrated = useSyncExternalStore(subscribeToHydration, getClientSnapshot, getServerSnapshot);

  const originalLayout = useMemo(() => {
    const inferredLayouts = buildDefaultBlockLayouts(sheet);

    if (sheet.savedBlockLayout) {
      return mergeStoredLayouts(sheet.savedBlockLayout, inferredLayouts);
    }
    return inferredLayouts;
  }, [sheet]);

  const [blockLayouts, setBlockLayouts] = useState(originalLayout);
  const [storageHydrated, setStorageHydrated] = useState(false);
  const didHydrateStorage = useRef(false);

  const isModifiedFromOriginal = storageHydrated && !areLayoutsEqual(blockLayouts, originalLayout);

  useEffect(() => {
    const raw = window.localStorage.getItem(buildStorageKey(sheetSlug));
    const savedLayouts = parseStoredLayouts(raw, sheet, originalLayout);
    const nextLayouts = savedLayouts ?? originalLayout;

    queueMicrotask(() => {
      setBlockLayouts(nextLayouts);
      setStorageHydrated(true);
      didHydrateStorage.current = true;
    });
  }, [originalLayout, sheet, sheetSlug]);

  useEffect(() => {
    if (!didHydrateStorage.current) return;

    const storageKey = buildStorageKey(sheetSlug);

    if (areLayoutsEqual(blockLayouts, originalLayout)) {
      window.localStorage.removeItem(storageKey);
      return;
    }

    window.localStorage.setItem(storageKey, serializeStoredLayouts(blockLayouts));
  }, [blockLayouts, originalLayout, sheetSlug]);

  function resetToOriginal() {
    if (!hydrated) return;

    window.localStorage.removeItem(buildStorageKey(sheetSlug));
    setBlockLayouts(originalLayout);
  }

  return {
    blockLayouts,
    setBlockLayouts,
    hydrated,
    originalLayout,
    isModifiedFromOriginal,
    resetToOriginal,
  };
}
