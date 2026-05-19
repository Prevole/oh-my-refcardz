"use client";

import { useCallback, useSyncExternalStore } from "react";
import {
  DEVELOPER_MODE_STORAGE_KEY,
  readStoredDeveloperMode,
  writeStoredDeveloperMode,
} from "./dev-mode-storage";

const SUBSCRIBERS = new Set<() => void>();

function notify() {
  for (const listener of SUBSCRIBERS) listener();
}

function subscribe(listener: () => void): () => void {
  SUBSCRIBERS.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === DEVELOPER_MODE_STORAGE_KEY) {
      listener();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    SUBSCRIBERS.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

function getSnapshot(): boolean {
  return readStoredDeveloperMode();
}

function getServerSnapshot(): boolean {
  return false;
}

/**
 * Persistent toggle for developer mode (axes overlay, enriched block badges,
 * dev-mode bar with reset/save/recording/logs tools). The state is mirrored
 * in `localStorage` so it survives reloads.
 *
 * The hook is SSR-safe via `useSyncExternalStore`: it returns `false` on the
 * server and resolves to the persisted value on the client.
 */
export function useDeveloperMode(): {
  enabled: boolean;
  toggle: () => void;
  setEnabled: (value: boolean) => void;
} {
  const enabled = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setEnabled = useCallback((value: boolean) => {
    writeStoredDeveloperMode(value);
    notify();
  }, []);

  const toggle = useCallback(() => {
    writeStoredDeveloperMode(!readStoredDeveloperMode());
    notify();
  }, []);

  return { enabled, toggle, setEnabled };
}
