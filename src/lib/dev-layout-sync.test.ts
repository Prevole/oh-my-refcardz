import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { syncLayoutToDev } from "./dev-layout-sync";
import type { SectionLayoutState } from "@/components/sheets/layout/layout-types";

const mockFetch = vi.fn();

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("fetch", mockFetch);
  mockFetch.mockResolvedValue({ ok: true });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  mockFetch.mockReset();
});

const sampleLayout: SectionLayoutState[] = [
  { cards: [{ colStart: 1, rowStart: 1, colSpan: 4, rowSpan: 2 }] },
];

describe("syncLayoutToDev", () => {
  it("debounces calls and only fires after 1 second", () => {
    syncLayoutToDev("git", sampleLayout);

    expect(mockFetch).not.toHaveBeenCalled();

    vi.advanceTimersByTime(500);
    expect(mockFetch).not.toHaveBeenCalled();

    vi.advanceTimersByTime(500);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("sends POST request with correct URL and body", () => {
    syncLayoutToDev("docker", sampleLayout);
    vi.advanceTimersByTime(1000);

    expect(mockFetch).toHaveBeenCalledWith("/api/dev/layouts/docker", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(sampleLayout),
    });
  });

  it("encodes slug in URL", () => {
    syncLayoutToDev("my-sheet", sampleLayout);
    vi.advanceTimersByTime(1000);

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/dev/layouts/my-sheet",
      expect.any(Object)
    );
  });

  it("cancels previous timer when called again for same slug", () => {
    syncLayoutToDev("git", sampleLayout);
    vi.advanceTimersByTime(500);

    const updatedLayout: SectionLayoutState[] = [
      { cards: [{ colStart: 5, rowStart: 1, colSpan: 6, rowSpan: 3 }] },
    ];
    syncLayoutToDev("git", updatedLayout);

    vi.advanceTimersByTime(500);
    expect(mockFetch).not.toHaveBeenCalled();

    vi.advanceTimersByTime(500);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledWith("/api/dev/layouts/git", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updatedLayout),
    });
  });

  it("handles multiple slugs independently", () => {
    syncLayoutToDev("git", sampleLayout);
    vi.advanceTimersByTime(500);

    syncLayoutToDev("docker", sampleLayout);
    vi.advanceTimersByTime(500);

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledWith("/api/dev/layouts/git", expect.any(Object));

    vi.advanceTimersByTime(500);
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(mockFetch).toHaveBeenLastCalledWith("/api/dev/layouts/docker", expect.any(Object));
  });

  it("does not throw when fetch fails", async () => {
    const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {});
    mockFetch.mockRejectedValueOnce(new Error("Network error"));

    syncLayoutToDev("git", sampleLayout);
    vi.advanceTimersByTime(1000);

    await vi.runAllTimersAsync();

    expect(consoleWarn).toHaveBeenCalledWith(
      "[dev] Failed to sync layout for git:",
      expect.any(Error)
    );

    consoleWarn.mockRestore();
  });
});
