import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { POST, DELETE } from "./route";
import type { SectionLayoutState } from "@/components/sheets/layout/layout-types";

vi.mock("node:fs/promises", () => ({
  default: {
    readdir: vi.fn(),
    writeFile: vi.fn(),
    unlink: vi.fn(),
  },
}));

import fs from "node:fs/promises";

const mockReaddir = vi.mocked(fs.readdir);
const mockWriteFile = vi.mocked(fs.writeFile);
const mockUnlink = vi.mocked(fs.unlink);

const originalNodeEnv = process.env.NODE_ENV;

beforeEach(() => {
  vi.resetAllMocks();
  process.env.NODE_ENV = "development";
});

afterEach(() => {
  process.env.NODE_ENV = originalNodeEnv;
});

function createMockRequest(body: unknown): Request {
  return new Request("http://localhost/api/dev/layouts/git", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function createMockParams(slug: string): Promise<{ slug: string }> {
  return Promise.resolve({ slug });
}

const sampleLayout: SectionLayoutState[] = [
  { cards: [{ colStart: 1, rowStart: 1, colSpan: 4, rowSpan: 2 }] },
];

describe("POST /api/dev/layouts/[slug]", () => {
  it("returns 404 when not in development", async () => {
    process.env.NODE_ENV = "production";

    const request = createMockRequest(sampleLayout);
    const response = await POST(request, { params: createMockParams("git") });

    expect(response.status).toBe(404);
  });

  it("returns 404 when sheet YAML file not found", async () => {
    mockReaddir.mockResolvedValue([]);

    const request = createMockRequest(sampleLayout);
    const response = await POST(request, { params: createMockParams("nonexistent") });

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error).toBe("Sheet not found");
  });

  it("writes layout JSON file when sheet exists", async () => {
    mockReaddir.mockImplementation(async (dir) => {
      const dirStr = String(dir);
      if (dirStr.endsWith("cheatsheets")) {
        return [
          { name: "01-tooling", isDirectory: () => true, isFile: () => false },
        ] as unknown as Awaited<ReturnType<typeof fs.readdir>>;
      }
      if (dirStr.endsWith("01-tooling")) {
        return [
          { name: "git.yaml", isDirectory: () => false, isFile: () => true },
        ] as unknown as Awaited<ReturnType<typeof fs.readdir>>;
      }
      return [];
    });
    mockWriteFile.mockResolvedValue(undefined);

    const request = createMockRequest(sampleLayout);
    const response = await POST(request, { params: createMockParams("git") });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.path).toContain("git.layout.json");

    expect(mockWriteFile).toHaveBeenCalledTimes(1);
    const [writePath, writeContent] = mockWriteFile.mock.calls[0];
    expect(String(writePath)).toContain("git.layout.json");
    expect(writeContent).toBe(JSON.stringify(sampleLayout, null, 2) + "\n");
  });

  it("searches subdirectories recursively", async () => {
    mockReaddir.mockImplementation(async (dir) => {
      const dirStr = String(dir);
      if (dirStr.endsWith("cheatsheets")) {
        return [
          { name: "01-tooling", isDirectory: () => true, isFile: () => false },
          { name: "02-languages", isDirectory: () => true, isFile: () => false },
        ] as unknown as Awaited<ReturnType<typeof fs.readdir>>;
      }
      if (dirStr.endsWith("01-tooling")) {
        return [
          { name: "docker.yaml", isDirectory: () => false, isFile: () => true },
        ] as unknown as Awaited<ReturnType<typeof fs.readdir>>;
      }
      if (dirStr.endsWith("02-languages")) {
        return [
          { name: "python.yaml", isDirectory: () => false, isFile: () => true },
        ] as unknown as Awaited<ReturnType<typeof fs.readdir>>;
      }
      return [];
    });
    mockWriteFile.mockResolvedValue(undefined);

    const request = createMockRequest(sampleLayout);
    const response = await POST(request, { params: createMockParams("python") });

    expect(response.status).toBe(200);
    expect(mockWriteFile).toHaveBeenCalledTimes(1);
    const [writePath] = mockWriteFile.mock.calls[0];
    expect(String(writePath)).toContain("python.layout.json");
  });
});

