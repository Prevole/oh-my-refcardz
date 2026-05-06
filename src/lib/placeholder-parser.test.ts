import { describe, it, expect } from "vitest";
import {
  parsePlaceholders,
  hasPlaceholders,
  formatDisplayValue,
  buildCommand,
} from "./placeholder-parser";

describe("parsePlaceholders", () => {
  it("returns empty array for command without placeholders", () => {
    expect(parsePlaceholders("git status")).toEqual([]);
  });

  it("extracts placeholder without type as string", () => {
    const result = parsePlaceholders("git checkout <branch>");
    expect(result).toEqual([{ raw: "branch", name: "branch", type: "string" }]);
  });

  it("extracts placeholder with :string type", () => {
    const result = parsePlaceholders("git checkout <branch:string>");
    expect(result).toEqual([{ raw: "branch:string", name: "branch", type: "string" }]);
  });

  it("extracts placeholder with :int type", () => {
    const result = parsePlaceholders("git log -n <count:int>");
    expect(result).toEqual([{ raw: "count:int", name: "count", type: "int" }]);
  });

  it("extracts multiple placeholders", () => {
    const result = parsePlaceholders("git diff <commit1>...<commit2>");
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ raw: "commit1", name: "commit1", type: "string" });
    expect(result[1]).toEqual({ raw: "commit2", name: "commit2", type: "string" });
  });

  it("deduplicates repeated placeholders", () => {
    const result = parsePlaceholders("git diff <file> <file>");
    expect(result).toHaveLength(1);
  });

  it("treats unknown types as string", () => {
    const result = parsePlaceholders("cmd <arg:unknown>");
    expect(result).toEqual([{ raw: "arg:unknown", name: "arg", type: "string" }]);
  });

  it("handles placeholder with colon in name", () => {
    const result = parsePlaceholders("docker run <image:tag:string>");
    expect(result).toEqual([{ raw: "image:tag:string", name: "image:tag", type: "string" }]);
  });
});

describe("hasPlaceholders", () => {
  it("returns false for command without placeholders", () => {
    expect(hasPlaceholders("git status")).toBe(false);
  });

  it("returns true for command with placeholder", () => {
    expect(hasPlaceholders("git checkout <branch>")).toBe(true);
  });

  it("returns true for command with typed placeholder", () => {
    expect(hasPlaceholders("git log -n <count:int>")).toBe(true);
  });
});

describe("formatDisplayValue", () => {
  it("returns command as-is without placeholders", () => {
    expect(formatDisplayValue("git status")).toBe("git status");
  });

  it("keeps placeholder without type unchanged", () => {
    expect(formatDisplayValue("git checkout <branch>")).toBe("git checkout <branch>");
  });

  it("removes :type suffix from placeholder", () => {
    expect(formatDisplayValue("git log -n <count:int>")).toBe("git log -n <count>");
  });

  it("removes :string suffix from placeholder", () => {
    expect(formatDisplayValue("git checkout <branch:string>")).toBe("git checkout <branch>");
  });

  it("handles multiple placeholders", () => {
    const result = formatDisplayValue("git log -n <count:int> <branch:string>");
    expect(result).toBe("git log -n <count> <branch>");
  });

  it("preserves colons in placeholder name", () => {
    expect(formatDisplayValue("docker run <image:tag:string>")).toBe("docker run <image:tag>");
  });
});

describe("buildCommand", () => {
  it("returns command as-is without placeholders", () => {
    expect(buildCommand("git status", {})).toBe("git status");
  });

  it("substitutes placeholder value", () => {
    const result = buildCommand("git checkout <branch>", { branch: "main" });
    expect(result).toBe("git checkout main");
  });

  it("substitutes typed placeholder value using raw as key", () => {
    const result = buildCommand("git log -n <count:int>", { "count:int": "5" });
    expect(result).toBe("git log -n 5");
  });

  it("keeps placeholder name (without type) for empty values", () => {
    const result = buildCommand("git log -n <count:int>", { "count:int": "" });
    expect(result).toBe("git log -n <count>");
  });

  it("keeps placeholder name for missing values", () => {
    const result = buildCommand("git checkout <branch>", {});
    expect(result).toBe("git checkout <branch>");
  });

  it("substitutes multiple placeholders", () => {
    const result = buildCommand("git diff <commit1>...<commit2>", {
      commit1: "HEAD~3",
      commit2: "HEAD",
    });
    expect(result).toBe("git diff HEAD~3...HEAD");
  });
});
