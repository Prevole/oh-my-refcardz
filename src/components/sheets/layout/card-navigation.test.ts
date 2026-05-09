import { describe, it, expect } from "vitest";
import { getAllCards, findCardInDirection, findFirstCard, validateFocus } from "./card-navigation";
import type { BlockLayoutState } from "./layout-types";

describe("Layout keyboard navigation helpers", () => {
  describe("getAllCards", () => {
    it("returns empty array for empty layouts", () => {
      expect(getAllCards([])).toEqual([]);
    });

    it("returns all layout blocks", () => {
      const layouts: BlockLayoutState[] = [
        { id: "heading", kind: "heading", colStart: 1, rowStart: 1, colSpan: 36, rowSpan: 2 },
        { id: "card-1", kind: "card", colStart: 1, rowStart: 3, colSpan: 2, rowSpan: 1 },
        { id: "card-2", kind: "card", colStart: 3, rowStart: 3, colSpan: 2, rowSpan: 1 },
      ];

      const result = getAllCards(layouts);
      expect(result).toHaveLength(3);
      expect(result[0].blockId).toBe("heading");
      expect(result[1].blockId).toBe("card-1");
      expect(result[2].blockId).toBe("card-2");
    });
  });

  describe("findFirstCard", () => {
    it("returns null for empty layouts", () => {
      expect(findFirstCard([])).toBeNull();
    });

    it("returns the only heading when it is the only layout block", () => {
      expect(findFirstCard([{ id: "heading", kind: "heading", colStart: 1, rowStart: 1, colSpan: 36, rowSpan: 2 }])).toEqual({ blockId: "heading" });
    });

    it("returns the top-left block", () => {
      const layouts: BlockLayoutState[] = [
        { id: "heading", kind: "heading", colStart: 1, rowStart: 1, colSpan: 36, rowSpan: 2 },
        { id: "card-a", kind: "card", colStart: 5, rowStart: 4, colSpan: 2, rowSpan: 1 },
        { id: "card-b", kind: "card", colStart: 1, rowStart: 3, colSpan: 2, rowSpan: 1 },
        { id: "card-c", kind: "card", colStart: 3, rowStart: 3, colSpan: 2, rowSpan: 1 },
      ];

      expect(findFirstCard(layouts)).toEqual({ blockId: "heading" });
    });
  });

  describe("validateFocus", () => {
    const layouts: BlockLayoutState[] = [
      { id: "heading", kind: "heading", colStart: 1, rowStart: 1, colSpan: 36, rowSpan: 2 },
      { id: "card-a", kind: "card", colStart: 1, rowStart: 3, colSpan: 2, rowSpan: 1 },
    ];

    it("returns null for null focus", () => {
      expect(validateFocus(null, layouts)).toBeNull();
    });

    it("returns the focus if valid for a card", () => {
      expect(validateFocus({ blockId: "card-a" }, layouts)).toEqual({ blockId: "card-a" });
    });

    it("returns the focus if valid for a heading", () => {
      expect(validateFocus({ blockId: "heading" }, layouts)).toEqual({ blockId: "heading" });
    });

    it("returns null for unknown blocks", () => {
      expect(validateFocus({ blockId: "missing" }, layouts)).toBeNull();
    });
  });

  describe("findCardInDirection", () => {
    const createGridLayout = (): BlockLayoutState[] => [
      { id: "heading", kind: "heading", colStart: 1, rowStart: 1, colSpan: 36, rowSpan: 2 },
      { id: "card-0", kind: "card", colStart: 1, rowStart: 3, colSpan: 4, rowSpan: 1 },
      { id: "card-1", kind: "card", colStart: 5, rowStart: 3, colSpan: 4, rowSpan: 1 },
      { id: "card-2", kind: "card", colStart: 1, rowStart: 4, colSpan: 4, rowSpan: 1 },
      { id: "card-3", kind: "card", colStart: 5, rowStart: 4, colSpan: 4, rowSpan: 1 },
    ];

    it("navigates down from heading to the nearest block below", () => {
      const blocks = getAllCards(createGridLayout());
      const result = findCardInDirection(blocks, blocks[0], "down");
      expect(result?.blockId).toBe("card-0");
    });

    it("navigates right from card 0 to card 1", () => {
      const blocks = getAllCards(createGridLayout());
      const result = findCardInDirection(blocks, blocks[1], "right");
      expect(result?.blockId).toBe("card-1");
    });

    it("navigates down from card 0 to card 2", () => {
      const blocks = getAllCards(createGridLayout());
      const result = findCardInDirection(blocks, blocks[1], "down");
      expect(result?.blockId).toBe("card-2");
    });

    it("returns null when no block exists in that direction", () => {
      const blocks = getAllCards(createGridLayout());
      expect(findCardInDirection(blocks, blocks[0], "up")).toBeNull();
    });
  });
});
