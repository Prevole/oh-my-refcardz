/**
 * Persistence layer for the developer mode toggle. Extracted from the hook
 * so it can be unit-tested without a React renderer.
 *
 * Storage key: `omr.developer-mode` — string "1" when active, anything else
 * (including absent) means inactive.
 */

export const DEVELOPER_MODE_STORAGE_KEY = "omr.developer-mode";

export function readStoredDeveloperMode(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(DEVELOPER_MODE_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function writeStoredDeveloperMode(value: boolean): void {
  if (typeof window === "undefined") return;
  try {
    if (value) {
      window.localStorage.setItem(DEVELOPER_MODE_STORAGE_KEY, "1");
    } else {
      window.localStorage.removeItem(DEVELOPER_MODE_STORAGE_KEY);
    }
  } catch {
    // localStorage may be unavailable (private mode, quota). Silent failure
    // is acceptable for a developer-only toggle.
  }
}
