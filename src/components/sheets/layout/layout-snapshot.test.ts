import { describe, expect, it } from "vitest";
import { sortByLayoutOrder, type LayoutSnapshot } from "./layout-snapshot";

function snapshotOf(entries: Array<[string, number, number]>): LayoutSnapshot {
  const blocks = new Map<string, { x: number; y: number; w: number; h: number }>();
  for (const [id, x, y] of entries) {
    blocks.set(id, { x, y, w: 1, h: 1 });
  }
  return { blocks };
}

describe("sortByLayoutOrder", () => {
  it("returns input order when snapshot is empty", () => {
    const items = [
      { id: "a", title: "A" },
      { id: "b", title: "B" },
      { id: "c", title: "C" },
    ];
    const result = sortByLayoutOrder(items, { blocks: new Map() });
    expect(result.map((i) => i.id)).toEqual(["a", "b", "c"]);
  });

  it("sorts by Y then by X using the snapshot positions", () => {
    const items = [
      { id: "first-in-yaml", title: "1" },
      { id: "second-in-yaml", title: "2" },
      { id: "third-in-yaml", title: "3" },
    ];
    // Reverse the order in the layout: 3rd is on top, then 1st, then 2nd.
    const snapshot = snapshotOf([
      ["first-in-yaml", 0, 5],
      ["second-in-yaml", 12, 5],
      ["third-in-yaml", 0, 0],
    ]);

    const result = sortByLayoutOrder(items, snapshot);
    expect(result.map((i) => i.id)).toEqual(["third-in-yaml", "first-in-yaml", "second-in-yaml"]);
  });

  it("breaks Y ties by X (left-to-right)", () => {
    const items = [
      { id: "right", title: "R" },
      { id: "left", title: "L" },
      { id: "middle", title: "M" },
    ];
    const snapshot = snapshotOf([
      ["right", 24, 0],
      ["left", 0, 0],
      ["middle", 12, 0],
    ]);

    const result = sortByLayoutOrder(items, snapshot);
    expect(result.map((i) => i.id)).toEqual(["left", "middle", "right"]);
  });

  it("keeps stable order for items sharing identical positions", () => {
    const items = [
      { id: "a", title: "A" },
      { id: "b", title: "B" },
      { id: "c", title: "C" },
    ];
    const snapshot = snapshotOf([
      ["a", 0, 0],
      ["b", 0, 0],
      ["c", 0, 0],
    ]);

    const result = sortByLayoutOrder(items, snapshot);
    expect(result.map((i) => i.id)).toEqual(["a", "b", "c"]);
  });

  it("places items missing from the snapshot before snapshot-known ones", () => {
    const items = [
      { id: "missing-1", title: "?" },
      { id: "known-low", title: "K" },
      { id: "missing-2", title: "?" },
    ];
    const snapshot = snapshotOf([["known-low", 0, 10]]);

    const result = sortByLayoutOrder(items, snapshot);
    // Missing items keep their original relative order; the known item is
    // ordered against them by treating "missing" as "comes first".
    expect(result.map((i) => i.id)).toEqual(["missing-1", "missing-2", "known-low"]);
  });

  it("does not mutate the input array", () => {
    const items = [
      { id: "a", title: "A" },
      { id: "b", title: "B" },
    ];
    const snapshot = snapshotOf([
      ["a", 0, 5],
      ["b", 0, 0],
    ]);

    const before = items.map((i) => i.id);
    sortByLayoutOrder(items, snapshot);
    const after = items.map((i) => i.id);
    expect(after).toEqual(before);
  });
});
