import { describe, expect, it } from "vitest";
import { formatChangesCount } from "./format-changes-count";

describe("formatChangesCount", () => {
  it("returns the singular form for a single change", () => {
    expect(formatChangesCount(1)).toBe("1 change");
  });

  it("returns the plural form for two or more changes", () => {
    expect(formatChangesCount(2)).toBe("2 changes");
    expect(formatChangesCount(5)).toBe("5 changes");
    expect(formatChangesCount(42)).toBe("42 changes");
  });

  it("returns the plural form for zero (defensive default)", () => {
    expect(formatChangesCount(0)).toBe("0 changes");
  });
});