describe("DELETE /api/dev/layouts/[slug]", () => {
  it("returns 404 when not in development", async () => {
    process.env.NODE_ENV = "production";

    const request = new Request("http://localhost/api/dev/layouts/git", { method: "DELETE" });
    const response = await DELETE(request, { params: createMockParams("git") });

    expect(response.status).toBe(404);
  });

  it("returns 404 when sheet YAML file not found", async () => {
    mockReaddir.mockResolvedValue([]);

    const request = new Request("http://localhost/api/dev/layouts/git", { method: "DELETE" });
    const response = await DELETE(request, { params: createMockParams("nonexistent") });

    expect(response.status).toBe(404);
  });

  it("deletes layout JSON file when it exists", async () => {
    mockReaddir.mockImplementation(async (dir) => {
      const dirStr = String(dir);
      if (dirStr.endsWith("cheatsheets")) {
        return [
          { name: "01-tooling", isDirectory: () => true, isFile: () => false },
        ] as unknown as Awaited<ReturnType<typeof fs.readdir>>;
      }
      if (dirStr.endsWith("01-tooling")) {
        return [
          { name: "git.yaml", isDirectory: () => false, isFile: () => true },
        ] as unknown as Awaited<ReturnType<typeof fs.readdir>>;
      }
      return [];
    });
    mockUnlink.mockResolvedValue(undefined);

    const request = new Request("http://localhost/api/dev/layouts/git", { method: "DELETE" });
    const response = await DELETE(request, { params: createMockParams("git") });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.deleted).toContain("git.layout.json");

    expect(mockUnlink).toHaveBeenCalledTimes(1);
  });

  it("returns success with null deleted when file does not exist", async () => {
    mockReaddir.mockImplementation(async (dir) => {
      const dirStr = String(dir);
      if (dirStr.endsWith("cheatsheets")) {
        return [
          { name: "01-tooling", isDirectory: () => true, isFile: () => false },
        ] as unknown as Awaited<ReturnType<typeof fs.readdir>>;
      }
      if (dirStr.endsWith("01-tooling")) {
        return [
          { name: "git.yaml", isDirectory: () => false, isFile: () => true },
        ] as unknown as Awaited<ReturnType<typeof fs.readdir>>;
      }
      return [];
    });
    const enoentError = new Error("ENOENT") as NodeJS.ErrnoException;
    enoentError.code = "ENOENT";
    mockUnlink.mockRejectedValue(enoentError);

    const request = new Request("http://localhost/api/dev/layouts/git", { method: "DELETE" });
    const response = await DELETE(request, { params: createMockParams("git") });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.deleted).toBeNull();
  });

  it("rethrows non-ENOENT errors", async () => {
    mockReaddir.mockImplementation(async (dir) => {
      const dirStr = String(dir);
      if (dirStr.endsWith("cheatsheets")) {
        return [
          { name: "01-tooling", isDirectory: () => true, isFile: () => false },
        ] as unknown as Awaited<ReturnType<typeof fs.readdir>>;
      }
      if (dirStr.endsWith("01-tooling")) {
        return [
          { name: "git.yaml", isDirectory: () => false, isFile: () => true },
        ] as unknown as Awaited<ReturnType<typeof fs.readdir>>;
      }
      return [];
    });
    const permissionError = new Error("EACCES") as NodeJS.ErrnoException;
    permissionError.code = "EACCES";
    mockUnlink.mockRejectedValue(permissionError);

    const request = new Request("http://localhost/api/dev/layouts/git", { method: "DELETE" });

    await expect(DELETE(request, { params: createMockParams("git") })).rejects.toThrow("EACCES");
  });
});
