/**
 * Persistence layer for the debug overlay toggle. Extracted from the hook so
 * it can be unit-tested without a React renderer.
 *
 * Storage key: `omr.debug-overlay` — string "1" when active, anything else
 * (including absent) means inactive.
 */

export const DEBUG_OVERLAY_STORAGE_KEY = "omr.debug-overlay";

export function readStoredDebugOverlay(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(DEBUG_OVERLAY_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function writeStoredDebugOverlay(value: boolean): void {
  if (typeof window === "undefined") return;
  try {
    if (value) {
      window.localStorage.setItem(DEBUG_OVERLAY_STORAGE_KEY, "1");
    } else {
      window.localStorage.removeItem(DEBUG_OVERLAY_STORAGE_KEY);
    }
  } catch {
    // localStorage may be unavailable (private mode, quota). Silent failure
    // is acceptable for a debug toggle.
  }
}
