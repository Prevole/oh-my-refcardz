import { describe, it, expect } from "vitest";
import {
  getAllCards,
  findCardInDirection,
  findFirstCard,
  validateFocus,
} from "./card-navigation";
import type { SectionLayoutState } from "./layout-types";

describe("Card keyboard navigation helpers", () => {
  describe("getAllCards", () => {
    it("returns empty array for empty layouts", () => {
      expect(getAllCards([])).toEqual([]);
    });

    it("returns all cards from all sections", () => {
      const layouts: SectionLayoutState[] = [
        {
          cards: [
            { colStart: 1, rowStart: 1, colSpan: 2, rowSpan: 1 },
            { colStart: 3, rowStart: 1, colSpan: 2, rowSpan: 1 },
          ],
        },
        {
          cards: [{ colStart: 1, rowStart: 1, colSpan: 4, rowSpan: 2 }],
        },
      ];

      const result = getAllCards(layouts);
      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({
        sectionIndex: 0,
        cardIndex: 0,
        layout: { colStart: 1, rowStart: 1, colSpan: 2, rowSpan: 1 },
      });
      expect(result[2]).toEqual({
        sectionIndex: 1,
        cardIndex: 0,
        layout: { colStart: 1, rowStart: 1, colSpan: 4, rowSpan: 2 },
      });
    });
  });

  describe("findFirstCard", () => {
    it("returns null for empty layouts", () => {
      expect(findFirstCard([])).toBeNull();
    });

    it("returns null for sections with no cards", () => {
      expect(findFirstCard([{ cards: [] }])).toBeNull();
    });

    it("returns the top-left card", () => {
      const layouts: SectionLayoutState[] = [
        {
          cards: [
            { colStart: 5, rowStart: 2, colSpan: 2, rowSpan: 1 },
            { colStart: 1, rowStart: 1, colSpan: 2, rowSpan: 1 },
            { colStart: 3, rowStart: 1, colSpan: 2, rowSpan: 1 },
          ],
        },
      ];

      const result = findFirstCard(layouts);
      expect(result).toEqual({ sectionIndex: 0, cardIndex: 1 });
    });

    it("prefers leftmost card when rows are equal", () => {
      const layouts: SectionLayoutState[] = [
        {
          cards: [
            { colStart: 5, rowStart: 1, colSpan: 2, rowSpan: 1 },
            { colStart: 3, rowStart: 1, colSpan: 2, rowSpan: 1 },
            { colStart: 1, rowStart: 1, colSpan: 2, rowSpan: 1 },
          ],
        },
      ];

      const result = findFirstCard(layouts);
      expect(result).toEqual({ sectionIndex: 0, cardIndex: 2 });
    });
  });

  describe("validateFocus", () => {
    const getCardCount = (sectionIndex: number) => {
      const counts = [3, 2, 1];
      return counts[sectionIndex] ?? 0;
    };

    it("returns null for null focus", () => {
      expect(validateFocus(null, 3, getCardCount)).toBeNull();
    });

    it("returns the focus if valid", () => {
      const focus = { sectionIndex: 0, cardIndex: 2 };
      expect(validateFocus(focus, 3, getCardCount)).toEqual(focus);
    });

    it("returns null if section index is out of bounds", () => {
      const focus = { sectionIndex: 5, cardIndex: 0 };
      expect(validateFocus(focus, 3, getCardCount)).toBeNull();
    });

    it("returns null if card index is out of bounds", () => {
      const focus = { sectionIndex: 0, cardIndex: 10 };
      expect(validateFocus(focus, 3, getCardCount)).toBeNull();
    });
  });

  describe("findCardInDirection", () => {
    const createGridLayout = (): SectionLayoutState[] => [
      {
        cards: [
            { colStart: 1, rowStart: 1, colSpan: 4, rowSpan: 1 },
            { colStart: 5, rowStart: 1, colSpan: 4, rowSpan: 1 },
            { colStart: 1, rowStart: 2, colSpan: 4, rowSpan: 1 },
            { colStart: 5, rowStart: 2, colSpan: 4, rowSpan: 1 },
        ],
      },
    ];

    it("navigates right from card 0 to card 1", () => {
      const layouts = createGridLayout();
      const cards = getAllCards(layouts);
      const current = cards[0];

      const result = findCardInDirection(cards, current, "right");
      expect(result?.cardIndex).toBe(1);
    });

    it("navigates left from card 1 to card 0", () => {
      const layouts = createGridLayout();
      const cards = getAllCards(layouts);
      const current = cards[1];

      const result = findCardInDirection(cards, current, "left");
      expect(result?.cardIndex).toBe(0);
    });

    it("navigates down from card 0 to card 2", () => {
      const layouts = createGridLayout();
      const cards = getAllCards(layouts);
      const current = cards[0];

      const result = findCardInDirection(cards, current, "down");
      expect(result?.cardIndex).toBe(2);
    });

    it("navigates up from card 2 to card 0", () => {
      const layouts = createGridLayout();
      const cards = getAllCards(layouts);
      const current = cards[2];

      const result = findCardInDirection(cards, current, "up");
      expect(result?.cardIndex).toBe(0);
    });

    it("returns null when no card in direction", () => {
      const layouts = createGridLayout();
      const cards = getAllCards(layouts);
      const current = cards[0];

      expect(findCardInDirection(cards, current, "left")).toBeNull();
      expect(findCardInDirection(cards, current, "up")).toBeNull();
    });

    it("handles cards with different sizes", () => {
      const layouts: SectionLayoutState[] = [
        {
          cards: [
            { colStart: 1, rowStart: 1, colSpan: 4, rowSpan: 2 },
            { colStart: 5, rowStart: 1, colSpan: 4, rowSpan: 1 },
            { colStart: 5, rowStart: 2, colSpan: 4, rowSpan: 1 },
          ],
        },
      ];
      const cards = getAllCards(layouts);
      const tallCard = cards[0];

      const result = findCardInDirection(cards, tallCard, "right");
      expect(result?.cardIndex).toBe(1);
    });

    it("finds closest card in direction with multiple candidates", () => {
      const layouts: SectionLayoutState[] = [
        {
          cards: [
            { colStart: 1, rowStart: 1, colSpan: 2, rowSpan: 1 },
            { colStart: 5, rowStart: 1, colSpan: 2, rowSpan: 1 },
            { colStart: 9, rowStart: 1, colSpan: 2, rowSpan: 1 },
          ],
        },
      ];
      const cards = getAllCards(layouts);
      const current = cards[0];

      const result = findCardInDirection(cards, current, "right");
      expect(result?.cardIndex).toBe(1);
    });

    it("falls back to the nearest card on the right when vertical overlap is missing", () => {
      const layouts: SectionLayoutState[] = [
        {
          cards: [
            { colStart: 1, rowStart: 1, colSpan: 4, rowSpan: 1 }, // Card 0, row 1
            { colStart: 5, rowStart: 3, colSpan: 4, rowSpan: 1 }, // Card 1, row 3 (no overlap)
          ],
        },
      ];
      const cards = getAllCards(layouts);
      const current = cards[0];

      const result = findCardInDirection(cards, current, "right");
      expect(result?.cardIndex).toBe(1);
    });

    it("falls back to the nearest card below when horizontal overlap is missing", () => {
      const layouts: SectionLayoutState[] = [
        {
          cards: [
            { colStart: 1, rowStart: 1, colSpan: 4, rowSpan: 1 }, // Card 0, cols 1-4
            { colStart: 9, rowStart: 2, colSpan: 4, rowSpan: 1 }, // Card 1, cols 9-12 (no overlap)
          ],
        },
      ];
      const cards = getAllCards(layouts);
      const current = cards[0];

      const result = findCardInDirection(cards, current, "down");
      expect(result?.cardIndex).toBe(1);
    });

    it("prefers overlapping cards over diagonally closer non-overlapping cards", () => {
      const layouts: SectionLayoutState[] = [
        {
          cards: [
            { colStart: 5, rowStart: 5, colSpan: 2, rowSpan: 2 }, // current
            { colStart: 8, rowStart: 5, colSpan: 2, rowSpan: 2 }, // overlapping right
            { colStart: 7, rowStart: 2, colSpan: 2, rowSpan: 2 }, // slightly closer diagonally
          ],
        },
      ];
      const cards = getAllCards(layouts);

      const result = findCardInDirection(cards, cards[0], "right");
      expect(result?.cardIndex).toBe(1);
    });

    it("falls back to the next section when navigating down with no candidate in section", () => {
      const layouts: SectionLayoutState[] = [
        {
          cards: [{ colStart: 1, rowStart: 1, colSpan: 4, rowSpan: 1 }],
        },
        {
          cards: [{ colStart: 1, rowStart: 1, colSpan: 4, rowSpan: 1 }],
        },
      ];
      const cards = getAllCards(layouts);

      const result = findCardInDirection(cards, cards[0], "down");
      expect(result).toEqual(cards[1]);
    });

    it("falls back to the previous section when navigating up with no candidate in section", () => {
      const layouts: SectionLayoutState[] = [
        {
          cards: [{ colStart: 5, rowStart: 1, colSpan: 4, rowSpan: 1 }],
        },
        {
          cards: [{ colStart: 5, rowStart: 1, colSpan: 4, rowSpan: 1 }],
        },
      ];
      const cards = getAllCards(layouts);

      const result = findCardInDirection(cards, cards[1], "up");
      expect(result).toEqual(cards[0]);
    });
  });
});
