import { describe, it, expect } from "vitest";
import { yamlCheatSheetSchema, categoryMetaSchema } from "./yaml-cheatsheets";

// ---------------------------------------------------------------------------
// yamlCheatSheetSchema
// ---------------------------------------------------------------------------

describe("yamlCheatSheetSchema", () => {
  const validSheet = {
    title: "Docker",
    summary: "Container management commands",
    color: "#2496ED",
    blocks: [
      {
        heading: {
          id: "containers",
          title: "Containers",
        },
      },
      {
        card: {
          id: "lifecycle",
          title: "Lifecycle",
          items: [
            {
              entries: [
                { title: "Run container" },
                { command: "docker run" },
                { text: "Run a container from an image" },
              ],
            },
          ],
        },
      },
    ],
  };

  it("validates a complete valid cheat sheet", () => {
    const result = yamlCheatSheetSchema.safeParse(validSheet);

    expect(result.success).toBe(true);
  });

  it("accepts optional icon field", () => {
    const withIcon = { ...validSheet, icon: "docker" };
    const result = yamlCheatSheetSchema.safeParse(withIcon);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.icon).toBe("docker");
    }
  });

  it("rejects missing title", () => {
    const noTitle = { ...validSheet };
    delete noTitle.title;
    const result = yamlCheatSheetSchema.safeParse(noTitle);

    expect(result.success).toBe(false);
  });

  it("rejects empty title", () => {
    const result = yamlCheatSheetSchema.safeParse({ ...validSheet, title: "" });

    expect(result.success).toBe(false);
  });

  it("rejects missing summary", () => {
    const noSummary = { ...validSheet };
    delete noSummary.summary;
    const result = yamlCheatSheetSchema.safeParse(noSummary);

    expect(result.success).toBe(false);
  });

  it("rejects missing color", () => {
    const noColor = { ...validSheet };
    delete noColor.color;
    const result = yamlCheatSheetSchema.safeParse(noColor);

    expect(result.success).toBe(false);
  });

  describe("color validation", () => {
    it("accepts 6-digit hex color", () => {
      const result = yamlCheatSheetSchema.safeParse({ ...validSheet, color: "#2496ED" });
      expect(result.success).toBe(true);
    });

    it("accepts 3-digit hex color", () => {
      const result = yamlCheatSheetSchema.safeParse({ ...validSheet, color: "#ABC" });
      expect(result.success).toBe(true);
    });

    it("accepts lowercase hex color", () => {
      const result = yamlCheatSheetSchema.safeParse({ ...validSheet, color: "#abcdef" });
      expect(result.success).toBe(true);
    });

    it("rejects color without hash", () => {
      const result = yamlCheatSheetSchema.safeParse({ ...validSheet, color: "2496ED" });
      expect(result.success).toBe(false);
    });

    it("rejects invalid hex characters", () => {
      const result = yamlCheatSheetSchema.safeParse({ ...validSheet, color: "#GGGGGG" });
      expect(result.success).toBe(false);
    });

    it("rejects rgb format", () => {
      const result = yamlCheatSheetSchema.safeParse({ ...validSheet, color: "rgb(0,0,0)" });
      expect(result.success).toBe(false);
    });

    it("rejects 4-digit hex", () => {
      const result = yamlCheatSheetSchema.safeParse({ ...validSheet, color: "#ABCD" });
      expect(result.success).toBe(false);
    });
  });

  describe("blocks validation", () => {
    it("requires at least blocks array (can be empty)", () => {
      const result = yamlCheatSheetSchema.safeParse({ ...validSheet, blocks: [] });
      expect(result.success).toBe(true);
    });

    it("validates heading title is required", () => {
      const invalidHeading = {
        ...validSheet,
        blocks: [{ heading: { id: "containers" } }],
      };
      const result = yamlCheatSheetSchema.safeParse(invalidHeading);
      expect(result.success).toBe(false);
    });

    it("validates heading title is not empty", () => {
      const invalidHeading = {
        ...validSheet,
        blocks: [{ heading: { id: "containers", title: "" } }],
      };
      const result = yamlCheatSheetSchema.safeParse(invalidHeading);
      expect(result.success).toBe(false);
    });

    it("requires heading ids", () => {
      const invalidHeading = {
        ...validSheet,
        blocks: [{ heading: { title: "Containers" } }],
      };

      const result = yamlCheatSheetSchema.safeParse(invalidHeading);
      expect(result.success).toBe(false);
    });
  });

  describe("cards validation", () => {
    it("validates card title is required", () => {
      const invalidCard = {
        ...validSheet,
        blocks: [{ heading: { id: "section", title: "Section" } }, { card: { id: "card", items: [] } }],
      };
      const result = yamlCheatSheetSchema.safeParse(invalidCard);
      expect(result.success).toBe(false);
    });

    it("validates card items array is required", () => {
      const invalidCard = {
        ...validSheet,
        blocks: [{ heading: { id: "section", title: "Section" } }, { card: { id: "card", title: "Card" } }],
      };
      const result = yamlCheatSheetSchema.safeParse(invalidCard);
      expect(result.success).toBe(false);
    });

    it("requires card ids", () => {
      const invalidCard = {
        ...validSheet,
        blocks: [{ heading: { id: "section", title: "Section" } }, { card: { title: "Card", items: [] } }],
      };

      const result = yamlCheatSheetSchema.safeParse(invalidCard);
      expect(result.success).toBe(false);
    });

    it("rejects duplicate block ids across sections and cards", () => {
      const invalidSheet = {
        ...validSheet,
        blocks: [
          { heading: { id: "shared-id", title: "Section" } },
          { card: { id: "shared-id", title: "Card", items: [{ entries: [{ command: "docker run" }] }] } },
        ],
      };

      const result = yamlCheatSheetSchema.safeParse(invalidSheet);
      expect(result.success).toBe(false);
    });
  });

  describe("entry validation", () => {
    const makeSheetWithEntries = (entries: unknown[]) => ({
      ...validSheet,
      blocks: [
        { heading: { id: "section", title: "Section" } },
        { card: { id: "card", title: "Card", items: [{ entries }] } },
      ],
    });

    describe("title entry", () => {
      it("validates title entry", () => {
        const result = yamlCheatSheetSchema.safeParse(
          makeSheetWithEntries([{ title: "My Title" }])
        );
        expect(result.success).toBe(true);
      });

      it("rejects empty title entry", () => {
        const result = yamlCheatSheetSchema.safeParse(
          makeSheetWithEntries([{ title: "" }])
        );
        expect(result.success).toBe(false);
      });
    });

    describe("command entry", () => {
      it("validates command entry", () => {
        const result = yamlCheatSheetSchema.safeParse(
          makeSheetWithEntries([{ command: "docker run" }])
        );
        expect(result.success).toBe(true);
      });

      it("rejects empty command", () => {
        const result = yamlCheatSheetSchema.safeParse(
          makeSheetWithEntries([{ command: "" }])
        );
        expect(result.success).toBe(false);
      });
    });

    describe("alias entry", () => {
      it("validates alias entry with content only", () => {
        const result = yamlCheatSheetSchema.safeParse(
          makeSheetWithEntries([{ alias: { content: "git s" } }])
        );
        expect(result.success).toBe(true);
      });

      it("validates alias entry with content and copy", () => {
        const result = yamlCheatSheetSchema.safeParse(
          makeSheetWithEntries([{ alias: { content: "git (s|st|sta)", copy: "git s" } }])
        );
        expect(result.success).toBe(true);
      });

      it("rejects empty alias content", () => {
        const result = yamlCheatSheetSchema.safeParse(
          makeSheetWithEntries([{ alias: { content: "" } }])
        );
        expect(result.success).toBe(false);
      });

      it("rejects empty alias copy", () => {
        const result = yamlCheatSheetSchema.safeParse(
          makeSheetWithEntries([{ alias: { content: "git s", copy: "" } }])
        );
        expect(result.success).toBe(false);
      });

      it("rejects alias without content", () => {
        const result = yamlCheatSheetSchema.safeParse(
          makeSheetWithEntries([{ alias: {} }])
        );
        expect(result.success).toBe(false);
      });
    });

    describe("commandExample entry", () => {
      it("validates single commandExample entry", () => {
        const result = yamlCheatSheetSchema.safeParse(
          makeSheetWithEntries([{ commandExample: "docker run nginx" }])
        );
        expect(result.success).toBe(true);
      });

      it("rejects empty commandExample", () => {
        const result = yamlCheatSheetSchema.safeParse(
          makeSheetWithEntries([{ commandExample: "" }])
        );
        expect(result.success).toBe(false);
      });
    });

    describe("commandExamples entry", () => {
      it("validates commandExamples entry", () => {
        const result = yamlCheatSheetSchema.safeParse(
          makeSheetWithEntries([{ commandExamples: ["docker run nginx", "docker run -d nginx"] }])
        );
        expect(result.success).toBe(true);
      });

      it("rejects empty commandExamples array", () => {
        const result = yamlCheatSheetSchema.safeParse(
          makeSheetWithEntries([{ commandExamples: [] }])
        );
        expect(result.success).toBe(false);
      });
    });

    describe("text entry", () => {
      it("validates text entry", () => {
        const result = yamlCheatSheetSchema.safeParse(
          makeSheetWithEntries([{ text: "A description of the command" }])
        );
        expect(result.success).toBe(true);
      });

      it("rejects empty text", () => {
        const result = yamlCheatSheetSchema.safeParse(
          makeSheetWithEntries([{ text: "" }])
        );
        expect(result.success).toBe(false);
      });
    });

    describe("anchor entry", () => {
      it("validates anchor entry", () => {
        const result = yamlCheatSheetSchema.safeParse(
          makeSheetWithEntries([{ anchor: "working-tree-status" }, { command: "git status" }])
        );
        expect(result.success).toBe(true);
      });

      it("rejects anchor entry with invalid format", () => {
        const result = yamlCheatSheetSchema.safeParse(
          makeSheetWithEntries([{ anchor: "Working Tree Status" }, { command: "git status" }])
        );
        expect(result.success).toBe(false);
      });
    });

    describe("keys entry", () => {
      it("validates keys entry", () => {
        const result = yamlCheatSheetSchema.safeParse(
          makeSheetWithEntries([{ keys: ["Ctrl", "C"] }])
        );
        expect(result.success).toBe(true);
      });

      it("accepts single key", () => {
        const result = yamlCheatSheetSchema.safeParse(
          makeSheetWithEntries([{ keys: ["Escape"] }])
        );
        expect(result.success).toBe(true);
      });

      it("rejects empty keys array", () => {
        const result = yamlCheatSheetSchema.safeParse(
          makeSheetWithEntries([{ keys: [] }])
        );
        expect(result.success).toBe(false);
      });

      it("rejects keys with empty string", () => {
        const result = yamlCheatSheetSchema.safeParse(
          makeSheetWithEntries([{ keys: ["Ctrl", ""] }])
        );
        expect(result.success).toBe(false);
      });
    });

    describe("file entry", () => {
      it("validates file entry", () => {
        const result = yamlCheatSheetSchema.safeParse(
          makeSheetWithEntries([{ file: "~/.gitconfig" }])
        );
        expect(result.success).toBe(true);
      });

      it("rejects empty file", () => {
        const result = yamlCheatSheetSchema.safeParse(
          makeSheetWithEntries([{ file: "" }])
        );
        expect(result.success).toBe(false);
      });
    });

    describe("where entry", () => {
      it("validates where entry", () => {
        const result = yamlCheatSheetSchema.safeParse(
          makeSheetWithEntries([{ where: "Settings > Developer" }])
        );
        expect(result.success).toBe(true);
      });

      it("rejects empty where", () => {
        const result = yamlCheatSheetSchema.safeParse(
          makeSheetWithEntries([{ where: "" }])
        );
        expect(result.success).toBe(false);
      });
    });

    describe("content entry", () => {
      it("validates content entry", () => {
        const result = yamlCheatSheetSchema.safeParse(
          makeSheetWithEntries([{ content: "[user]\n  name = Alex" }])
        );
        expect(result.success).toBe(true);
      });

      it("rejects empty content", () => {
        const result = yamlCheatSheetSchema.safeParse(
          makeSheetWithEntries([{ content: "" }])
        );
        expect(result.success).toBe(false);
      });

      it("rejects blank content (whitespace only)", () => {
        const result = yamlCheatSheetSchema.safeParse(
          makeSheetWithEntries([{ content: "   \n  " }])
        );
        expect(result.success).toBe(false);
      });

      it("validates contentExample entry", () => {
        const result = yamlCheatSheetSchema.safeParse(
          makeSheetWithEntries([{ contentExample: "[user]\n  name = Alex" }])
        );
        expect(result.success).toBe(true);
      });

      it("rejects empty contentExample", () => {
        const result = yamlCheatSheetSchema.safeParse(
          makeSheetWithEntries([{ contentExample: "" }])
        );
        expect(result.success).toBe(false);
      });

      it("rejects contentExample with blank content", () => {
        const result = yamlCheatSheetSchema.safeParse(
          makeSheetWithEntries([{ contentExample: "   \n  " }])
        );
        expect(result.success).toBe(false);
      });
    });

    describe("settings entry", () => {
      it("validates settings entry", () => {
        const result = yamlCheatSheetSchema.safeParse(
          makeSheetWithEntries([{ settings: ["App integration = enabled"] }])
        );
        expect(result.success).toBe(true);
      });

      it("rejects empty settings array", () => {
        const result = yamlCheatSheetSchema.safeParse(
          makeSheetWithEntries([{ settings: [] }])
        );
        expect(result.success).toBe(false);
      });

      it("rejects settings with empty string", () => {
        const result = yamlCheatSheetSchema.safeParse(
          makeSheetWithEntries([{ settings: ["enabled", ""] }])
        );
        expect(result.success).toBe(false);
      });
    });

    describe("table entry", () => {
      it("validates table with headers and rows", () => {
        const result = yamlCheatSheetSchema.safeParse(
          makeSheetWithEntries([{
            table: {
              headers: ["Prefix", "Effect", "Example"],
              rows: [
                { cols: ["`dot_`", "Maps to hidden path", "`dot_zshrc` → `.zshrc`"] },
              ],
            },
          }])
        );
        expect(result.success).toBe(true);
      });

      it("validates table without headers", () => {
        const result = yamlCheatSheetSchema.safeParse(
          makeSheetWithEntries([{
            table: {
              rows: [
                { cols: ["Value 1", "Value 2"] },
                { cols: ["Value 3", "Value 4"] },
              ],
            },
          }])
        );
        expect(result.success).toBe(true);
      });

      it("rejects table with empty rows array", () => {
        const result = yamlCheatSheetSchema.safeParse(
          makeSheetWithEntries([{
            table: {
              headers: ["Header"],
              rows: [],
            },
          }])
        );
        expect(result.success).toBe(false);
      });

      it("rejects table row with empty cols array", () => {
        const result = yamlCheatSheetSchema.safeParse(
          makeSheetWithEntries([{
            table: {
              rows: [{ cols: [] }],
            },
          }])
        );
        expect(result.success).toBe(false);
      });

      it("rejects table with empty header string", () => {
        const result = yamlCheatSheetSchema.safeParse(
          makeSheetWithEntries([{
            table: {
              headers: ["Valid", ""],
              rows: [{ cols: ["a", "b"] }],
            },
          }])
        );
        expect(result.success).toBe(false);
      });

      it("allows empty string in table cell", () => {
        const result = yamlCheatSheetSchema.safeParse(
          makeSheetWithEntries([{
            table: {
              rows: [{ cols: ["Value", ""] }],
            },
          }])
        );
        expect(result.success).toBe(true);
      });
    });

    describe("step entry", () => {
      it("validates step entry", () => {
        const result = yamlCheatSheetSchema.safeParse(
          makeSheetWithEntries([{ step: "Install" }])
        );
        expect(result.success).toBe(true);
      });

      it("rejects empty step", () => {
        const result = yamlCheatSheetSchema.safeParse(
          makeSheetWithEntries([{ step: "" }])
        );
        expect(result.success).toBe(false);
      });
    });

    describe("link entry", () => {
      it("validates link entry with github type", () => {
        const result = yamlCheatSheetSchema.safeParse(
          makeSheetWithEntries([{
            link: {
              type: "github",
              url: "https://github.com/user/repo",
            },
          }])
        );
        expect(result.success).toBe(true);
      });

      it("validates link entry with docs type", () => {
        const result = yamlCheatSheetSchema.safeParse(
          makeSheetWithEntries([{
            link: {
              type: "docs",
              url: "https://docs.example.com/guide",
            },
          }])
        );
        expect(result.success).toBe(true);
      });

      it("validates link entry with website type", () => {
        const result = yamlCheatSheetSchema.safeParse(
          makeSheetWithEntries([{
            link: {
              type: "website",
              url: "https://example.com",
            },
          }])
        );
        expect(result.success).toBe(true);
      });

      it("validates link entry with optional label", () => {
        const result = yamlCheatSheetSchema.safeParse(
          makeSheetWithEntries([{
            link: {
              type: "github",
              url: "https://github.com/user/repo",
              label: "My Repo",
            },
          }])
        );
        expect(result.success).toBe(true);
      });

      it("rejects link with invalid type", () => {
        const result = yamlCheatSheetSchema.safeParse(
          makeSheetWithEntries([{
            link: {
              type: "invalid",
              url: "https://example.com",
            },
          }])
        );
        expect(result.success).toBe(false);
      });

      it("rejects link with invalid URL", () => {
        const result = yamlCheatSheetSchema.safeParse(
          makeSheetWithEntries([{
            link: {
              type: "github",
              url: "not-a-valid-url",
            },
          }])
        );
        expect(result.success).toBe(false);
      });

      it("rejects link with empty label", () => {
        const result = yamlCheatSheetSchema.safeParse(
          makeSheetWithEntries([{
            link: {
              type: "github",
              url: "https://github.com/user/repo",
              label: "",
            },
          }])
        );
        expect(result.success).toBe(false);
      });

      it("rejects link without type", () => {
        const result = yamlCheatSheetSchema.safeParse(
          makeSheetWithEntries([{
            link: {
              url: "https://example.com",
            },
          }])
        );
        expect(result.success).toBe(false);
      });

      it("rejects link without url", () => {
        const result = yamlCheatSheetSchema.safeParse(
          makeSheetWithEntries([{
            link: {
              type: "github",
            },
          }])
        );
        expect(result.success).toBe(false);
      });
    });

    describe("item validation", () => {
      it("rejects item without entries", () => {
        const sheet = {
          ...validSheet,
          blocks: [
            { heading: { id: "section", title: "Section" } },
            { card: { id: "card", title: "Card", items: [{}] } },
          ],
        };
        const result = yamlCheatSheetSchema.safeParse(sheet);
        expect(result.success).toBe(false);
      });

      it("rejects item with empty entries array", () => {
        const result = yamlCheatSheetSchema.safeParse(makeSheetWithEntries([]));
        expect(result.success).toBe(false);
      });

      it("accepts item with multiple entries", () => {
        const result = yamlCheatSheetSchema.safeParse(
          makeSheetWithEntries([
            { anchor: "status" },
            { title: "Status" },
            { command: "git status" },
            { alias: { content: "git (s|st)", copy: "git s" } },
            { text: "Show the current branch state" },
          ])
        );
        expect(result.success).toBe(true);
      });

      it("rejects items with multiple anchor entries", () => {
        const result = yamlCheatSheetSchema.safeParse(
          makeSheetWithEntries([{ anchor: "status" }, { anchor: "status-details" }, { command: "git status" }])
        );
        expect(result.success).toBe(false);
      });

      it("rejects anchor entries in detailedEntries", () => {
        const result = yamlCheatSheetSchema.safeParse({
          ...validSheet,
          blocks: [
            { heading: { id: "section", title: "Section" } },
            {
              card: {
                id: "card",
                title: "Card",
                items: [
                  {
                    entries: [{ command: "git status" }],
                    detailedEntries: [{ anchor: "status-details" }],
                  },
                ],
              },
            },
          ],
        });
        expect(result.success).toBe(false);
      });
    });

    describe("unknown entry type", () => {
      it("rejects unknown entry type", () => {
        const result = yamlCheatSheetSchema.safeParse(
          makeSheetWithEntries([{ unknownKey: "value" }])
        );
        expect(result.success).toBe(false);
      });
    });
  });
});

// ---------------------------------------------------------------------------
// categoryMetaSchema
// ---------------------------------------------------------------------------

describe("categoryMetaSchema", () => {
  it("validates valid category meta", () => {
    const result = categoryMetaSchema.safeParse({
      title: "Tooling",
      description: "CLI tools for developers",
    });

    expect(result.success).toBe(true);
  });

  it("rejects missing title", () => {
    const result = categoryMetaSchema.safeParse({
      description: "CLI tools for developers",
    });

    expect(result.success).toBe(false);
  });

  it("rejects empty title", () => {
    const result = categoryMetaSchema.safeParse({
      title: "",
      description: "CLI tools for developers",
    });

    expect(result.success).toBe(false);
  });

  it("rejects missing description", () => {
    const result = categoryMetaSchema.safeParse({
      title: "Tooling",
    });

    expect(result.success).toBe(false);
  });

  it("rejects empty description", () => {
    const result = categoryMetaSchema.safeParse({
      title: "Tooling",
      description: "",
    });

    expect(result.success).toBe(false);
  });
});
