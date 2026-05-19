import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { syncLayoutToDev } from "./dev-layout-sync";
import type { BlockLayoutState } from "@/components/sheets/layout/layout-types";

const mockFetch = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", mockFetch);
  mockFetch.mockResolvedValue({ ok: true });
});

afterEach(() => {
  vi.unstubAllGlobals();
  mockFetch.mockReset();
});

const sampleLayout: BlockLayoutState[] = [
  { id: "section", kind: "heading", colStart: 1, rowStart: 1, colSpan: 36, rowSpan: 2 },
  { id: "card", kind: "card", colStart: 1, rowStart: 3, colSpan: 4, rowSpan: 2 },
];

describe("syncLayoutToDev", () => {
  it("fires the request immediately on call", () => {
    syncLayoutToDev("git", sampleLayout);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("sends a POST with the correct URL and body", () => {
    syncLayoutToDev("docker", sampleLayout);

    expect(mockFetch).toHaveBeenCalledWith("/api/dev/layouts/docker", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(sampleLayout),
    });
  });

  it("URL-encodes the slug", () => {
    syncLayoutToDev("my sheet/v2", sampleLayout);

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/dev/layouts/my%20sheet%2Fv2",
      expect.any(Object)
    );
  });

  it("returns the fetch promise so callers can react to failures", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network error"));

    await expect(syncLayoutToDev("git", sampleLayout)).rejects.toThrow("Network error");
  });
});
