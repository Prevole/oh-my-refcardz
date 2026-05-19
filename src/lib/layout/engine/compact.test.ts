import { describe, expect, it } from "vitest";
import { computeCompactTranslations } from "./compact";
import type { LayoutBlock } from "./types";

const block = (id: string, x: number, y: number, w: number, h: number): LayoutBlock => ({
  id,
  kind: "card",
  position: { x, y, w, h },
});

describe("computeCompactTranslations", () => {
  it("returns no translations when no block lies in the shrink direction", () => {
    const blocks: LayoutBlock[] = [block("A", 5, 5, 2, 2)];
    const translations = computeCompactTranslations(blocks, "A", "east");
    expect(translations.size).toBe(0);
  });

  it("pulls a single east-side neighbor toward the west by 1 cell", () => {
    // Compact is called AFTER a shrink. So the layout shown is the post-shrink state.
    // Pre-shrink: A=(0,0,2,2), B=(2,0,2,2). Post-shrink (A.east retreats 1): A=(0,0,1,2), B at (2,0,2,2).
    // But for compact, we need the CHAIN to detect B east of A. With A=(0,0,1,2) (post-shrink),
    // A.east-face = x=1. B.west = x=2. Not contiguous after shrink — gap of 1.
    //
    // Important: compact uses the chain BEFORE the shrink (i.e. on the original blocks). The chain
    // tells us "who was east of A". The chain function detects contiguity, so A and B must be
    // contiguous when computeOperationChain runs. That means compact is called on the PRE-shrink
    // chain, or we need to pass blocks where A and B are still contiguous.
    //
    // Engine sequence: (1) compute chain east from A. (2) shrink A's east edge. (3) translate
    // chain members west by 1. So chain is computed BEFORE shrink.
    //
    // For this pure function test, we simulate the pre-shrink state: A and B contiguous.
    const blocks: LayoutBlock[] = [block("A", 0, 0, 2, 2), block("B", 2, 0, 2, 2)];
    const translations = computeCompactTranslations(blocks, "A", "east");

    expect(translations.size).toBe(1);
    expect(translations.get("B")).toEqual({ dx: -1, dy: 0 });
  });

  it("pulls a transitive chain of east neighbors", () => {
    const blocks: LayoutBlock[] = [
      block("A", 0, 0, 2, 2),
      block("B", 2, 0, 2, 2),
      block("C", 4, 0, 2, 2),
    ];
    const translations = computeCompactTranslations(blocks, "A", "east");
    expect(translations.size).toBe(2);
    expect(translations.get("B")).toEqual({ dx: -1, dy: 0 });
    expect(translations.get("C")).toEqual({ dx: -1, dy: 0 });
  });

  it("works for the south edge: pulls south neighbors north", () => {
    const blocks: LayoutBlock[] = [block("A", 0, 0, 2, 2), block("B", 0, 2, 2, 2)];
    const translations = computeCompactTranslations(blocks, "A", "south");
    expect(translations.get("B")).toEqual({ dx: 0, dy: -1 });
  });

  it("works for the west edge: pulls west neighbors east", () => {
    const blocks: LayoutBlock[] = [block("A", 5, 0, 2, 2), block("B", 3, 0, 2, 2)];
    const translations = computeCompactTranslations(blocks, "A", "west");
    expect(translations.get("B")).toEqual({ dx: 1, dy: 0 });
  });

  it("works for the north edge: pulls north neighbors south", () => {
    const blocks: LayoutBlock[] = [block("A", 0, 5, 2, 2), block("B", 0, 3, 2, 2)];
    const translations = computeCompactTranslations(blocks, "A", "north");
    expect(translations.get("B")).toEqual({ dx: 0, dy: 1 });
  });
});
