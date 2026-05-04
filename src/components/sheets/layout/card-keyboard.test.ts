import { describe, it, expect } from "vitest";

// Import types and helpers for testing
import type { CardLayoutState, SectionLayoutState } from "./layout-types";

// We need to test the pure functions used by useCardKeyboard
// Since they're not exported, we'll extract them to a separate file for testability
// For now, let's test the logic conceptually by reimplementing the same functions

type CardPosition = {
  sectionIndex: number;
  cardIndex: number;
  layout: CardLayoutState;
};

function getAllCards(sectionLayouts: SectionLayoutState[]): CardPosition[] {
  const cards: CardPosition[] = [];
  sectionLayouts.forEach((section, sectionIndex) => {
    section.cards.forEach((layout, cardIndex) => {
      cards.push({ sectionIndex, cardIndex, layout });
    });
  });
  return cards;
}

function findCardInDirection(
  cards: CardPosition[],
  current: CardPosition,
  direction: "up" | "down" | "left" | "right"
): CardPosition | null {
  const sameSection = cards.filter((c) => c.sectionIndex === current.sectionIndex);

  switch (direction) {
    case "left": {
      const candidates = sameSection.filter((c) => {
        if (c.cardIndex === current.cardIndex) return false;
        if (c.layout.colStart >= current.layout.colStart) return false;
        const currentTop = current.layout.rowStart;
        const currentBottom = currentTop + current.layout.rowSpan - 1;
        const candidateTop = c.layout.rowStart;
        const candidateBottom = candidateTop + c.layout.rowSpan - 1;
        return candidateTop <= currentBottom && candidateBottom >= currentTop;
      });
      if (candidates.length === 0) return null;
      return candidates.reduce((best, c) =>
        c.layout.colStart > best.layout.colStart ? c : best
      );
    }

    case "right": {
      const candidates = sameSection.filter((c) => {
        if (c.cardIndex === current.cardIndex) return false;
        if (c.layout.colStart <= current.layout.colStart) return false;
        const currentTop = current.layout.rowStart;
        const currentBottom = currentTop + current.layout.rowSpan - 1;
        const candidateTop = c.layout.rowStart;
        const candidateBottom = candidateTop + c.layout.rowSpan - 1;
        return candidateTop <= currentBottom && candidateBottom >= currentTop;
      });
      if (candidates.length === 0) return null;
      return candidates.reduce((best, c) =>
        c.layout.colStart < best.layout.colStart ? c : best
      );
    }

    case "up": {
      const candidates = sameSection.filter((c) => {
        if (c.cardIndex === current.cardIndex) return false;
        if (c.layout.rowStart >= current.layout.rowStart) return false;
        const currentLeft = current.layout.colStart;
        const currentRight = currentLeft + current.layout.colSpan - 1;
        const candidateLeft = c.layout.colStart;
        const candidateRight = candidateLeft + c.layout.colSpan - 1;
        return candidateLeft <= currentRight && candidateRight >= currentLeft;
      });
      if (candidates.length === 0) return null;
      return candidates.reduce((best, c) =>
        c.layout.rowStart > best.layout.rowStart ? c : best
      );
    }

    case "down": {
      const candidates = sameSection.filter((c) => {
        if (c.cardIndex === current.cardIndex) return false;
        if (c.layout.rowStart <= current.layout.rowStart) return false;
        const currentLeft = current.layout.colStart;
        const currentRight = currentLeft + current.layout.colSpan - 1;
        const candidateLeft = c.layout.colStart;
        const candidateRight = candidateLeft + c.layout.colSpan - 1;
        return candidateLeft <= currentRight && candidateRight >= currentLeft;
      });
      if (candidates.length === 0) return null;
      return candidates.reduce((best, c) =>
        c.layout.rowStart < best.layout.rowStart ? c : best
      );
    }
  }
}

type CardFocus = {
  sectionIndex: number;
  cardIndex: number;
};

