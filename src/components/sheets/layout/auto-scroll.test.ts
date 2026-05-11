import { describe, it, expect } from "vitest";
import {
  calculateAutoScrollSpeed,
  AUTO_SCROLL_THRESHOLD,
  AUTO_SCROLL_MAX_SPEED,
} from "./auto-scroll";

describe("calculateAutoScrollSpeed", () => {
  const viewportHeight = 800;

  describe("when pointer is in the middle of viewport", () => {
    it("returns 0 when pointer is in the safe zone", () => {
      expect(calculateAutoScrollSpeed(400, viewportHeight)).toBe(0);
    });

    it("returns 0 when pointer is just inside the top threshold", () => {
      expect(calculateAutoScrollSpeed(AUTO_SCROLL_THRESHOLD, viewportHeight)).toBe(0);
    });

    it("returns 0 when pointer is just inside the bottom threshold", () => {
      expect(calculateAutoScrollSpeed(viewportHeight - AUTO_SCROLL_THRESHOLD, viewportHeight)).toBe(0);
    });
  });

  describe("when pointer is near the top edge", () => {
    it("returns negative speed (scroll up) when pointer is at top edge", () => {
      const speed = calculateAutoScrollSpeed(0, viewportHeight);
      expect(speed).toBe(-AUTO_SCROLL_MAX_SPEED);
    });

    it("returns smaller negative speed when pointer is further from edge", () => {
      const speed = calculateAutoScrollSpeed(AUTO_SCROLL_THRESHOLD / 2, viewportHeight);
      expect(speed).toBeLessThan(0);
      expect(speed).toBeGreaterThan(-AUTO_SCROLL_MAX_SPEED);
    });

    it("returns proportional speed based on proximity to edge", () => {
      // At 25% of threshold (close to edge) - should be ~75% of max speed
      const speedClose = calculateAutoScrollSpeed(AUTO_SCROLL_THRESHOLD * 0.25, viewportHeight);
      // At 75% of threshold (further from edge) - should be ~25% of max speed
      const speedFar = calculateAutoScrollSpeed(AUTO_SCROLL_THRESHOLD * 0.75, viewportHeight);

      expect(Math.abs(speedClose)).toBeGreaterThan(Math.abs(speedFar));
    });
  });

  describe("when pointer is near the bottom edge", () => {
    it("returns positive speed (scroll down) when pointer is at bottom edge", () => {
      const speed = calculateAutoScrollSpeed(viewportHeight, viewportHeight);
      expect(speed).toBe(AUTO_SCROLL_MAX_SPEED);
    });

    it("returns smaller positive speed when pointer is further from edge", () => {
      const pointerY = viewportHeight - AUTO_SCROLL_THRESHOLD / 2;
      const speed = calculateAutoScrollSpeed(pointerY, viewportHeight);
      expect(speed).toBeGreaterThan(0);
      expect(speed).toBeLessThan(AUTO_SCROLL_MAX_SPEED);
    });

    it("returns proportional speed based on proximity to edge", () => {
      // Close to bottom edge
      const speedClose = calculateAutoScrollSpeed(viewportHeight - AUTO_SCROLL_THRESHOLD * 0.25, viewportHeight);
      // Further from bottom edge
      const speedFar = calculateAutoScrollSpeed(viewportHeight - AUTO_SCROLL_THRESHOLD * 0.75, viewportHeight);

      expect(speedClose).toBeGreaterThan(speedFar);
    });
  });

  describe("edge cases", () => {
    it("returns max speed or higher for negative pointer positions", () => {
      const speed = calculateAutoScrollSpeed(-50, viewportHeight);
      expect(speed).toBeLessThanOrEqual(-AUTO_SCROLL_MAX_SPEED);
    });

    it("returns max speed or higher for pointer beyond viewport height", () => {
      const speed = calculateAutoScrollSpeed(viewportHeight + 50, viewportHeight);
      expect(speed).toBeGreaterThanOrEqual(AUTO_SCROLL_MAX_SPEED);
    });

    it("works with different viewport heights", () => {
      const smallViewport = 400;
      const largeViewport = 1200;

      // Near top should work the same
      expect(calculateAutoScrollSpeed(0, smallViewport)).toBe(-AUTO_SCROLL_MAX_SPEED);
      expect(calculateAutoScrollSpeed(0, largeViewport)).toBe(-AUTO_SCROLL_MAX_SPEED);

      // Near bottom should adapt to viewport size
      expect(calculateAutoScrollSpeed(smallViewport, smallViewport)).toBe(AUTO_SCROLL_MAX_SPEED);
      expect(calculateAutoScrollSpeed(largeViewport, largeViewport)).toBe(AUTO_SCROLL_MAX_SPEED);
    });
  });
});
