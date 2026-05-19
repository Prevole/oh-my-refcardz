"use client";

import { useCallback, useSyncExternalStore } from "react";
import { readStoredDebugOverlay, writeStoredDebugOverlay } from "./debug-overlay-storage";

const SUBSCRIBERS = new Set<() => void>();

function notify() {
  for (const listener of SUBSCRIBERS) listener();
}

function subscribe(listener: () => void): () => void {
  SUBSCRIBERS.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === "omr.debug-overlay") {
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
  return readStoredDebugOverlay();
}

function getServerSnapshot(): boolean {
  return false;
}

/**
 * Persistent toggle for the layout debug overlay (axes, enriched block badges,
 * global stats bar). The state is mirrored in `localStorage` so it survives
 * reloads.
 *
 * The hook is SSR-safe via `useSyncExternalStore`: it returns `false` on the
 * server and resolves to the persisted value on the client.
 */
export function useDebugOverlay(): {
  enabled: boolean;
  toggle: () => void;
  setEnabled: (value: boolean) => void;
} {
  const enabled = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setEnabled = useCallback((value: boolean) => {
    writeStoredDebugOverlay(value);
    notify();
  }, []);

  const toggle = useCallback(() => {
    writeStoredDebugOverlay(!readStoredDebugOverlay());
    notify();
  }, []);

  return { enabled, toggle, setEnabled };
}