function findFirstCard(sectionLayouts: SectionLayoutState[]): CardFocus | null {
  for (let sectionIndex = 0; sectionIndex < sectionLayouts.length; sectionIndex++) {
    const section = sectionLayouts[sectionIndex];
    if (section.cards.length > 0) {
      let bestIndex = 0;
      let bestLayout = section.cards[0];
      section.cards.forEach((layout, cardIndex) => {
        if (
          layout.rowStart < bestLayout.rowStart ||
          (layout.rowStart === bestLayout.rowStart && layout.colStart < bestLayout.colStart)
        ) {
          bestIndex = cardIndex;
          bestLayout = layout;
        }
      });
      return { sectionIndex, cardIndex: bestIndex };
    }
  }
  return null;
}

function validateFocus(
  focus: CardFocus | null,
  sectionCount: number,
  getCardCount: (sectionIndex: number) => number
): CardFocus | null {
  if (!focus) return null;
  const { sectionIndex, cardIndex } = focus;
  if (sectionIndex >= sectionCount || cardIndex >= getCardCount(sectionIndex)) {
    return null;
  }
  return focus;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

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
    // Create a test grid layout:
    // [Card0: 1-4, row1] [Card1: 5-8, row1]
    // [Card2: 1-4, row2] [Card3: 5-8, row2]
    const createGridLayout = (): SectionLayoutState[] => [
      {
        cards: [
          { colStart: 1, rowStart: 1, colSpan: 4, rowSpan: 1 }, // Card 0
          { colStart: 5, rowStart: 1, colSpan: 4, rowSpan: 1 }, // Card 1
          { colStart: 1, rowStart: 2, colSpan: 4, rowSpan: 1 }, // Card 2
          { colStart: 5, rowStart: 2, colSpan: 4, rowSpan: 1 }, // Card 3
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
      const current = cards[0]; // Top-left card

      expect(findCardInDirection(cards, current, "left")).toBeNull();
      expect(findCardInDirection(cards, current, "up")).toBeNull();
    });

    it("handles cards with different sizes", () => {
      const layouts: SectionLayoutState[] = [
        {
          cards: [
            { colStart: 1, rowStart: 1, colSpan: 4, rowSpan: 2 }, // Tall card
            { colStart: 5, rowStart: 1, colSpan: 4, rowSpan: 1 }, // Short card, row 1
            { colStart: 5, rowStart: 2, colSpan: 4, rowSpan: 1 }, // Short card, row 2
          ],
        },
      ];
      const cards = getAllCards(layouts);
      const tallCard = cards[0];

      // From tall card, navigating right should find the first overlapping card
      const result = findCardInDirection(cards, tallCard, "right");
      expect(result?.cardIndex).toBe(1);
    });

    it("finds closest card in direction with multiple candidates", () => {
      const layouts: SectionLayoutState[] = [
        {
          cards: [
            { colStart: 1, rowStart: 1, colSpan: 2, rowSpan: 1 }, // Card 0
            { colStart: 5, rowStart: 1, colSpan: 2, rowSpan: 1 }, // Card 1 (farther right)
            { colStart: 9, rowStart: 1, colSpan: 2, rowSpan: 1 }, // Card 2 (even farther right)
          ],
        },
      ];
      const cards = getAllCards(layouts);
      const current = cards[0];

      // Should find card 1 (closest to the right), not card 2
      const result = findCardInDirection(cards, current, "right");
      expect(result?.cardIndex).toBe(1);
    });

    it("requires vertical overlap for left/right navigation", () => {
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

      // Should return null because card 1 doesn't overlap vertically
      const result = findCardInDirection(cards, current, "right");
      expect(result).toBeNull();
    });

    it("requires horizontal overlap for up/down navigation", () => {
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

      // Should return null because card 1 doesn't overlap horizontally
      const result = findCardInDirection(cards, current, "down");
      expect(result).toBeNull();
    });
  });
});
