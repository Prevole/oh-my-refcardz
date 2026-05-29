import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { POST } from "./route";
import type { BlockLayoutState } from "@/components/sheets/layout/layout-types";

vi.mock("node:fs/promises", () => ({
  default: {
    readdir: vi.fn(),
    readFile: vi.fn(),
    writeFile: vi.fn(),
  },
}));

import fs from "node:fs/promises";

const mockReaddir = vi.mocked(fs.readdir);
const mockReadFile = vi.mocked(fs.readFile);
const mockWriteFile = vi.mocked(fs.writeFile);

const originalNodeEnv = process.env.NODE_ENV;

let warnSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("NODE_ENV", "development");
  warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.stubEnv("NODE_ENV", originalNodeEnv ?? "");
  vi.unstubAllEnvs();
  warnSpy.mockRestore();
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

const sampleLayout: BlockLayoutState[] = [
  { id: "inspect-and-diff", kind: "heading", colStart: 1, rowStart: 1, colSpan: 64, rowSpan: 3 },
  { id: "status", kind: "card", colStart: 1, rowStart: 4, colSpan: 6, rowSpan: 4 },
];

const sampleSheetYaml = `title: Git
summary: Test
color: "#F1502F"
blocks:
  - heading:
      id: inspect-and-diff
      title: Inspect and Diff
  - card:
      id: status
      title: Status
      items:
        - entries:
            - command: git status
`;

describe("POST /api/dev/layouts/[slug]", () => {
  it("returns 404 when not in development", async () => {
    vi.stubEnv("NODE_ENV", "production");

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
    mockReadFile.mockResolvedValue(sampleSheetYaml);
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

  it("strips unknown fields from the body before writing", async () => {
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
    mockReadFile.mockResolvedValue(sampleSheetYaml);
    mockWriteFile.mockResolvedValue(undefined);

    const polluted = [
      {
        id: "inspect-and-diff",
        kind: "heading",
        colStart: 1,
        rowStart: 1,
        colSpan: 64,
        rowSpan: 3,
        // Extras that must not be persisted:
        minColSpan: 12,
        maxColSpan: 64,
        debugMarker: "do-not-persist",
      },
    ];

    const request = createMockRequest(polluted);
    const response = await POST(request, { params: createMockParams("git") });

    expect(response.status).toBe(200);
    expect(mockWriteFile).toHaveBeenCalledTimes(1);
    const writeContent = mockWriteFile.mock.calls[0][1];
    const persisted = JSON.parse(String(writeContent));
    expect(persisted).toEqual([
      { id: "inspect-and-diff", kind: "heading", colStart: 1, rowStart: 1, colSpan: 64, rowSpan: 3 },
    ]);
    expect(persisted[0]).not.toHaveProperty("minColSpan");
    expect(persisted[0]).not.toHaveProperty("maxColSpan");
    expect(persisted[0]).not.toHaveProperty("debugMarker");
  });

  it("clamps drifted values before writing", async () => {
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
    mockReadFile.mockResolvedValue(sampleSheetYaml);
    mockWriteFile.mockResolvedValue(undefined);

    const drifted = [
      // colSpan: 100 > max 64; rowSpan: 8 > heading max 3
      { id: "inspect-and-diff", kind: "heading", colStart: 1, rowStart: 1, colSpan: 100, rowSpan: 8 },
    ];

    const request = createMockRequest(drifted);
    const response = await POST(request, { params: createMockParams("git") });

    expect(response.status).toBe(200);
    const writeContent = mockWriteFile.mock.calls[0][1];
    const persisted = JSON.parse(String(writeContent));
    expect(persisted[0].colSpan).toBe(64);
    expect(persisted[0].rowSpan).toBe(3);
  });

  it("drops entries with unknown kinds before writing", async () => {
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
    mockReadFile.mockResolvedValue(sampleSheetYaml);
    mockWriteFile.mockResolvedValue(undefined);

    const mixed = [
      { id: "inspect-and-diff", kind: "heading", colStart: 1, rowStart: 1, colSpan: 64, rowSpan: 3 },
      { id: "x1", kind: "widget", colStart: 1, rowStart: 4, colSpan: 12, rowSpan: 4 },
    ];

    const request = createMockRequest(mixed);
    const response = await POST(request, { params: createMockParams("git") });

    expect(response.status).toBe(200);
    const writeContent = mockWriteFile.mock.calls[0][1];
    const persisted = JSON.parse(String(writeContent));
    expect(persisted).toHaveLength(1);
    expect(persisted[0].id).toBe("inspect-and-diff");
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
    mockReadFile.mockResolvedValue(sampleSheetYaml);
    mockWriteFile.mockResolvedValue(undefined);

    const request = createMockRequest(sampleLayout);
    const response = await POST(request, { params: createMockParams("python") });

    expect(response.status).toBe(200);
    expect(mockWriteFile).toHaveBeenCalledTimes(1);
    const [writePath] = mockWriteFile.mock.calls[0];
    expect(String(writePath)).toContain("python.layout.json");
  });
});
