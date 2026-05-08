import { describe, expect, it } from "vitest";
import { resolveInlineReferenceToken } from "./inline-rich-text";

describe("resolveInlineReferenceToken", () => {
  const knownSlugs = new Set(["git", "1password"]);

  it("resolves local anchor references", () => {
    expect(resolveInlineReferenceToken("[[#working-tree-status]]", knownSlugs)).toEqual({
      href: "#working-tree-status",
      label: "working-tree-status",
      variant: "anchor",
    });
  });

  it("resolves cross-sheet anchor references", () => {
    expect(resolveInlineReferenceToken("[[git#working-tree-status|Status setup]]", knownSlugs)).toEqual({
      href: "/cheatsheets/git#working-tree-status",
      label: "Status setup",
      variant: "anchor",
    });
  });

  it("keeps existing cross-sheet references working", () => {
    expect(resolveInlineReferenceToken("[[1password|1Password]]", knownSlugs)).toEqual({
      href: "/cheatsheets/1password",
      label: "1Password",
      variant: "sheet",
    });
  });

  it("rejects unknown slugs and invalid anchors", () => {
    expect(resolveInlineReferenceToken("[[unknown#anchor]]", knownSlugs)).toBeNull();
    expect(resolveInlineReferenceToken("[[#Working Tree]]", knownSlugs)).toBeNull();
  });
});
