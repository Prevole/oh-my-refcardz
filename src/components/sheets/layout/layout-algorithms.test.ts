import { describe, it, expect } from "vitest";
import {
  clamp,
  pointerToGridPosition,
  hasCollision,
  markOccupied,
  clampCardLayoutToGrid,
  placeCardAtNearestSlot,
  resolveBlockLayout,
} from "./layout-algorithms";
import { GRID_COLUMNS, GRID_GAP_PX } from "../sheet-grid";
import { MAX_ROW_SPAN } from "./layout-types";

describe("clamp", () => {
  it("returns value when within range", () => {
    expect(clamp(5, 1, 10)).toBe(5);
  });

  it("returns min when value is below range", () => {
    expect(clamp(-5, 1, 10)).toBe(1);
  });

  it("returns max when value is above range", () => {
    expect(clamp(15, 1, 10)).toBe(10);
  });

  it("handles equal min and max", () => {
    expect(clamp(5, 3, 3)).toBe(3);
  });

  it("handles negative ranges", () => {
    expect(clamp(-5, -10, -1)).toBe(-5);
    expect(clamp(-15, -10, -1)).toBe(-10);
    expect(clamp(0, -10, -1)).toBe(-1);
  });
});

describe("pointerToGridPosition", () => {
  const mockGridRect = {
    left: 100,
    top: 200,
    width: 1000,
    height: 800,
  } as DOMRect;

  const unitSize = 80;

  it("calculates position for pointer at grid origin", () => {
    const result = pointerToGridPosition(100, 200, mockGridRect, unitSize, 1);
    expect(result.colStart).toBe(1);
    expect(result.rowStart).toBe(1);
  });

  it("calculates position for pointer in second column", () => {
    const pitch = unitSize + GRID_GAP_PX;
    const result = pointerToGridPosition(100 + pitch, 200, mockGridRect, unitSize, 1);
    expect(result.colStart).toBe(2);
    expect(result.rowStart).toBe(1);
  });

  it("calculates position for pointer in second row", () => {
    const pitch = unitSize + GRID_GAP_PX;
    const result = pointerToGridPosition(100, 200 + pitch, mockGridRect, unitSize, 1);
    expect(result.colStart).toBe(1);
    expect(result.rowStart).toBe(2);
  });

  it("clamps colStart to prevent card overflow beyond grid", () => {
    const colSpan = 4;
    const result = pointerToGridPosition(4000, 200, mockGridRect, unitSize, colSpan);
    expect(result.colStart).toBe(GRID_COLUMNS - colSpan + 1);
  });

  it("clamps colStart to minimum of 1", () => {
    const result = pointerToGridPosition(-500, 200, mockGridRect, unitSize, 1);
    expect(result.colStart).toBe(1);
  });

  it("clamps rowStart to minimum of 1", () => {
    const result = pointerToGridPosition(100, -500, mockGridRect, unitSize, 1);
    expect(result.rowStart).toBe(1);
  });
});

describe("hasCollision", () => {
  it("returns false for empty occupied set", () => {
    const occupied = new Set<string>();
    const card = { colStart: 1, rowStart: 1, colSpan: 2, rowSpan: 2 };
    expect(hasCollision(occupied, card)).toBe(false);
  });

  it("returns true when any cell is occupied", () => {
    const occupied = new Set<string>(["2:2"]);
    const card = { colStart: 1, rowStart: 1, colSpan: 2, rowSpan: 2 };
    expect(hasCollision(occupied, card)).toBe(true);
  });

  it("returns false when adjacent cells are occupied but not overlapping", () => {
    const occupied = new Set<string>(["3:1", "1:3"]);
    const card = { colStart: 1, rowStart: 1, colSpan: 2, rowSpan: 2 };
    expect(hasCollision(occupied, card)).toBe(false);
  });
});

