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
  /**
   * Promote the current `blockLayouts` to be the new "original" baseline
   * for the rest of the session. After this call, `isModifiedFromOriginal`
   * becomes `false` until the layout is further mutated. The localStorage
   * mirror is cleared so a reload picks up the (presumably newly-saved)
   * server baseline cleanly.
   *
   * Used after a successful `syncLayoutToDev` so the user-facing reset
   * button hides immediately without waiting for a page reload to rehydrate
   * `sheet.savedBlockLayout`.
   */
  promoteCurrentAsBaseline: () => void;
};

export function useLayoutPersistence(sheetSlug: string, sheet: YamlCheatSheetWithMeta): UseLayoutPersistenceResult {
  const hydrated = useSyncExternalStore(subscribeToHydration, getClientSnapshot, getServerSnapshot);

  const inferredOriginalLayout = useMemo(() => {
    const inferredLayouts = buildDefaultBlockLayouts(sheet);

    if (sheet.savedBlockLayout) {
      return mergeStoredLayouts(sheet.savedBlockLayout, inferredLayouts);
    }
    return inferredLayouts;
  }, [sheet]);

  // Session-local override of the baseline. Set when the user promotes the
  // current layout (typically after a successful dev-save). Stored together
  // with the inferred baseline it was promoted against, so a server-side
  // baseline change (page reload / sheet swap) invalidates the override
  // automatically without a useEffect.
  const [override, setOverride] = useState<{
    base: BlockLayoutState[];
    promoted: BlockLayoutState[];
  } | null>(null);

  const baselineOverride =
    override && override.base === inferredOriginalLayout ? override.promoted : null;

  const originalLayout = baselineOverride ?? inferredOriginalLayout;

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

  function promoteCurrentAsBaseline() {
    if (!hydrated) return;

    window.localStorage.removeItem(buildStorageKey(sheetSlug));
    setOverride({ base: inferredOriginalLayout, promoted: blockLayouts });
  }

  return {
    blockLayouts,
    setBlockLayouts,
    hydrated,
    originalLayout,
    isModifiedFromOriginal,
    resetToOriginal,
    promoteCurrentAsBaseline,
  };
}
