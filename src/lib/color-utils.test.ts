import { describe, it, expect } from "vitest";
import {
  deriveAnchorAccentColor,
  hexToHSL,
  hslToHex,
  interpolateHSL,
  getGridInterpolationFactor,
} from "./color-utils";

describe("hexToHSL", () => {
  describe("basic colors", () => {
    it("converts pure red", () => {
      const hsl = hexToHSL("#FF0000");

      expect(hsl.h).toBeCloseTo(0);
      expect(hsl.s).toBeCloseTo(1);
      expect(hsl.l).toBeCloseTo(0.5);
    });

    it("converts pure green", () => {
      const hsl = hexToHSL("#00FF00");

      expect(hsl.h).toBeCloseTo(1 / 3);
      expect(hsl.s).toBeCloseTo(1);
      expect(hsl.l).toBeCloseTo(0.5);
    });

    it("converts pure blue", () => {
      const hsl = hexToHSL("#0000FF");

      expect(hsl.h).toBeCloseTo(2 / 3);
      expect(hsl.s).toBeCloseTo(1);
      expect(hsl.l).toBeCloseTo(0.5);
    });

    it("converts white", () => {
      const hsl = hexToHSL("#FFFFFF");

      expect(hsl.h).toBe(0);
      expect(hsl.s).toBe(0);
      expect(hsl.l).toBeCloseTo(1);
    });

    it("converts black", () => {
      const hsl = hexToHSL("#000000");

      expect(hsl.h).toBe(0);
      expect(hsl.s).toBe(0);
      expect(hsl.l).toBeCloseTo(0);
    });

    it("converts gray (achromatic)", () => {
      const hsl = hexToHSL("#808080");

      expect(hsl.h).toBe(0);
      expect(hsl.s).toBe(0);
      expect(hsl.l).toBeCloseTo(0.5, 1);
    });
  });

  describe("hex format handling", () => {
    it("handles hex without hash", () => {
      const hsl = hexToHSL("FF0000");

      expect(hsl.h).toBeCloseTo(0);
      expect(hsl.s).toBeCloseTo(1);
    });

    it("handles shorthand hex (#RGB)", () => {
      const hsl = hexToHSL("#F00");

      expect(hsl.h).toBeCloseTo(0);
      expect(hsl.s).toBeCloseTo(1);
      expect(hsl.l).toBeCloseTo(0.5);
    });

    it("handles lowercase hex", () => {
      const hsl = hexToHSL("#ff0000");

      expect(hsl.h).toBeCloseTo(0);
      expect(hsl.s).toBeCloseTo(1);
    });
  });

  describe("complex colors", () => {
    it("converts cyan (#00FFFF)", () => {
      const hsl = hexToHSL("#00FFFF");

      expect(hsl.h).toBeCloseTo(0.5);
      expect(hsl.s).toBeCloseTo(1);
      expect(hsl.l).toBeCloseTo(0.5);
    });

    it("converts magenta (#FF00FF)", () => {
      const hsl = hexToHSL("#FF00FF");

      expect(hsl.h).toBeCloseTo(5 / 6);
      expect(hsl.s).toBeCloseTo(1);
      expect(hsl.l).toBeCloseTo(0.5);
    });

    it("converts yellow (#FFFF00)", () => {
      const hsl = hexToHSL("#FFFF00");

      expect(hsl.h).toBeCloseTo(1 / 6);
      expect(hsl.s).toBeCloseTo(1);
      expect(hsl.l).toBeCloseTo(0.5);
    });
  });
});

