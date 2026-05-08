import { describe, expect, it } from "vitest";
import { getItemAnchorId, isValidAnchorId, parseInlineReferenceTarget } from "./anchors";

describe("anchors", () => {
  describe("isValidAnchorId", () => {
    it("accepts lowercase kebab-case ids", () => {
      expect(isValidAnchorId("working-tree-status")).toBe(true);
    });

    it("rejects uppercase, spaces, and underscores", () => {
      expect(isValidAnchorId("Working-Tree")).toBe(false);
      expect(isValidAnchorId("working tree")).toBe(false);
      expect(isValidAnchorId("working_tree")).toBe(false);
    });
  });

  describe("getItemAnchorId", () => {
    it("returns the first anchor entry id", () => {
      expect(
        getItemAnchorId([{ title: "Status" }, { anchor: "working-tree-status" }, { command: "git status" }])
      ).toBe("working-tree-status");
    });

    it("returns null when no anchor entry exists", () => {
      expect(getItemAnchorId([{ title: "Status" }, { command: "git status" }])).toBeNull();
    });
  });

  describe("parseInlineReferenceTarget", () => {
    it("parses local anchor references", () => {
      expect(parseInlineReferenceTarget("#working-tree-status")).toEqual({
        slug: null,
        anchor: "working-tree-status",
      });
    });

    it("parses sheet references without anchor", () => {
      expect(parseInlineReferenceTarget("git")).toEqual({
        slug: "git",
        anchor: null,
      });
    });

    it("parses sheet references with anchor", () => {
      expect(parseInlineReferenceTarget("git#working-tree-status")).toEqual({
        slug: "git",
        anchor: "working-tree-status",
      });
    });

    it("rejects invalid anchor fragments", () => {
      expect(parseInlineReferenceTarget("#Working Tree")).toBeNull();
      expect(parseInlineReferenceTarget("git#Working Tree")).toBeNull();
      expect(parseInlineReferenceTarget("git#one#two")).toBeNull();
    });
  });
});