describe("markOccupied", () => {
  it("marks all cells of a card as occupied", () => {
    const occupied = new Set<string>();
    const card = { colStart: 1, rowStart: 1, colSpan: 2, rowSpan: 2 };
    markOccupied(occupied, card);

    expect(occupied.has("1:1")).toBe(true);
    expect(occupied.has("1:2")).toBe(true);
    expect(occupied.has("2:1")).toBe(true);
    expect(occupied.has("2:2")).toBe(true);
    expect(occupied.size).toBe(4);
  });

  it("adds to existing occupied cells", () => {
    const occupied = new Set<string>(["5:5"]);
    const card = { colStart: 1, rowStart: 1, colSpan: 1, rowSpan: 1 };
    markOccupied(occupied, card);

    expect(occupied.has("5:5")).toBe(true);
    expect(occupied.has("1:1")).toBe(true);
    expect(occupied.size).toBe(2);
  });
});

describe("clampCardLayoutToGrid", () => {
  it("returns card unchanged when within bounds", () => {
    const card = { colStart: 3, rowStart: 2, colSpan: 4, rowSpan: 5 };
    const result = clampCardLayoutToGrid(card);
    expect(result).toEqual(card);
  });

  it("clamps colSpan to GRID_COLUMNS", () => {
    const card = { colStart: 1, rowStart: 1, colSpan: 40, rowSpan: 2 };
    const result = clampCardLayoutToGrid(card);
    expect(result.colSpan).toBe(GRID_COLUMNS);
  });

  it("clamps rowSpan to MAX_ROW_SPAN", () => {
    const card = { colStart: 1, rowStart: 1, colSpan: 2, rowSpan: 100 };
    const result = clampCardLayoutToGrid(card);
    expect(result.rowSpan).toBe(MAX_ROW_SPAN);
  });

  it("clamps colStart so card fits in grid", () => {
    const card = { colStart: 40, rowStart: 1, colSpan: 4, rowSpan: 2 };
    const result = clampCardLayoutToGrid(card);
    expect(result.colStart).toBe(GRID_COLUMNS - 4 + 1);
  });

  it("clamps colStart to minimum of 1", () => {
    const card = { colStart: -5, rowStart: 1, colSpan: 2, rowSpan: 2 };
    const result = clampCardLayoutToGrid(card);
    expect(result.colStart).toBe(1);
  });

  it("clamps rowStart to minimum of 1", () => {
    const card = { colStart: 1, rowStart: -3, colSpan: 2, rowSpan: 2 };
    const result = clampCardLayoutToGrid(card);
    expect(result.rowStart).toBe(1);
  });

  it("clamps span values to minimum of 1", () => {
    const card = { colStart: 1, rowStart: 1, colSpan: 0, rowSpan: -1 };
    const result = clampCardLayoutToGrid(card);
    expect(result.colSpan).toBe(1);
    expect(result.rowSpan).toBe(1);
  });
});

describe("placeCardAtNearestSlot", () => {
  it("places card at preferred position when slot is free", () => {
    const occupied = new Set<string>();
    const card = { colStart: 3, rowStart: 2, colSpan: 2, rowSpan: 2 };
    const result = placeCardAtNearestSlot(card, occupied);
    expect(result.colStart).toBe(3);
    expect(result.rowStart).toBe(2);
  });

  it("finds next available column in same row", () => {
    const occupied = new Set<string>();
    for (let col = 1; col <= 4; col++) {
      occupied.add(`${col}:1`);
    }
    const card = { colStart: 1, rowStart: 1, colSpan: 2, rowSpan: 1 };
    const result = placeCardAtNearestSlot(card, occupied);
    expect(result.colStart).toBe(5);
    expect(result.rowStart).toBe(1);
  });

  it("moves to next row when current row is full", () => {
    const occupied = new Set<string>();
    for (let col = 1; col <= GRID_COLUMNS; col++) {
      occupied.add(`${col}:1`);
    }
    const card = { colStart: 1, rowStart: 1, colSpan: 2, rowSpan: 1 };
    const result = placeCardAtNearestSlot(card, occupied);
    expect(result.colStart).toBe(1);
    expect(result.rowStart).toBe(2);
  });

  it("respects colSpan when finding slot", () => {
    const occupied = new Set<string>();
    for (let col = 1; col <= GRID_COLUMNS - 2; col++) {
      occupied.add(`${col}:1`);
    }
    const card = { colStart: 1, rowStart: 1, colSpan: 4, rowSpan: 1 };
    const result = placeCardAtNearestSlot(card, occupied);
    expect(result.rowStart).toBe(2);
    expect(result.colStart).toBe(1);
  });
});

