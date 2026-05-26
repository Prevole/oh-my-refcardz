import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEVELOPER_MODE_STORAGE_KEY,
  readStoredDeveloperMode,
  writeStoredDeveloperMode,
} from "./dev-mode-storage";

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

describe("dev-mode-storage", () => {
  const originalWindow = (globalThis as { window?: unknown }).window;
  let storage: FakeStorage;

  beforeEach(() => {
    storage = makeFakeStorage();
    (globalThis as unknown as { window: { localStorage: FakeStorage } }).window = {
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

  describe("readStoredDeveloperMode", () => {
    it("returns false when nothing is stored", () => {
      expect(readStoredDeveloperMode()).toBe(false);
    });

    it("returns true when storage value is exactly '1'", () => {
      storage.store.set(DEVELOPER_MODE_STORAGE_KEY, "1");
      expect(readStoredDeveloperMode()).toBe(true);
    });

    it("returns false for any other stored value", () => {
      storage.store.set(DEVELOPER_MODE_STORAGE_KEY, "true");
      expect(readStoredDeveloperMode()).toBe(false);
      storage.store.set(DEVELOPER_MODE_STORAGE_KEY, "0");
      expect(readStoredDeveloperMode()).toBe(false);
      storage.store.set(DEVELOPER_MODE_STORAGE_KEY, "");
      expect(readStoredDeveloperMode()).toBe(false);
    });

    it("returns false when window is undefined (SSR safe)", () => {
      delete (globalThis as { window?: unknown }).window;
      expect(readStoredDeveloperMode()).toBe(false);
    });

    it("returns false when localStorage access throws", () => {
      (globalThis as unknown as { window: { localStorage: { getItem: () => never } } }).window = {
        localStorage: {
          getItem: () => {
            throw new Error("denied");
          },
        },
      };
      expect(readStoredDeveloperMode()).toBe(false);
    });
  });

  describe("writeStoredDeveloperMode", () => {
    it("writes '1' when enabling", () => {
      writeStoredDeveloperMode(true);
      expect(storage.store.get(DEVELOPER_MODE_STORAGE_KEY)).toBe("1");
    });

    it("removes the key when disabling", () => {
      storage.store.set(DEVELOPER_MODE_STORAGE_KEY, "1");
      writeStoredDeveloperMode(false);
      expect(storage.store.has(DEVELOPER_MODE_STORAGE_KEY)).toBe(false);
    });

    it("is a no-op when window is undefined", () => {
      delete (globalThis as { window?: unknown }).window;
      expect(() => writeStoredDeveloperMode(true)).not.toThrow();
    });

    it("silently absorbs storage errors", () => {
      const setSpy = vi.fn(() => {
        throw new Error("quota");
      });
      (globalThis as unknown as {
        window: { localStorage: { setItem: () => never; removeItem: () => never } };
      }).window = {
        localStorage: {
          setItem: setSpy,
          removeItem: setSpy,
        },
      };
      expect(() => writeStoredDeveloperMode(true)).not.toThrow();
      expect(() => writeStoredDeveloperMode(false)).not.toThrow();
      expect(setSpy).toHaveBeenCalledTimes(2);
    });

    it("round-trips through read", () => {
      writeStoredDeveloperMode(true);
      expect(readStoredDeveloperMode()).toBe(true);
      writeStoredDeveloperMode(false);
      expect(readStoredDeveloperMode()).toBe(false);
    });
  });
});
