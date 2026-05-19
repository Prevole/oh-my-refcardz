import { describe, it, expect } from "vitest";
import { numberToDebugId, createDebugIdMap } from "./debug-id";

describe("numberToDebugId", () => {
  it("converts 0 to A", () => {
    expect(numberToDebugId(0)).toBe("A");
  });

  it("converts 1-25 to B-Z", () => {
    expect(numberToDebugId(1)).toBe("B");
    expect(numberToDebugId(25)).toBe("Z");
  });

  it("converts 26 to AA", () => {
    expect(numberToDebugId(26)).toBe("AA");
  });

  it("converts 27 to AB", () => {
    expect(numberToDebugId(27)).toBe("AB");
  });

  it("converts 51 to AZ", () => {
    expect(numberToDebugId(51)).toBe("AZ");
  });

  it("converts 52 to BA", () => {
    expect(numberToDebugId(52)).toBe("BA");
  });

  it("handles large numbers", () => {
    // 26 + 26*26 = 702 => AAA
    expect(numberToDebugId(702)).toBe("AAA");
  });
});

describe("createDebugIdMap", () => {
  it("assigns letters based on input order (YAML order)", () => {
    const blocks = [
      { id: "block-3" },
      { id: "block-1" },
      { id: "block-2" },
    ];

    const map = createDebugIdMap(blocks);

    // Letters are assigned in input order, no sorting
    expect(map.get("block-3")).toBe("A"); // first in array
    expect(map.get("block-1")).toBe("B"); // second in array
    expect(map.get("block-2")).toBe("C"); // third in array
  });

  it("preserves input order without any sorting", () => {
    const blocks = [
      { id: "d" },
      { id: "c" },
      { id: "b" },
      { id: "a" },
    ];

    const map = createDebugIdMap(blocks);

    // Order is preserved as-is from the input array
    expect(map.get("d")).toBe("A");
    expect(map.get("c")).toBe("B");
    expect(map.get("b")).toBe("C");
    expect(map.get("a")).toBe("D");
  });

  it("returns empty map for empty input", () => {
    const map = createDebugIdMap([]);
    expect(map.size).toBe(0);
  });
});
