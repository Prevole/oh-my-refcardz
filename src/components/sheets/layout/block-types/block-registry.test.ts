import { describe, it, expect } from "vitest";

/**
 * These tests verify the block registry API works correctly.
 * Since the registry is populated at module load time by heading-block and card-block,
 * we test against the actual registered blocks rather than mocking.
 */

// Import the registry functions - this also triggers registration via side effects
import {
  getBlockConfig,
  getBlockConstraints,
  getResizeHandles,
  isResizeDirectionEnabled,
  getRegisteredBlockKinds,
  type LayoutBlockKind,
  type ResizeHandleDirection,
} from "./block-registry";

// Import block types to ensure they register themselves
import "./heading-block";
import "./card-block";

describe("block-registry", () => {
  describe("getRegisteredBlockKinds", () => {
    it("returns all registered block kinds", () => {
      const kinds = getRegisteredBlockKinds();
      expect(kinds).toContain("heading");
      expect(kinds).toContain("card");
      expect(kinds).toHaveLength(2);
    });
  });

  describe("getBlockConfig", () => {
    it("returns config for heading block", () => {
      const config = getBlockConfig("heading");
      expect(config).toBeDefined();
      expect(config.constraints).toBeDefined();
      expect(config.resizeHandles).toBeDefined();
      expect(config.render).toBeDefined();
    });

    it("returns config for card block", () => {
      const config = getBlockConfig("card");
      expect(config).toBeDefined();
      expect(config.constraints).toBeDefined();
      expect(config.resizeHandles).toBeDefined();
      expect(config.render).toBeDefined();
    });

    it("throws for unknown block kind", () => {
      expect(() => getBlockConfig("unknown" as LayoutBlockKind)).toThrow(
        'Block type "unknown" is not registered'
      );
    });
  });

  describe("getBlockConstraints", () => {
    it("returns constraints for heading block", () => {
      const constraints = getBlockConstraints("heading");
      expect(constraints.minColSpan).toBe(12);
      expect(constraints.maxColSpan).toBe(64);
      expect(constraints.minRowSpan).toBe(2);
      expect(constraints.maxRowSpan).toBe(2); // Fixed height
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

  describe("block renderers", () => {
    it("heading render is a valid component", () => {
      const config = getBlockConfig("heading");
      expect(typeof config.render).toBe("function");
    });

    it("card render is a valid component", () => {
      const config = getBlockConfig("card");
      expect(typeof config.render).toBe("function");
    });
  });
});
