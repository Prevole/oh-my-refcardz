import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEBUG_OVERLAY_STORAGE_KEY,
  readStoredDebugOverlay,
  writeStoredDebugOverlay,
} from "./debug-overlay-storage";

type FakeStorage = {
  store: Map<string, string>;
  getItem: (k: string) => string | null;
  setItem: (k: string, v: string) => void;
  removeItem: (k: string) => void;
};

function makeFakeStorage(): FakeStorage {
  const store = new Map<string, string>();
  return {
    store,
    getItem: (k) => (store.has(k) ? store.get(k)! : null),
    setItem: (k, v) => {
      store.set(k, v);
    },
    removeItem: (k) => {
      store.delete(k);
    },
  };
}

describe("debug-overlay-storage", () => {
  const originalWindow = (globalThis as { window?: unknown }).window;
  let storage: FakeStorage;

  beforeEach(() => {
    storage = makeFakeStorage();
    (globalThis as { window: { localStorage: FakeStorage } }).window = {
      localStorage: storage,
    };
  });

  afterEach(() => {
    if (typeof originalWindow === "undefined") {
      delete (globalThis as { window?: unknown }).window;
    } else {
      (globalThis as { window?: unknown }).window = originalWindow;
    }
  });

  describe("readStoredDebugOverlay", () => {
    it("returns false when nothing is stored", () => {
      expect(readStoredDebugOverlay()).toBe(false);
    });

    it("returns true when storage value is exactly '1'", () => {
      storage.store.set(DEBUG_OVERLAY_STORAGE_KEY, "1");
      expect(readStoredDebugOverlay()).toBe(true);
    });

    it("returns false for any other stored value", () => {
      storage.store.set(DEBUG_OVERLAY_STORAGE_KEY, "true");
      expect(readStoredDebugOverlay()).toBe(false);
      storage.store.set(DEBUG_OVERLAY_STORAGE_KEY, "0");
      expect(readStoredDebugOverlay()).toBe(false);
      storage.store.set(DEBUG_OVERLAY_STORAGE_KEY, "");
      expect(readStoredDebugOverlay()).toBe(false);
    });

    it("returns false when window is undefined (SSR safe)", () => {
      delete (globalThis as { window?: unknown }).window;
      expect(readStoredDebugOverlay()).toBe(false);
    });

    it("returns false when localStorage access throws", () => {
      (globalThis as { window: { localStorage: { getItem: () => never } } }).window = {
        localStorage: {
          getItem: () => {
            throw new Error("denied");
          },
        },
      };
      expect(readStoredDebugOverlay()).toBe(false);
    });
  });

  describe("writeStoredDebugOverlay", () => {
    it("writes '1' when enabling", () => {
      writeStoredDebugOverlay(true);
      expect(storage.store.get(DEBUG_OVERLAY_STORAGE_KEY)).toBe("1");
    });

    it("removes the key when disabling", () => {
      storage.store.set(DEBUG_OVERLAY_STORAGE_KEY, "1");
      writeStoredDebugOverlay(false);
      expect(storage.store.has(DEBUG_OVERLAY_STORAGE_KEY)).toBe(false);
    });

    it("is a no-op when window is undefined", () => {
      delete (globalThis as { window?: unknown }).window;
      expect(() => writeStoredDebugOverlay(true)).not.toThrow();
    });

    it("silently absorbs storage errors", () => {
      const setSpy = vi.fn(() => {
        throw new Error("quota");
      });
      (globalThis as {
        window: { localStorage: { setItem: () => never; removeItem: () => never } };
      }).window = {
        localStorage: {
          setItem: setSpy,
          removeItem: setSpy,
        },
      };
      expect(() => writeStoredDebugOverlay(true)).not.toThrow();
      expect(() => writeStoredDebugOverlay(false)).not.toThrow();
      expect(setSpy).toHaveBeenCalledTimes(2);
    });

    it("round-trips through read", () => {
      writeStoredDebugOverlay(true);
      expect(readStoredDebugOverlay()).toBe(true);
      writeStoredDebugOverlay(false);
      expect(readStoredDebugOverlay()).toBe(false);
    });
  });
});