describe("hslToHex", () => {
  describe("basic colors", () => {
    it("converts pure red", () => {
      const hex = hslToHex({ h: 0, s: 1, l: 0.5 });

      expect(hex.toLowerCase()).toBe("#ff0000");
    });

    it("converts pure green", () => {
      const hex = hslToHex({ h: 1 / 3, s: 1, l: 0.5 });

      expect(hex.toLowerCase()).toBe("#00ff00");
    });

    it("converts pure blue", () => {
      const hex = hslToHex({ h: 2 / 3, s: 1, l: 0.5 });

      expect(hex.toLowerCase()).toBe("#0000ff");
    });

    it("converts white", () => {
      const hex = hslToHex({ h: 0, s: 0, l: 1 });

      expect(hex.toLowerCase()).toBe("#ffffff");
    });

    it("converts black", () => {
      const hex = hslToHex({ h: 0, s: 0, l: 0 });

      expect(hex.toLowerCase()).toBe("#000000");
    });
  });

  describe("grayscale (s = 0)", () => {
    it("converts mid-gray", () => {
      const hex = hslToHex({ h: 0, s: 0, l: 0.5 });

      expect(hex.toLowerCase()).toBe("#808080");
    });

    it("converts dark gray", () => {
      const hex = hslToHex({ h: 0, s: 0, l: 0.25 });

      expect(hex.toLowerCase()).toBe("#404040");
    });

    it("converts light gray", () => {
      const hex = hslToHex({ h: 0, s: 0, l: 0.75 });

      expect(hex.toLowerCase()).toBe("#bfbfbf");
    });
  });

  describe("roundtrip consistency", () => {
    it("hex -> hsl -> hex produces same result", () => {
      const original = "#4ECDC4";
      const hsl = hexToHSL(original);
      const result = hslToHex(hsl);

      expect(result.toLowerCase()).toBe(original.toLowerCase());
    });

    it("handles multiple roundtrips", () => {
      const testColors = ["#FF6B6B", "#A78BFA", "#34D399", "#FBBF24"];

      for (const color of testColors) {
        const hsl = hexToHSL(color);
        const result = hslToHex(hsl);
        expect(result.toLowerCase()).toBe(color.toLowerCase());
      }
    });
  });
});

describe("interpolateHSL", () => {
  describe("basic interpolation", () => {
    it("returns start color at t=0", () => {
      const result = interpolateHSL("#FF0000", "#0000FF", 0);

      expect(result.toLowerCase()).toBe("#ff0000");
    });

    it("returns end color at t=1", () => {
      const result = interpolateHSL("#FF0000", "#0000FF", 1);

      expect(result.toLowerCase()).toBe("#0000ff");
    });

    it("returns midpoint color at t=0.5", () => {
      const result = interpolateHSL("#FF0000", "#0000FF", 0.5);
      const hsl = hexToHSL(result);

      expect(hsl.h).toBeGreaterThan(0.6);
      expect(hsl.h).toBeLessThan(0.9);
    });
  });

  describe("clamping", () => {
    it("clamps t < 0 to 0", () => {
      const result = interpolateHSL("#FF0000", "#0000FF", -0.5);

      expect(result.toLowerCase()).toBe("#ff0000");
    });

    it("clamps t > 1 to 1", () => {
      const result = interpolateHSL("#FF0000", "#0000FF", 1.5);

      expect(result.toLowerCase()).toBe("#0000ff");
    });
  });

  describe("grayscale interpolation", () => {
    it("interpolates between black and white", () => {
      const result = interpolateHSL("#000000", "#FFFFFF", 0.5);
      const hsl = hexToHSL(result);

      expect(hsl.l).toBeCloseTo(0.5, 1);
    });
  });

  describe("hue shortest path", () => {
    it("takes shortest path around color wheel", () => {
      const result = interpolateHSL("#FF0000", "#FF00FF", 0.5);
      const hsl = hexToHSL(result);

      expect(hsl.s).toBeCloseTo(1, 1);
    });
  });

  describe("saturation and lightness interpolation", () => {
    it("interpolates saturation", () => {
      const vivid = "#FF0000";
      const muted = "#804040"; // less saturated red

      const result = interpolateHSL(vivid, muted, 0.5);
      const vividHSL = hexToHSL(vivid);
      const mutedHSL = hexToHSL(muted);
      const resultHSL = hexToHSL(result);

      expect(resultHSL.s).toBeLessThan(vividHSL.s);
      expect(resultHSL.s).toBeGreaterThan(mutedHSL.s);
    });

    it("interpolates lightness", () => {
      // Dark blue to light blue
      const dark = "#000080";
      const light = "#8080FF";

      const result = interpolateHSL(dark, light, 0.5);
      const darkHSL = hexToHSL(dark);
      const lightHSL = hexToHSL(light);
      const resultHSL = hexToHSL(result);

      expect(resultHSL.l).toBeGreaterThan(darkHSL.l);
      expect(resultHSL.l).toBeLessThan(lightHSL.l);
    });
  });
});

