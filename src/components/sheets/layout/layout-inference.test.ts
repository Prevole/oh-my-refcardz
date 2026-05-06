import { describe, it, expect } from "vitest";
import {
  inferCardColSpan,
  inferCardRowSpan,
  buildDefaultSectionLayouts,
} from "./layout-inference";
import type { CheatSheetCard, CheatSheetItem, YamlCheatSheet } from "@/lib/yaml-cheatsheets";

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
  return { title: "Test Card", items };
}

function createSheet(sections: Array<{ cards: CheatSheetCard[] }>): YamlCheatSheet {
  return {
    title: "Test Sheet",
    summary: "Test summary",
    color: "#FF0000",
    sections: sections.map((s, i) => ({
      title: `Section ${i}`,
      cards: s.cards,
    })),
  };
}

describe("inferCardColSpan", () => {
  it("returns 4 for card with 1-2 items", () => {
    expect(inferCardColSpan(createCard(1))).toBe(4);
    expect(inferCardColSpan(createCard(2))).toBe(4);
  });

  it("returns 6 for card with 3-4 items", () => {
    expect(inferCardColSpan(createCard(3))).toBe(6);
    expect(inferCardColSpan(createCard(4))).toBe(6);
  });

  it("returns 8 for card with 5+ items", () => {
    expect(inferCardColSpan(createCard(5))).toBe(8);
    expect(inferCardColSpan(createCard(10))).toBe(8);
  });

  it("returns 8 for card with content item regardless of count", () => {
    expect(inferCardColSpan(createCard(1, ["content"]))).toBe(8);
    expect(inferCardColSpan(createCard(2, ["command", "content"]))).toBe(8);
  });

  it("returns 8 for card with settings item regardless of count", () => {
    expect(inferCardColSpan(createCard(1, ["settings"]))).toBe(8);
    expect(inferCardColSpan(createCard(2, ["command", "settings"]))).toBe(8);
  });
});

describe("inferCardRowSpan", () => {
  it("returns 4 for card with 1-2 items", () => {
    expect(inferCardRowSpan(createCard(1))).toBe(4);
    expect(inferCardRowSpan(createCard(2))).toBe(4);
  });

  it("returns 5 for card with 3-4 shortcut items", () => {
    expect(inferCardRowSpan(createCard(3, ["shortcut", "shortcut", "shortcut"]))).toBe(5);
    expect(inferCardRowSpan(createCard(4, ["shortcut", "shortcut", "shortcut", "shortcut"]))).toBe(5);
  });

  it("returns 6 for card with 3-4 command items", () => {
    expect(inferCardRowSpan(createCard(3, ["command", "command", "command"]))).toBe(6);
    expect(inferCardRowSpan(createCard(4, ["command", "command", "command", "command"]))).toBe(6);
  });

  it("returns 8 for card with 5+ items", () => {
    expect(inferCardRowSpan(createCard(5))).toBe(8);
    expect(inferCardRowSpan(createCard(10))).toBe(8);
  });

  it("returns 8 for card with content item regardless of count", () => {
    expect(inferCardRowSpan(createCard(1, ["content"]))).toBe(8);
    expect(inferCardRowSpan(createCard(2, ["command", "content"]))).toBe(8);
  });

  it("returns 8 for card with settings item regardless of count", () => {
    expect(inferCardRowSpan(createCard(1, ["settings"]))).toBe(8);
    expect(inferCardRowSpan(createCard(2, ["command", "settings"]))).toBe(8);
  });
});

describe("buildDefaultSectionLayouts", () => {
  it("returns empty array for sheet with no sections", () => {
    const sheet = createSheet([]);
    const result = buildDefaultSectionLayouts(sheet);
    expect(result).toEqual([]);
  });

  it("creates layout for each section", () => {
    const sheet = createSheet([
      { cards: [createCard(2)] },
      { cards: [createCard(3)] },
    ]);
    const result = buildDefaultSectionLayouts(sheet);
    expect(result).toHaveLength(2);
  });

  it("creates layout for each card in section", () => {
    const sheet = createSheet([
      { cards: [createCard(2), createCard(3), createCard(5)] },
    ]);
    const result = buildDefaultSectionLayouts(sheet);
    expect(result[0].cards).toHaveLength(3);
  });

  it("infers colSpan and rowSpan from card content", () => {
    const sheet = createSheet([
      { cards: [createCard(2), createCard(5)] },
    ]);
    const result = buildDefaultSectionLayouts(sheet);
    expect(result[0].cards[0].colSpan).toBe(4);
    expect(result[0].cards[0].rowSpan).toBe(4);

    expect(result[0].cards[1].colSpan).toBe(8);
    expect(result[0].cards[1].rowSpan).toBe(8);
  });

  it("resolves card positions to avoid overlap", () => {
    const sheet = createSheet([
      { cards: [createCard(2), createCard(2), createCard(2)] },
    ]);
    const result = buildDefaultSectionLayouts(sheet);
    expect(result[0].cards[0].colStart).toBe(1);
    expect(result[0].cards[1].colStart).toBe(5);
    expect(result[0].cards[2].colStart).toBe(9);
    expect(result[0].cards.every((c) => c.rowStart === 1)).toBe(true);
  });

  it("wraps cards to next row when row is full", () => {
    const sheet = createSheet([
      { cards: [createCard(5), createCard(5)] },
    ]);
    const result = buildDefaultSectionLayouts(sheet);
    expect(result[0].cards[0].colStart).toBe(1);
    expect(result[0].cards[0].rowStart).toBe(1);
    expect(result[0].cards[1].colStart).toBe(1);
    expect(result[0].cards[1].rowStart).toBeGreaterThan(1);
  });

  it("handles content cards with larger dimensions", () => {
    const sheet = createSheet([
      { cards: [createCard(1, ["content"])] },
    ]);
    const result = buildDefaultSectionLayouts(sheet);
    expect(result[0].cards[0].colSpan).toBe(8);
    expect(result[0].cards[0].rowSpan).toBe(8);
  });
});
