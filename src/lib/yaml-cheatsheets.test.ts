import { describe, it, expect } from "vitest";
import {
  yamlCheatSheetSchema,
  categoryMetaSchema,
} from "./yaml-cheatsheets";

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
                type: "command",
                title: "Run container",
                command: "docker run",
                description: "Run a container from an image",
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

  describe("command item validation", () => {
    const makeSheetWithItem = (item: unknown) => ({
      ...validSheet,
      sections: [
        {
          title: "Section",
          cards: [{ title: "Card", items: [item] }],
        },
      ],
    });

    it("validates command item with all fields", () => {
      const item = {
        type: "command",
        title: "Run",
        command: "docker run",
        description: "Run a container",
        examples: ["docker run nginx", "docker run -d nginx"],
      };
      const result = yamlCheatSheetSchema.safeParse(makeSheetWithItem(item));
      expect(result.success).toBe(true);
    });

    it("accepts command without optional description", () => {
      const item = {
        type: "command",
        title: "Run",
        command: "docker run",
      };
      const result = yamlCheatSheetSchema.safeParse(makeSheetWithItem(item));
      expect(result.success).toBe(true);
    });

    it("accepts command without optional examples", () => {
      const item = {
        type: "command",
        title: "Run",
        command: "docker run",
        description: "Run a container",
      };
      const result = yamlCheatSheetSchema.safeParse(makeSheetWithItem(item));
      expect(result.success).toBe(true);
    });

    it("rejects command without title", () => {
      const item = {
        type: "command",
        command: "docker run",
      };
      const result = yamlCheatSheetSchema.safeParse(makeSheetWithItem(item));
      expect(result.success).toBe(false);
    });

    it("rejects command without command field", () => {
      const item = {
        type: "command",
        title: "Run",
      };
      const result = yamlCheatSheetSchema.safeParse(makeSheetWithItem(item));
      expect(result.success).toBe(false);
    });

    it("rejects command with empty title", () => {
      const item = {
        type: "command",
        title: "",
        command: "docker run",
      };
      const result = yamlCheatSheetSchema.safeParse(makeSheetWithItem(item));
      expect(result.success).toBe(false);
    });

    it("rejects command with empty command", () => {
      const item = {
        type: "command",
        title: "Run",
        command: "",
      };
      const result = yamlCheatSheetSchema.safeParse(makeSheetWithItem(item));
      expect(result.success).toBe(false);
    });
  });

  describe("shortcut item validation", () => {
    const makeSheetWithItem = (item: unknown) => ({
      ...validSheet,
      sections: [
        {
          title: "Section",
          cards: [{ title: "Card", items: [item] }],
        },
      ],
    });

    it("validates shortcut item with all fields", () => {
      const item = {
        type: "shortcut",
        keys: ["Ctrl", "C"],
        description: "Copy to clipboard",
      };
      const result = yamlCheatSheetSchema.safeParse(makeSheetWithItem(item));
      expect(result.success).toBe(true);
    });

    it("accepts shortcut with single key", () => {
      const item = {
        type: "shortcut",
        keys: ["Escape"],
        description: "Cancel operation",
      };
      const result = yamlCheatSheetSchema.safeParse(makeSheetWithItem(item));
      expect(result.success).toBe(true);
    });

    it("rejects shortcut without keys", () => {
      const item = {
        type: "shortcut",
        description: "Copy to clipboard",
      };
      const result = yamlCheatSheetSchema.safeParse(makeSheetWithItem(item));
      expect(result.success).toBe(false);
    });

    it("rejects shortcut with empty keys array", () => {
      const item = {
        type: "shortcut",
        keys: [],
        description: "Copy to clipboard",
      };
      const result = yamlCheatSheetSchema.safeParse(makeSheetWithItem(item));
      expect(result.success).toBe(false);
    });

    it("rejects shortcut with empty key string", () => {
      const item = {
        type: "shortcut",
        keys: ["Ctrl", ""],
        description: "Copy to clipboard",
      };
      const result = yamlCheatSheetSchema.safeParse(makeSheetWithItem(item));
      expect(result.success).toBe(false);
    });

    it("rejects shortcut without description", () => {
      const item = {
        type: "shortcut",
        keys: ["Ctrl", "C"],
      };
      const result = yamlCheatSheetSchema.safeParse(makeSheetWithItem(item));
      expect(result.success).toBe(false);
    });

    it("rejects shortcut with empty description", () => {
      const item = {
        type: "shortcut",
        keys: ["Ctrl", "C"],
        description: "",
      };
      const result = yamlCheatSheetSchema.safeParse(makeSheetWithItem(item));
      expect(result.success).toBe(false);
    });
  });

  describe("discriminated union (type field)", () => {
    const makeSheetWithItem = (item: unknown) => ({
      ...validSheet,
      sections: [
        {
          title: "Section",
          cards: [{ title: "Card", items: [item] }],
        },
      ],
    });

    it("rejects item without type", () => {
      const item = {
        title: "Something",
        command: "cmd",
      };
      const result = yamlCheatSheetSchema.safeParse(makeSheetWithItem(item));
      expect(result.success).toBe(false);
    });

    it("rejects item with invalid type", () => {
      const item = {
        type: "invalid",
        title: "Something",
      };
      const result = yamlCheatSheetSchema.safeParse(makeSheetWithItem(item));
      expect(result.success).toBe(false);
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
