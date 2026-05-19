import { describe, it, expect } from "vitest";
import { numberToDevId, createDevIdMap } from "./dev-id";

describe("numberToDevId", () => {
  it("converts 0 to A", () => {
    expect(numberToDevId(0)).toBe("A");
  });

  it("converts 1-25 to B-Z", () => {
    expect(numberToDevId(1)).toBe("B");
    expect(numberToDevId(25)).toBe("Z");
  });

  it("converts 26 to AA", () => {
    expect(numberToDevId(26)).toBe("AA");
  });

  it("converts 27 to AB", () => {
    expect(numberToDevId(27)).toBe("AB");
  });

  it("converts 51 to AZ", () => {
    expect(numberToDevId(51)).toBe("AZ");
  });

  it("converts 52 to BA", () => {
    expect(numberToDevId(52)).toBe("BA");
  });

  it("handles large numbers", () => {
    // 26 + 26*26 = 702 => AAA
    expect(numberToDevId(702)).toBe("AAA");
  });
});

describe("createDevIdMap", () => {
  it("assigns letters based on input order (YAML order)", () => {
    const blocks = [{ id: "block-3" }, { id: "block-1" }, { id: "block-2" }];

    const map = createDevIdMap(blocks);

    // Letters are assigned in input order, no sorting
    expect(map.get("block-3")).toBe("A"); // first in array
    expect(map.get("block-1")).toBe("B"); // second in array
    expect(map.get("block-2")).toBe("C"); // third in array
  });

  it("preserves input order without any sorting", () => {
    const blocks = [{ id: "d" }, { id: "c" }, { id: "b" }, { id: "a" }];

    const map = createDevIdMap(blocks);

    // Order is preserved as-is from the input array
    expect(map.get("d")).toBe("A");
    expect(map.get("c")).toBe("B");
    expect(map.get("b")).toBe("C");
    expect(map.get("a")).toBe("D");
  });

  it("returns empty map for empty input", () => {
    const map = createDevIdMap([]);
    expect(map.size).toBe(0);
  });
});
