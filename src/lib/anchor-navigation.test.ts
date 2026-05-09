import { describe, it, expect } from "vitest";
import { buildBlockAnchorId, buildIndexedAnchorId } from "./anchor-navigation";

// ---------------------------------------------------------------------------
// buildIndexedAnchorId
// ---------------------------------------------------------------------------

describe("buildIndexedAnchorId", () => {
  describe("basic formatting", () => {
    it("creates anchor with prefix, slugified label, and 1-based index", () => {
      const result = buildIndexedAnchorId("section", "Basic Commands", 0);

      expect(result).toBe("section-basic-commands-1");
    });

    it("uses 1-based indexing", () => {
      expect(buildIndexedAnchorId("sec", "Label", 0)).toBe("sec-label-1");
      expect(buildIndexedAnchorId("sec", "Label", 1)).toBe("sec-label-2");
      expect(buildIndexedAnchorId("sec", "Label", 9)).toBe("sec-label-10");
    });
  });

  describe("label slugification", () => {
    it("converts to lowercase", () => {
      const result = buildIndexedAnchorId("pre", "UPPERCASE", 0);

      expect(result).toBe("pre-uppercase-1");
    });

    it("replaces spaces with hyphens", () => {
      const result = buildIndexedAnchorId("pre", "Multiple Words Here", 0);

      expect(result).toBe("pre-multiple-words-here-1");
    });

    it("replaces special characters with hyphens", () => {
      const result = buildIndexedAnchorId("pre", "Hello! World?", 0);

      expect(result).toBe("pre-hello-world-1");
    });

    it("removes leading and trailing hyphens", () => {
      const result = buildIndexedAnchorId("pre", "!Start & End!", 0);

      expect(result).toBe("pre-start-end-1");
    });

    it("collapses multiple consecutive special characters", () => {
      const result = buildIndexedAnchorId("pre", "Too   Many   Spaces", 0);

      expect(result).toBe("pre-too-many-spaces-1");
    });

    it("handles numbers in label", () => {
      const result = buildIndexedAnchorId("pre", "Section 42", 0);

      expect(result).toBe("pre-section-42-1");
    });

    it("handles mixed alphanumeric", () => {
      const result = buildIndexedAnchorId("pre", "Git v2.0 Commands", 0);

      expect(result).toBe("pre-git-v2-0-commands-1");
    });
  });

  describe("edge cases", () => {
    it("handles empty label with fallback to 'section'", () => {
      const result = buildIndexedAnchorId("pre", "", 0);

      expect(result).toBe("pre-section-1");
    });

    it("handles label with only special characters", () => {
      const result = buildIndexedAnchorId("pre", "!@#$%", 0);

      expect(result).toBe("pre-section-1");
    });

    it("handles whitespace-only label", () => {
      const result = buildIndexedAnchorId("pre", "   ", 0);

      expect(result).toBe("pre-section-1");
    });

    it("handles empty prefix", () => {
      const result = buildIndexedAnchorId("", "Label", 0);

      expect(result).toBe("-label-1");
    });
  });

  describe("prefix handling", () => {
    it("uses prefix as-is without modification", () => {
      const result = buildIndexedAnchorId("my-custom-prefix", "Label", 0);

      expect(result).toBe("my-custom-prefix-label-1");
    });

    it("preserves prefix casing", () => {
      const result = buildIndexedAnchorId("MyPrefix", "Label", 0);

      expect(result).toBe("MyPrefix-label-1");
    });
  });

  describe("real-world examples", () => {
    it("handles typical cheatsheet section names", () => {
      expect(buildIndexedAnchorId("sheet", "Getting Started", 0)).toBe("sheet-getting-started-1");
      expect(buildIndexedAnchorId("sheet", "File I/O", 1)).toBe("sheet-file-i-o-2");
      expect(buildIndexedAnchorId("sheet", "Ctrl+C / Ctrl+V", 2)).toBe("sheet-ctrl-c-ctrl-v-3");
    });

    it("handles unicode-like names by stripping them", () => {
      // Only a-z and 0-9 are kept
      const result = buildIndexedAnchorId("pre", "Émojis 🎉", 0);

      expect(result).toBe("pre-mojis-1");
    });
  });
});

describe("buildBlockAnchorId", () => {
  it("builds a stable anchor from block id", () => {
    expect(buildBlockAnchorId("sheet-heading", "inspect-and-diff")).toBe("sheet-heading-inspect-and-diff");
  });

  it("slugifies unusual block ids defensively", () => {
    expect(buildBlockAnchorId("sheet-heading", "Git v2.0")).toBe("sheet-heading-git-v2-0");
  });
});