describe("deriveAnchorAccentColor", () => {
  it("returns a valid hex color", () => {
    expect(deriveAnchorAccentColor("#4ECDC4")).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it("derives a color distinct from the source accent", () => {
    expect(deriveAnchorAccentColor("#4ECDC4").toLowerCase()).not.toBe("#4ecdc4");
  });

  it("keeps derived colors in a readable lightness range", () => {
    const derived = hexToHSL(deriveAnchorAccentColor("#F97316"));

    expect(derived.l).toBeGreaterThanOrEqual(0.52);
    expect(derived.l).toBeLessThanOrEqual(0.62);
  });

  it("works for low saturation colors", () => {
    const derived = hexToHSL(deriveAnchorAccentColor("#808080"));

    expect(derived.s).toBeGreaterThanOrEqual(0.5);
    expect(derived.s).toBeLessThanOrEqual(0.72);
  });
});

// ---------------------------------------------------------------------------
// getGridInterpolationFactor
// ---------------------------------------------------------------------------

describe("getGridInterpolationFactor", () => {
  describe("basic calculations", () => {
    it("returns 0 for top-left corner (0,0)", () => {
      const factor = getGridInterpolationFactor(0, 0, 3, 3);

      expect(factor).toBe(0);
    });

    it("returns 1 for bottom-right corner (maxRow, maxCol)", () => {
      const factor = getGridInterpolationFactor(3, 3, 3, 3);

      expect(factor).toBe(1);
    });

    it("returns 0.5 for center of grid", () => {
      // 2x2 grid: (1,1) with max (2,2) -> (1+1)/(2+2) = 0.5
      const factor = getGridInterpolationFactor(1, 1, 2, 2);

      expect(factor).toBe(0.5);
    });
  });

  describe("diagonal progression", () => {
    it("increases along diagonal from top-left to bottom-right", () => {
      const f00 = getGridInterpolationFactor(0, 0, 2, 2);
      const f11 = getGridInterpolationFactor(1, 1, 2, 2);
      const f22 = getGridInterpolationFactor(2, 2, 2, 2);

      expect(f00).toBeLessThan(f11);
      expect(f11).toBeLessThan(f22);
    });

    it("same row+col sum yields same factor", () => {
      // (0,2) and (2,0) and (1,1) all have sum = 2
      const f02 = getGridInterpolationFactor(0, 2, 3, 3);
      const f20 = getGridInterpolationFactor(2, 0, 3, 3);
      const f11 = getGridInterpolationFactor(1, 1, 3, 3);

      expect(f02).toBeCloseTo(f20);
      expect(f02).toBeCloseTo(f11);
    });
  });

  describe("edge cases", () => {
    it("returns 0 when maxSum is 0", () => {
      const factor = getGridInterpolationFactor(0, 0, 0, 0);

      expect(factor).toBe(0);
    });

    it("handles single row grid", () => {
      const factor = getGridInterpolationFactor(0, 2, 0, 4);

      expect(factor).toBe(0.5);
    });

    it("handles single column grid", () => {
      const factor = getGridInterpolationFactor(2, 0, 4, 0);

      expect(factor).toBe(0.5);
    });
  });

  describe("asymmetric grids", () => {
    it("handles wide grid (more columns than rows)", () => {
      // 2 rows x 8 cols: maxSum = 1 + 7 = 8
      const factor = getGridInterpolationFactor(1, 4, 1, 7);

      expect(factor).toBe(5 / 8);
    });

    it("handles tall grid (more rows than columns)", () => {
      // 8 rows x 2 cols: maxSum = 7 + 1 = 8
      const factor = getGridInterpolationFactor(4, 1, 7, 1);

      expect(factor).toBe(5 / 8);
    });
  });
});
