import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import { getHeadingGroups, type CheatSheetEntry } from "./cheatsheet-shared";
import {
  getYamlCheatSheet,
  getYamlCheatSheetWithMeta,
  getAllCheatSheetsMeta,
} from "./yaml-cheatsheets";

// ---------------------------------------------------------------------------
// Helper to check if an entry has a specific key
// ---------------------------------------------------------------------------

function hasEntryType<K extends string>(
  entry: CheatSheetEntry,
  key: K
): entry is CheatSheetEntry & Record<K, unknown> {
  return key in entry;
}

function findEntryWithKey<K extends string>(
  entries: CheatSheetEntry[],
  key: K
): (CheatSheetEntry & Record<K, unknown>) | undefined {
  return entries.find((e) => hasEntryType(e, key)) as
    | (CheatSheetEntry & Record<K, unknown>)
    | undefined;
}

function getAllEntries(sheet: NonNullable<Awaited<ReturnType<typeof getYamlCheatSheet>>>) {
  return getHeadingGroups(sheet).flatMap((group) =>
    group.cards.flatMap((card) => card.items.flatMap((item) => item.entries))
  );
}

// ---------------------------------------------------------------------------
// Integration tests using real content files
// ---------------------------------------------------------------------------

describe("yaml-cheatsheets integration", () => {
  describe("getYamlCheatSheet", () => {
    it("loads an existing cheat sheet by slug", async () => {
      const sheet = await getYamlCheatSheet("git");

      expect(sheet).not.toBeNull();
      expect(sheet?.title).toBe("Git");
      expect(sheet?.summary).toContain("aliases");
      expect(sheet?.color).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(sheet?.blocks.length).toBeGreaterThan(0);
    });

    it("returns null for non-existent slug", async () => {
      const sheet = await getYamlCheatSheet("non-existent-slug-12345");

      expect(sheet).toBeNull();
    });

    it("parses command entries correctly", async () => {
      const sheet = await getYamlCheatSheet("git");

      expect(sheet).not.toBeNull();
      const allEntries = getAllEntries(sheet!);
      const commandEntry = findEntryWithKey(allEntries, "command");

      expect(commandEntry).toBeDefined();
      expect(commandEntry?.command).toBeDefined();
    });

    it("parses multiple command entries correctly", async () => {
      const sheet = await getYamlCheatSheet("diff-so-fancy");

      expect(sheet).not.toBeNull();
      const allEntries = getAllEntries(sheet!);
      const commandEntries = allEntries.filter((e) => "command" in e);

      expect(commandEntries.length).toBeGreaterThan(1);
    });

    it("parses content entries correctly", async () => {
      const sheet = await getYamlCheatSheet("git");

      expect(sheet).not.toBeNull();
      const allEntries = getAllEntries(sheet!);
      const contentEntry = findEntryWithKey(allEntries, "content");

      expect(contentEntry).toBeDefined();
      expect((contentEntry?.content as unknown[]).length).toBeGreaterThan(0);
    });

    it("parses where entries correctly", async () => {
      const sheet = await getYamlCheatSheet("1password");

      expect(sheet).not.toBeNull();
      const allEntries = getAllEntries(sheet!);
      const whereEntry = findEntryWithKey(allEntries, "where");

      expect(whereEntry).toBeDefined();
      expect(whereEntry?.where).toBeDefined();
    });

    it("parses settings entries correctly", async () => {
      const sheet = await getYamlCheatSheet("1password");

      expect(sheet).not.toBeNull();
      const allEntries = getAllEntries(sheet!);
      const settingsEntry = findEntryWithKey(allEntries, "settings");

      expect(settingsEntry).toBeDefined();
      expect((settingsEntry?.settings as unknown[]).length).toBeGreaterThan(0);
    });

    it("parses alias entries correctly", async () => {
      const sheet = await getYamlCheatSheet("git");

      expect(sheet).not.toBeNull();
      const allEntries = getAllEntries(sheet!);
      const aliasEntry = findEntryWithKey(allEntries, "alias");

      expect(aliasEntry).toBeDefined();
      expect((aliasEntry?.alias as { content?: unknown }).content).toBeDefined();
    });

    it("includes optional icon field when present", async () => {
      const sheet = await getYamlCheatSheet("git");

      expect(sheet).not.toBeNull();
      expect(sheet?.icon).toBe("git");
    });

    it("loads multiple sheets from the same category", async () => {
      const gitSheet = await getYamlCheatSheet("git");
      const diffSoFancySheet = await getYamlCheatSheet("diff-so-fancy");

      expect(gitSheet).not.toBeNull();
      expect(diffSoFancySheet).not.toBeNull();
      expect(gitSheet?.title).toBe("Git");
      expect(diffSoFancySheet?.title).toBe("Diff So Fancy");
    });
  });

  describe("getAllCheatSheetsMeta", () => {
    it("returns all categories with sheets", async () => {
      const categories = await getAllCheatSheetsMeta();

      expect(categories.length).toBeGreaterThan(0);
      expect(categories.every((c) => c.id)).toBe(true);
      expect(categories.every((c) => c.title)).toBe(true);
      expect(categories.every((c) => Array.isArray(c.sheets))).toBe(true);
    });

    it("returns sheets with required metadata", async () => {
      const categories = await getAllCheatSheetsMeta();
      const allSheets = categories.flatMap((c) => c.sheets);

      expect(allSheets.length).toBeGreaterThan(0);

      for (const sheet of allSheets) {
        expect(sheet.slug).toBeDefined();
        expect(sheet.title).toBeDefined();
        expect(sheet.summary).toBeDefined();
        expect(sheet.color).toMatch(/^#[0-9a-fA-F]{3,6}$/);
        expect(sheet.categoryId).toBeDefined();
      }
    });

    it("sorts categories by folder prefix order", async () => {
      const categories = await getAllCheatSheetsMeta();

      // 01-tooling should come before 02-languages
      const toolingIndex = categories.findIndex((c) => c.title === "Tooling");
      const languagesIndex = categories.findIndex((c) => c.title === "Languages");

      if (toolingIndex !== -1 && languagesIndex !== -1) {
        expect(toolingIndex).toBeLessThan(languagesIndex);
      }
    });

    it("sorts sheets alphabetically within categories", async () => {
      const categories = await getAllCheatSheetsMeta();

      for (const category of categories) {
        const titles = category.sheets.map((s) => s.title);
        const sortedTitles = [...titles].sort((a, b) => a.localeCompare(b));
        expect(titles).toEqual(sortedTitles);
      }
    });

    it("includes category description from meta.yaml", async () => {
      const categories = await getAllCheatSheetsMeta();
      const tooling = categories.find((c) => c.title === "Tooling");

      expect(tooling).toBeDefined();
      expect(tooling?.description).toContain("Developer tools");
    });

    it("includes icon field when present in sheet", async () => {
      const categories = await getAllCheatSheetsMeta();
      const allSheets = categories.flatMap((c) => c.sheets);
      const gitSheet = allSheets.find((s) => s.slug === "git");

      expect(gitSheet?.icon).toBe("git");
    });
  });
});

// ---------------------------------------------------------------------------
// Integration tests with temporary fixtures
// These test edge cases that don't exist in the real content
// ---------------------------------------------------------------------------

describe("yaml-cheatsheets edge cases", () => {
  const contentDir = path.join(process.cwd(), "content", "cheatsheets");

  describe("duplicate slug detection", () => {
    const fixtureDir = path.join(contentDir, "99-duplicate-test");

    beforeEach(async () => {
      await fs.mkdir(fixtureDir, { recursive: true });
    });

    afterEach(async () => {
      await fs.rm(fixtureDir, { recursive: true, force: true });
    });

    it("throws error when duplicate slugs exist", async () => {
      // Create a duplicate of an existing slug (git already exists in 01-tooling)
      await fs.writeFile(
        path.join(fixtureDir, "git.yaml"),
        `title: Git Duplicate
summary: A duplicate sheet
color: "#000000"
blocks: []
`
      );

      await expect(getAllCheatSheetsMeta()).rejects.toThrow(/Duplicate slug "git"/);
    });
  });

  describe("invalid YAML handling", () => {
    const fixtureDir = path.join(contentDir, "98-invalid-test");

    beforeEach(async () => {
      await fs.mkdir(fixtureDir, { recursive: true });
      // Add valid meta.yaml so the category is valid
      await fs.writeFile(
        path.join(fixtureDir, "meta.yaml"),
        `title: Invalid Test
description: Testing invalid sheets
`
      );
    });

    afterEach(async () => {
      await fs.rm(fixtureDir, { recursive: true, force: true });
    });

    it("throws error for invalid cheat sheet schema", async () => {
      await fs.writeFile(
        path.join(fixtureDir, "invalid-sheet.yaml"),
        `title: Invalid
summary: Missing color field
blocks: []
`
      );

      await expect(getYamlCheatSheet("invalid-sheet")).rejects.toThrow(/Invalid YAML cheatsheet/);
    });

    it("throws error for invalid entry type", async () => {
      await fs.writeFile(
        path.join(fixtureDir, "invalid-item.yaml"),
        `title: Invalid Item
summary: Has invalid entry type
color: "#FF0000"
blocks:
  - heading:
      id: section
      title: Section
  - card:
      id: card
      title: Card
      items:
        - entries:
            - unknownKey: bar
`
      );

      await expect(getYamlCheatSheet("invalid-item")).rejects.toThrow(/Invalid YAML cheatsheet/);
    });

    it("throws error in getAllCheatSheetsMeta for invalid sheet", async () => {
      await fs.writeFile(
        path.join(fixtureDir, "invalid-for-all.yaml"),
        `title: Invalid For All
summary: Missing color in getAllCheatSheetsMeta
blocks: []
`
      );

      await expect(getAllCheatSheetsMeta()).rejects.toThrow(/Invalid YAML cheatsheet/);
    });
  });

  describe("category meta handling", () => {
    const fixtureDir = path.join(contentDir, "97-meta-test");

    afterEach(async () => {
      await fs.rm(fixtureDir, { recursive: true, force: true });
    });

    it("uses folder name as fallback when meta.yaml is missing", async () => {
      await fs.mkdir(fixtureDir, { recursive: true });
      await fs.writeFile(
        path.join(fixtureDir, "test-sheet.yaml"),
        `title: Test Sheet
summary: A test sheet in category without meta
color: "#123456"
blocks: []
`
      );

      const categories = await getAllCheatSheetsMeta();
      const noMetaCategory = categories.find((c) => c.id === "97-meta-test");

      expect(noMetaCategory).toBeDefined();
      // Falls back to parsed folder name (removes numeric prefix)
      expect(noMetaCategory?.title).toBe("meta-test");
      expect(noMetaCategory?.description).toBe("");
    });

    it("throws error for invalid category meta.yaml", async () => {
      await fs.mkdir(fixtureDir, { recursive: true });
      await fs.writeFile(
        path.join(fixtureDir, "meta.yaml"),
        `title: Valid Title
# missing description field
`
      );
      await fs.writeFile(
        path.join(fixtureDir, "sheet.yaml"),
        `title: Sheet
summary: A sheet
color: "#AABBCC"
blocks: []
`
      );

      await expect(getAllCheatSheetsMeta()).rejects.toThrow(/Invalid category meta/);
    });
  });

  describe("folder name parsing", () => {
    afterEach(async () => {
      // Clean up any test directories
      const testDirs = ["50-custom-category", "no-prefix-category", "50-alpha", "50-beta"];
      for (const dir of testDirs) {
        await fs.rm(path.join(contentDir, dir), { recursive: true, force: true });
      }
    });

    it("parses numeric prefix and sorts categories correctly", async () => {
      const fixtureDir = path.join(contentDir, "50-custom-category");
      await fs.mkdir(fixtureDir, { recursive: true });
      await fs.writeFile(
        path.join(fixtureDir, "meta.yaml"),
        `title: Custom Category
description: A custom test category
`
      );
      await fs.writeFile(
        path.join(fixtureDir, "custom-sheet.yaml"),
        `title: Custom Sheet
summary: Test
color: "#ABCDEF"
blocks: []
`
      );

      const categories = await getAllCheatSheetsMeta();
      const customCategory = categories.find((c) => c.title === "Custom Category");

      expect(customCategory).toBeDefined();
      expect(customCategory?.id).toBe("50-custom-category");

      // Should be sorted between 01-tooling and 02-languages based on numeric prefix
      // 01 < 50 > 02, but since we have 01, 02, 50 it should be after 02
      const toolingIndex = categories.findIndex((c) => c.id === "01-tooling");
      const customIndex = categories.findIndex((c) => c.id === "50-custom-category");

      expect(customIndex).toBeGreaterThan(toolingIndex);
    });

    it("handles folder without numeric prefix", async () => {
      const fixtureDir = path.join(contentDir, "no-prefix-category");
      await fs.mkdir(fixtureDir, { recursive: true });
      await fs.writeFile(
        path.join(fixtureDir, "meta.yaml"),
        `title: No Prefix
description: A category without numeric prefix
`
      );
      await fs.writeFile(
        path.join(fixtureDir, "sheet.yaml"),
        `title: Sheet
summary: Test
color: "#AABBCC"
blocks: []
`
      );

      const categories = await getAllCheatSheetsMeta();
      const noPrefixCategory = categories.find((c) => c.title === "No Prefix");

      expect(noPrefixCategory).toBeDefined();
      // Categories without numeric prefix should be sorted last (order: POSITIVE_INFINITY)
      const lastIndex = categories.length - 1;
      const noPrefixIndex = categories.findIndex((c) => c.title === "No Prefix");
      expect(noPrefixIndex).toBe(lastIndex);
    });

    it("sorts categories with same order by fallback name", async () => {
      // Create two categories with the same numeric prefix
      const alphaDir = path.join(contentDir, "50-alpha");
      const betaDir = path.join(contentDir, "50-beta");

      await fs.mkdir(alphaDir, { recursive: true });
      await fs.mkdir(betaDir, { recursive: true });

      await fs.writeFile(
        path.join(alphaDir, "meta.yaml"),
        `title: Alpha Category
description: First category with prefix 50
`
      );
      await fs.writeFile(
        path.join(alphaDir, "sheet-a.yaml"),
        `title: Sheet A
summary: Test
color: "#111111"
blocks: []
`
      );

      await fs.writeFile(
        path.join(betaDir, "meta.yaml"),
        `title: Beta Category
description: Second category with prefix 50
`
      );
      await fs.writeFile(
        path.join(betaDir, "sheet-b.yaml"),
        `title: Sheet B
summary: Test
color: "#222222"
blocks: []
`
      );

      const categories = await getAllCheatSheetsMeta();
      const alphaIndex = categories.findIndex((c) => c.id === "50-alpha");
      const betaIndex = categories.findIndex((c) => c.id === "50-beta");

      // Both have order 50, so they should be sorted by fallback name (alpha < beta)
      expect(alphaIndex).toBeLessThan(betaIndex);
    });
  });

  describe("savedBlockLayout loading", () => {
    const fixtureDir = path.join(contentDir, "96-layout-test");

    beforeEach(async () => {
      await fs.mkdir(fixtureDir, { recursive: true });
      await fs.writeFile(
        path.join(fixtureDir, "meta.yaml"),
        `title: Layout Test
description: Testing layout loading
`
      );
    });

    afterEach(async () => {
      await fs.rm(fixtureDir, { recursive: true, force: true });
    });

    it("returns savedBlockLayout when .layout.json exists", async () => {
      const savedLayout = [
        {
          id: "section",
          kind: "heading",
          colStart: 1,
          rowStart: 1,
          colSpan: 36,
          rowSpan: 2,
        },
        {
          id: "card",
          kind: "card",
          colStart: 5,
          rowStart: 5,
          colSpan: 6,
          rowSpan: 4,
        },
      ];

      await fs.writeFile(
        path.join(fixtureDir, "with-layout.yaml"),
        `title: With Layout
summary: A sheet with saved layout
color: "#AABBCC"
blocks:
  - heading:
      id: section
      title: Section
  - card:
      id: card
      title: Card
      items:
        - entries:
            - title: Test
            - command: test
`
      );
      await fs.writeFile(
        path.join(fixtureDir, "with-layout.layout.json"),
        JSON.stringify(savedLayout, null, 2)
      );

      const sheet = await getYamlCheatSheetWithMeta("with-layout");

      expect(sheet).not.toBeNull();
      expect(sheet?.savedBlockLayout).toEqual(savedLayout);
    });

    it("returns undefined savedBlockLayout when .layout.json does not exist", async () => {
      await fs.writeFile(
        path.join(fixtureDir, "no-layout.yaml"),
        `title: No Layout
summary: A sheet without saved layout
color: "#DDEEFF"
blocks:
  - heading:
      id: section
      title: Section
  - card:
      id: card
      title: Card
      items:
        - entries:
            - title: Test
            - command: test
`
      );

      const sheet = await getYamlCheatSheetWithMeta("no-layout");

      expect(sheet).not.toBeNull();
      expect(sheet?.savedBlockLayout).toBeUndefined();
    });

    it("returns undefined savedBlockLayout when .layout.json is invalid JSON", async () => {
      await fs.writeFile(
        path.join(fixtureDir, "invalid-layout.yaml"),
        `title: Invalid Layout
summary: A sheet with invalid layout JSON
color: "#112233"
blocks:
  - heading:
      id: section
      title: Section
  - card:
      id: card
      title: Card
      items:
        - entries:
            - title: Test
            - command: test
`
      );
      await fs.writeFile(
        path.join(fixtureDir, "invalid-layout.layout.json"),
        "not valid json {"
      );

      const sheet = await getYamlCheatSheetWithMeta("invalid-layout");

      expect(sheet).not.toBeNull();
      expect(sheet?.savedBlockLayout).toBeUndefined();
    });

    it("includes colorFrom and categoryId alongside savedBlockLayout", async () => {
      const savedLayout = [
        {
          id: "section",
          kind: "heading",
          colStart: 1,
          rowStart: 1,
          colSpan: 36,
          rowSpan: 2,
        },
        {
          id: "card",
          kind: "card",
          colStart: 1,
          rowStart: 3,
          colSpan: 4,
          rowSpan: 2,
        },
      ];

      await fs.writeFile(
        path.join(fixtureDir, "full-meta.yaml"),
        `title: Full Meta
summary: A sheet with all metadata
color: "#445566"
blocks:
  - heading:
      id: section
      title: Section
  - card:
      id: card
      title: Card
      items:
        - entries:
            - title: Test
            - command: test
`
      );
      await fs.writeFile(
        path.join(fixtureDir, "full-meta.layout.json"),
        JSON.stringify(savedLayout, null, 2)
      );

      const sheet = await getYamlCheatSheetWithMeta("full-meta");

      expect(sheet).not.toBeNull();
      expect(sheet?.savedBlockLayout).toEqual(savedLayout);
      expect(sheet?.colorFrom).toBeDefined();
      expect(sheet?.categoryId).toBe("96-layout-test");
    });
  });
});
