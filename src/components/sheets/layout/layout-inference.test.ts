import { describe, it, expect } from "vitest";
import {
  inferCardColSpan,
  inferCardRowSpan,
  buildDefaultBlockLayouts,
} from "./layout-inference";
import type { CheatSheetCard, CheatSheetItem, YamlCheatSheet } from "@/lib/cheatsheet-shared";

type ItemType = "command" | "shortcut" | "content" | "settings";

function createItem(type: ItemType): CheatSheetItem {
  switch (type) {
    case "command":
      return { entries: [{ command: "git status" }] };
    case "shortcut":
      return { entries: [{ keys: ["Ctrl", "A"] }] };
    case "content":
      return { entries: [{ content: "key = value" }] };
    case "settings":
      return { entries: [{ settings: ["Feature = enabled"] }] };
  }
}

function createCard(itemCount: number, types: ItemType[] = []): CheatSheetCard {
  const items: CheatSheetItem[] = [];
  for (let i = 0; i < itemCount; i++) {
    const type = types[i] || "command";
    items.push(createItem(type));
  }
  return { id: "test-card", title: "Test Card", items };
}

function createSheet(sections: Array<{ cards: CheatSheetCard[] }>): YamlCheatSheet {
  return {
    title: "Test Sheet",
    summary: "Test summary",
    color: "#FF0000",
    blocks: sections.flatMap((section, sectionIndex) => [
      {
        heading: {
          id: `section-${sectionIndex}`,
          title: `Section ${sectionIndex}`,
        },
      },
      ...section.cards.map((card, cardIndex) => ({
        card: {
          ...card,
          id: `card-${sectionIndex}-${cardIndex}`,
        },
      })),
    ]),
  };
}

describe("inferCardColSpan", () => {
  it("returns 21 for card with 1-2 items", () => {
    expect(inferCardColSpan(createCard(1))).toBe(21);
    expect(inferCardColSpan(createCard(2))).toBe(21);
  });

  it("returns 32 for card with 3-4 items", () => {
    expect(inferCardColSpan(createCard(3))).toBe(32);
    expect(inferCardColSpan(createCard(4))).toBe(32);
  });

  it("returns 43 for card with 5+ items", () => {
    expect(inferCardColSpan(createCard(5))).toBe(43);
    expect(inferCardColSpan(createCard(10))).toBe(43);
  });

  it("returns 43 for card with content item regardless of count", () => {
    expect(inferCardColSpan(createCard(1, ["content"]))).toBe(43);
    expect(inferCardColSpan(createCard(2, ["command", "content"]))).toBe(43);
  });

  it("returns 43 for card with settings item regardless of count", () => {
    expect(inferCardColSpan(createCard(1, ["settings"]))).toBe(43);
    expect(inferCardColSpan(createCard(2, ["command", "settings"]))).toBe(43);
  });
});

describe("inferCardRowSpan", () => {
  it("returns 21 for card with 1-2 items", () => {
    expect(inferCardRowSpan(createCard(1))).toBe(21);
    expect(inferCardRowSpan(createCard(2))).toBe(21);
  });

  it("returns 27 for card with 3-4 shortcut items", () => {
    expect(inferCardRowSpan(createCard(3, ["shortcut", "shortcut", "shortcut"]))).toBe(27);
    expect(inferCardRowSpan(createCard(4, ["shortcut", "shortcut", "shortcut", "shortcut"]))).toBe(27);
  });

  it("returns 32 for card with 3-4 command items", () => {
    expect(inferCardRowSpan(createCard(3, ["command", "command", "command"]))).toBe(32);
    expect(inferCardRowSpan(createCard(4, ["command", "command", "command", "command"]))).toBe(32);
  });

  it("returns 43 for card with 5+ items", () => {
    expect(inferCardRowSpan(createCard(5))).toBe(43);
    expect(inferCardRowSpan(createCard(10))).toBe(43);
  });

  it("returns 43 for card with content item regardless of count", () => {
    expect(inferCardRowSpan(createCard(1, ["content"]))).toBe(43);
    expect(inferCardRowSpan(createCard(2, ["command", "content"]))).toBe(43);
  });

  it("returns 43 for card with settings item regardless of count", () => {
    expect(inferCardRowSpan(createCard(1, ["settings"]))).toBe(43);
    expect(inferCardRowSpan(createCard(2, ["command", "settings"]))).toBe(43);
  });
});

describe("buildDefaultBlockLayouts", () => {
  it("returns empty array for sheet with no blocks", () => {
    const sheet = createSheet([]);
    const result = buildDefaultBlockLayouts(sheet);
    expect(result).toEqual([]);
  });

  it("creates layout for each heading and card", () => {
    const sheet = createSheet([
      { cards: [createCard(2)] },
      { cards: [createCard(3)] },
    ]);
    const result = buildDefaultBlockLayouts(sheet);
    expect(result).toHaveLength(4);
  });

  it("creates layout entries for all cards", () => {
    const sheet = createSheet([
      { cards: [createCard(2), createCard(3), createCard(5)] },
    ]);
    const result = buildDefaultBlockLayouts(sheet);
    expect(result.filter((block) => block.kind === "card")).toHaveLength(3);
  });

  it("infers heading size deterministically", () => {
    const sheet = createSheet([{ cards: [createCard(2)] }]);
    const result = buildDefaultBlockLayouts(sheet);

    expect(result[0]).toMatchObject({ kind: "heading", colStart: 1, rowStart: 1, colSpan: 64, rowSpan: 3 });
  });

  it("infers colSpan and rowSpan from card content", () => {
    const sheet = createSheet([
      { cards: [createCard(2), createCard(5)] },
    ]);
    const result = buildDefaultBlockLayouts(sheet);
    const cards = result.filter((block) => block.kind === "card");
    expect(cards[0].colSpan).toBe(21);
    expect(cards[0].rowSpan).toBe(21);

    expect(cards[1].colSpan).toBe(43);
    expect(cards[1].rowSpan).toBe(43);
  });

  it("places cards after the heading without overlap", () => {
    const sheet = createSheet([
      { cards: [createCard(2), createCard(2), createCard(2)] },
    ]);
    const result = buildDefaultBlockLayouts(sheet);
    const cards = result.filter((block) => block.kind === "card");

    expect(cards[0].colStart).toBe(1);
    expect(cards[1].colStart).toBe(22);
    expect(cards[2].colStart).toBe(43);
    expect(cards.every((card) => card.rowStart >= 3)).toBe(true);
  });

  it("wraps cards to next row when row is full", () => {
    const sheet = createSheet([
      { cards: [createCard(5), createCard(5)] },
    ]);
    const result = buildDefaultBlockLayouts(sheet);
    const cards = result.filter((block) => block.kind === "card");

    expect(cards[0].colStart).toBe(1);
    expect(cards[0].rowStart).toBe(4);
    expect(cards[1].colStart).toBe(1);
    expect(cards[1].rowStart).toBeGreaterThan(4);
  });

  it("handles content cards with larger dimensions", () => {
    const sheet = createSheet([
      { cards: [createCard(1, ["content"])] },
    ]);
    const result = buildDefaultBlockLayouts(sheet);
    const [card] = result.filter((block) => block.kind === "card");
    expect(card.colSpan).toBe(43);
    expect(card.rowSpan).toBe(43);
  });
});
