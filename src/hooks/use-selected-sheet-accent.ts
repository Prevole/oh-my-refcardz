"use client";

import { useSyncExternalStore } from "react";
import { SELECTED_SHEET_ACCENT_KEY } from "@/lib/constants";

function subscribe(callback: () => void): () => void {
  const handleStorageChange = (event: StorageEvent) => {
    if (event.key === SELECTED_SHEET_ACCENT_KEY || event.key === null) {
      callback();
    }
  };

  window.addEventListener("storage", handleStorageChange);
  return () => window.removeEventListener("storage", handleStorageChange);
}

function getSnapshot(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  return window.sessionStorage.getItem(SELECTED_SHEET_ACCENT_KEY);
}

function getServerSnapshot(): string | null {
  return null;
}

export function useSelectedSheetAccent() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