describe("resolveBlockLayout", () => {
  it("places non-overlapping blocks without changes", () => {
    const cards = [
      { id: "a", kind: "card", colStart: 1, rowStart: 1, colSpan: 4, rowSpan: 2 },
      { id: "b", kind: "card", colStart: 5, rowStart: 1, colSpan: 4, rowSpan: 2 },
    ];
    const result = resolveBlockLayout(cards);
    expect(result[0]).toEqual(cards[0]);
    expect(result[1]).toEqual(cards[1]);
  });

  it("repositions overlapping blocks", () => {
    const cards = [
      { id: "a", kind: "card", colStart: 1, rowStart: 1, colSpan: 6, rowSpan: 2 },
      { id: "b", kind: "card", colStart: 1, rowStart: 1, colSpan: 6, rowSpan: 2 },
    ];
    const result = resolveBlockLayout(cards);
    expect(result[0].colStart).toBe(1);
    expect(result[0].rowStart).toBe(1);
    expect(result[1].colStart).toBe(7);
    expect(result[1].rowStart).toBe(1);
  });

  it("respects pinned block position", () => {
    const cards = [
      { id: "a", kind: "card", colStart: 1, rowStart: 1, colSpan: 4, rowSpan: 2 },
      { id: "b", kind: "card", colStart: 5, rowStart: 1, colSpan: 4, rowSpan: 2 },
    ];
    const pinnedLayout = { colStart: 1, rowStart: 1, colSpan: 4, rowSpan: 2 };
    const result = resolveBlockLayout(cards, "b", pinnedLayout);
    expect(result[1].colStart).toBe(1);
    expect(result[1].rowStart).toBe(1);
    expect(result[0].colStart).toBe(5);
  });

  it("handles empty block array", () => {
    const result = resolveBlockLayout([]);
    expect(result).toEqual([]);
  });

  it("clamps invalid block positions during resolution", () => {
    const cards = [
      { id: "a", kind: "card", colStart: -5, rowStart: -2, colSpan: 100, rowSpan: 100 },
    ];
    const result = resolveBlockLayout(cards);
    expect(result[0].colStart).toBeGreaterThanOrEqual(1);
    expect(result[0].rowStart).toBeGreaterThanOrEqual(1);
    expect(result[0].colSpan).toBeLessThanOrEqual(GRID_COLUMNS);
    expect(result[0].rowSpan).toBeLessThanOrEqual(MAX_ROW_SPAN);
  });

  it("keeps headings fixed when a card is reflowed", () => {
    const blocks = [
      { id: "heading", kind: "heading", colStart: 1, rowStart: 1, colSpan: 36, rowSpan: 2 },
      { id: "card-a", kind: "card", colStart: 1, rowStart: 3, colSpan: 12, rowSpan: 4 },
      { id: "card-b", kind: "card", colStart: 13, rowStart: 3, colSpan: 12, rowSpan: 4 },
    ] as const;

    const result = resolveBlockLayout([...blocks], "card-a", {
      colStart: 1,
      rowStart: 1,
      colSpan: 12,
      rowSpan: 4,
    });

    expect(result.find((block) => block.id === "heading")).toMatchObject({
      colStart: 1,
      rowStart: 1,
      colSpan: 36,
      rowSpan: 2,
    });
    expect(result.find((block) => block.id === "card-a")?.rowStart).toBeGreaterThanOrEqual(3);
  });

  it("allows a pinned heading to move when the heading itself is manipulated", () => {
    const blocks = [
      { id: "heading", kind: "heading", colStart: 1, rowStart: 1, colSpan: 36, rowSpan: 2 },
      { id: "card-a", kind: "card", colStart: 1, rowStart: 3, colSpan: 12, rowSpan: 4 },
    ] as const;

    const result = resolveBlockLayout([...blocks], "heading", {
      colStart: 1,
      rowStart: 5,
      colSpan: 36,
      rowSpan: 2,
    });

    expect(result.find((block) => block.id === "heading")).toMatchObject({ rowStart: 5 });
  });
});
