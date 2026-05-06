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
    sections: [
      {
        title: "Containers",
        cards: [
          {
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
        ],
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

  describe("sections validation", () => {
    it("requires at least sections array (can be empty)", () => {
      const result = yamlCheatSheetSchema.safeParse({ ...validSheet, sections: [] });
      expect(result.success).toBe(true);
    });

    it("validates section title is required", () => {
      const invalidSection = {
        ...validSheet,
        sections: [{ cards: [] }],
      };
      const result = yamlCheatSheetSchema.safeParse(invalidSection);
      expect(result.success).toBe(false);
    });

    it("validates section title is not empty", () => {
      const invalidSection = {
        ...validSheet,
        sections: [{ title: "", cards: [] }],
      };
      const result = yamlCheatSheetSchema.safeParse(invalidSection);
      expect(result.success).toBe(false);
    });
  });

  describe("cards validation", () => {
    it("validates card title is required", () => {
      const invalidCard = {
        ...validSheet,
        sections: [{ title: "Section", cards: [{ items: [] }] }],
      };
      const result = yamlCheatSheetSchema.safeParse(invalidCard);
      expect(result.success).toBe(false);
    });

    it("validates card items array is required", () => {
      const invalidCard = {
        ...validSheet,
        sections: [{ title: "Section", cards: [{ title: "Card" }] }],
      };
      const result = yamlCheatSheetSchema.safeParse(invalidCard);
      expect(result.success).toBe(false);
    });
  });

  describe("entry validation", () => {
    const makeSheetWithEntries = (entries: unknown[]) => ({
      ...validSheet,
      sections: [
        {
          title: "Section",
          cards: [{ title: "Card", items: [{ entries }] }],
        },
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
      it("validates single alias entry", () => {
        const result = yamlCheatSheetSchema.safeParse(
          makeSheetWithEntries([{ alias: "s" }])
        );
        expect(result.success).toBe(true);
      });

      it("rejects empty alias", () => {
        const result = yamlCheatSheetSchema.safeParse(
          makeSheetWithEntries([{ alias: "" }])
        );
        expect(result.success).toBe(false);
      });
    });

    describe("aliases entry", () => {
      it("validates aliases entry", () => {
        const result = yamlCheatSheetSchema.safeParse(
          makeSheetWithEntries([{ aliases: ["s", "st", "sta"] }])
        );
        expect(result.success).toBe(true);
      });

      it("rejects empty aliases array", () => {
        const result = yamlCheatSheetSchema.safeParse(
          makeSheetWithEntries([{ aliases: [] }])
        );
        expect(result.success).toBe(false);
      });

      it("rejects aliases with empty string", () => {
        const result = yamlCheatSheetSchema.safeParse(
          makeSheetWithEntries([{ aliases: ["s", ""] }])
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

    describe("item validation", () => {
      it("rejects item without entries", () => {
        const sheet = {
          ...validSheet,
          sections: [
            {
              title: "Section",
              cards: [{ title: "Card", items: [{}] }],
            },
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
            { title: "Status" },
            { command: "git status" },
            { aliases: ["s", "st"] },
            { text: "Show the current branch state" },
          ])
        );
        expect(result.success).toBe(true);
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
