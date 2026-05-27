import { describe, it, expect } from "vitest";

/**
 * Verifies the renderer registry: each registered block kind has a
 * React component associated with it, and lookups throw for unknown kinds.
 *
 * Data-level concerns (constraints, resize handles) are tested in
 * src/lib/layout/blocks/blocks-registry.test.ts.
 */

import { getBlockRenderer, getRegisteredRendererKinds } from "./blocks-renderers";
import type { LayoutBlockKind } from "@/lib/layout/blocks";

// Side-effect imports to populate the renderer registry
import "./heading-block";
import "./card-block";

describe("blocks-renderers", () => {
  describe("getRegisteredRendererKinds", () => {
    it("returns all kinds with a registered renderer", () => {
      const kinds = getRegisteredRendererKinds();
      expect(kinds).toContain("heading");
      expect(kinds).toContain("card");
      expect(kinds).toHaveLength(2);
    });
  });

  describe("getBlockRenderer", () => {
    it("returns a component for heading", () => {
      const Component = getBlockRenderer("heading");
      expect(typeof Component).toBe("function");
    });

    it("returns a component for card", () => {
      const Component = getBlockRenderer("card");
      expect(typeof Component).toBe("function");
    });

    it("throws for unknown kind", () => {
      expect(() => getBlockRenderer("unknown" as LayoutBlockKind)).toThrow(
        'Block renderer for "unknown" is not registered'
      );
    });
  });
});
