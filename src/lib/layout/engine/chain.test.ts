import { describe, expect, it } from "vitest";
import { computeOperationChain } from "./chain";
import type { LayoutBlock } from "./types";

const block = (id: string, x: number, y: number, w: number, h: number): LayoutBlock => ({
  id,
  kind: "card",
  position: { x, y, w, h },
});

describe("computeOperationChain", () => {
  it("returns only the primary when no block is contiguous in the direction", () => {
    const blocks: LayoutBlock[] = [
      block("A", 0, 0, 2, 2),
      block("B", 10, 10, 2, 2),
    ];
    const chain = computeOperationChain("A", "east", blocks);
    expect(Array.from(chain)).toEqual(["A"]);
  });

  it("includes a directly contiguous neighbor in the direction", () => {
    const blocks: LayoutBlock[] = [
      block("A", 0, 0, 2, 2),
      block("B", 2, 0, 2, 2),
    ];
    const chain = computeOperationChain("A", "east", blocks);
    expect(Array.from(chain).sort()).toEqual(["A", "B"]);
  });

  it("does not include blocks contiguous in the opposite direction", () => {
    const blocks: LayoutBlock[] = [
      block("A", 5, 0, 2, 2),
      block("West", 3, 0, 2, 2), // contiguous to A on its west face
    ];
    const chain = computeOperationChain("A", "east", blocks);
    expect(Array.from(chain)).toEqual(["A"]);
  });

  it("propagates transitively through contiguous neighbors", () => {
    const blocks: LayoutBlock[] = [
      block("A", 0, 0, 2, 2),
      block("B", 2, 0, 2, 2),
      block("C", 4, 0, 2, 2),
    ];
    const chain = computeOperationChain("A", "east", blocks);
    expect(Array.from(chain).sort()).toEqual(["A", "B", "C"]);
  });

  it("includes multiple branches at the same level when both are contiguous", () => {
    // A faces east. B is east-above-overlap. C is east-below-overlap (both touch A's east face).
    const blocks: LayoutBlock[] = [
      block("A", 0, 2, 2, 4),
      block("B", 2, 0, 2, 4), // touches A.east with y-overlap rows 2..3
      block("C", 2, 4, 2, 4), // touches A.east with y-overlap rows 4..5
    ];
    const chain = computeOperationChain("A", "east", blocks);
    expect(Array.from(chain).sort()).toEqual(["A", "B", "C"]);
  });

  it("a full-width block agglomerates everything above it when chain direction is north", () => {
    const blocks: LayoutBlock[] = [
      block("A", 0, 5, 2, 2),
      block("Wide", 0, 3, 64, 2), // full width, contiguous north of A
      block("Above1", 0, 0, 4, 3), // contiguous to Wide's north face
      block("Above2", 10, 0, 4, 3),
      block("Above3", 30, 0, 4, 3),
    ];
    const chain = computeOperationChain("A", "north", blocks);
    expect(Array.from(chain).sort()).toEqual(["A", "Above1", "Above2", "Above3", "Wide"]);
  });

  it("works for the west direction", () => {
    const blocks: LayoutBlock[] = [
      block("A", 5, 0, 2, 2),
      block("West", 3, 0, 2, 2),
    ];
    const chain = computeOperationChain("A", "west", blocks);
    expect(Array.from(chain).sort()).toEqual(["A", "West"]);
  });

  it("returns an empty set when the primary id is unknown", () => {
    const chain = computeOperationChain("missing", "east", [block("A", 0, 0, 2, 2)]);
    expect(chain.size).toBe(0);
  });

  it("does not include the primary's own direct neighbors in opposite axis", () => {
    // direction = east; a block to the south should NOT join the chain.
    const blocks: LayoutBlock[] = [
      block("A", 0, 0, 2, 2),
      block("South", 0, 2, 2, 2),
    ];
    const chain = computeOperationChain("A", "east", blocks);
    expect(Array.from(chain)).toEqual(["A"]);
  });
});
