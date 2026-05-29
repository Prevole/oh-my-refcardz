import { describe, it, expect } from "vitest";

/**
 * Verifies the block-types registry API. The registry is populated by side
 * effects when ./heading and ./card are imported (via the barrel below).
 *
 * Renderers are tested separately in the components layer; this file
 * focuses on data: constraints, resize handles, and registration lookups.
 */

import {
  getBlockConstraints,
  getBlockTypeDefinition,
  getRegisteredBlockKinds,
  getResizeHandles,
  isRegisteredBlockKind,
  isResizeDirectionEnabled,
  type LayoutBlockKind,
  type ResizeHandleDirection,
} from "./index";

describe("blocks-registry", () => {
  describe("getRegisteredBlockKinds", () => {
    it("returns all registered block kinds", () => {
      const kinds = getRegisteredBlockKinds();
      expect(kinds).toContain("heading");
      expect(kinds).toContain("card");
      expect(kinds).toHaveLength(2);
    });
  });

  describe("getBlockTypeDefinition", () => {
    it("returns the definition for heading block", () => {
      const definition = getBlockTypeDefinition("heading");
      expect(definition.constraints).toBeDefined();
      expect(definition.resizeHandles).toBeDefined();
    });

    it("returns the definition for card block", () => {
      const definition = getBlockTypeDefinition("card");
      expect(definition.constraints).toBeDefined();
      expect(definition.resizeHandles).toBeDefined();
    });

    it("throws for unknown block kind", () => {
      expect(() => getBlockTypeDefinition("unknown" as LayoutBlockKind)).toThrow(
        'Block type "unknown" is not registered'
      );
    });
  });

  describe("isRegisteredBlockKind", () => {
    it("returns true for registered kinds", () => {
      expect(isRegisteredBlockKind("heading")).toBe(true);
      expect(isRegisteredBlockKind("card")).toBe(true);
    });

    it("returns false for unknown values", () => {
      expect(isRegisteredBlockKind("unknown")).toBe(false);
      expect(isRegisteredBlockKind(null)).toBe(false);
      expect(isRegisteredBlockKind(undefined)).toBe(false);
      expect(isRegisteredBlockKind(42)).toBe(false);
    });
  });

  describe("getBlockConstraints", () => {
    it("returns constraints for heading block", () => {
      const constraints = getBlockConstraints("heading");
      expect(constraints.minColSpan).toBe(12);
      expect(constraints.maxColSpan).toBe(64);
      expect(constraints.minRowSpan).toBe(3);
      expect(constraints.maxRowSpan).toBe(3);
    });

    it("returns constraints for card block", () => {
      const constraints = getBlockConstraints("card");
      expect(constraints.minColSpan).toBe(6);
      expect(constraints.maxColSpan).toBe(64);
      expect(constraints.minRowSpan).toBe(4);
      expect(constraints.maxRowSpan).toBe(72);
    });
  });

  describe("getResizeHandles", () => {
    it("returns only horizontal handles for heading block", () => {
      const handles = getResizeHandles("heading");
      expect(handles).toContain("east");
      expect(handles).toContain("west");
      expect(handles).toHaveLength(2);
    });

    it("returns all handles for card block", () => {
      const handles = getResizeHandles("card");
      const expectedHandles: ResizeHandleDirection[] = [
        "north",
        "south",
        "east",
        "west",
        "north-east",
        "north-west",
        "south-east",
        "south-west",
      ];
      for (const handle of expectedHandles) {
        expect(handles).toContain(handle);
      }
      expect(handles).toHaveLength(8);
    });
  });

  describe("isResizeDirectionEnabled", () => {
    describe("heading block", () => {
      it("allows east resize", () => {
        expect(isResizeDirectionEnabled("heading", "east")).toBe(true);
      });

      it("allows west resize", () => {
        expect(isResizeDirectionEnabled("heading", "west")).toBe(true);
      });

      it("blocks north resize", () => {
        expect(isResizeDirectionEnabled("heading", "north")).toBe(false);
      });

      it("blocks south resize", () => {
        expect(isResizeDirectionEnabled("heading", "south")).toBe(false);
      });

      it("blocks corner resizes", () => {
        expect(isResizeDirectionEnabled("heading", "north-east")).toBe(false);
        expect(isResizeDirectionEnabled("heading", "north-west")).toBe(false);
        expect(isResizeDirectionEnabled("heading", "south-east")).toBe(false);
        expect(isResizeDirectionEnabled("heading", "south-west")).toBe(false);
      });
    });

    describe("card block", () => {
      it("allows all resize directions", () => {
        const allDirections: ResizeHandleDirection[] = [
          "north",
          "south",
          "east",
          "west",
          "north-east",
          "north-west",
          "south-east",
          "south-west",
        ];
        for (const direction of allDirections) {
          expect(isResizeDirectionEnabled("card", direction)).toBe(true);
        }
      });
    });
  });
});
