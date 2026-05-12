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
  it("assigns letters based on visual order (top-to-bottom, left-to-right)", () => {
    const blocks = [
      { id: "block-3", position: { x: 0, y: 2 } },
      { id: "block-1", position: { x: 0, y: 0 } },
      { id: "block-2", position: { x: 2, y: 0 } },
    ];

    const map = createDebugIdMap(blocks);

    // block-1 is at (0,0) -> first -> A
    // block-2 is at (2,0) -> same row, right -> B
    // block-3 is at (0,2) -> below -> C
    expect(map.get("block-1")).toBe("A");
    expect(map.get("block-2")).toBe("B");
    expect(map.get("block-3")).toBe("C");
  });

  it("sorts by Y first, then X", () => {
    const blocks = [
      { id: "d", position: { x: 3, y: 1 } },
      { id: "c", position: { x: 0, y: 1 } },
      { id: "b", position: { x: 2, y: 0 } },
      { id: "a", position: { x: 0, y: 0 } },
    ];

    const map = createDebugIdMap(blocks);

    expect(map.get("a")).toBe("A"); // (0,0)
    expect(map.get("b")).toBe("B"); // (2,0)
    expect(map.get("c")).toBe("C"); // (0,1)
    expect(map.get("d")).toBe("D"); // (3,1)
  });

  it("returns empty map for empty input", () => {
    const map = createDebugIdMap([]);
    expect(map.size).toBe(0);
  });
});
