import { describe, it, expect } from "vitest";
import {
  getCategoryPrimaryColor,
  getSecondaryColorForColumn,
  getCategoryGradientPair,
  CATEGORY_PRIMARY_COLORS,
  GRADIENT_SECONDARY_COLORS,
  CATEGORY_GRADIENT_PAIRS,
} from "./color-palette";

// ---------------------------------------------------------------------------
// getCategoryPrimaryColor
// ---------------------------------------------------------------------------

describe("getCategoryPrimaryColor", () => {
  describe("valid order values", () => {
    it("returns first color for order 1", () => {
      const color = getCategoryPrimaryColor(1);

      expect(color).toBe(CATEGORY_PRIMARY_COLORS[0]);
      expect(color).toBe("#00D4FF");
    });

    it("returns correct color for order 5", () => {
      const color = getCategoryPrimaryColor(5);

      expect(color).toBe(CATEGORY_PRIMARY_COLORS[4]);
      expect(color).toBe("#14B8A6");
    });

    it("returns last color for order 10", () => {
      const color = getCategoryPrimaryColor(10);

      expect(color).toBe(CATEGORY_PRIMARY_COLORS[9]);
      expect(color).toBe("#F43F5E");
    });
  });

  describe("boundary handling", () => {
    it("clamps order 0 to first color", () => {
      const color = getCategoryPrimaryColor(0);

      expect(color).toBe(CATEGORY_PRIMARY_COLORS[0]);
    });

    it("clamps negative order to first color", () => {
      const color = getCategoryPrimaryColor(-5);

      expect(color).toBe(CATEGORY_PRIMARY_COLORS[0]);
    });

    it("clamps order > 10 to last color", () => {
      const color = getCategoryPrimaryColor(15);

      expect(color).toBe(CATEGORY_PRIMARY_COLORS[9]);
    });

    it("clamps very large order to last color", () => {
      const color = getCategoryPrimaryColor(1000);

      expect(color).toBe(CATEGORY_PRIMARY_COLORS[9]);
    });
  });

  describe("all colors are valid hex", () => {
    it("returns valid hex colors for all orders", () => {
      const hexRegex = /^#[0-9A-F]{6}$/i;

      for (let order = 1; order <= 10; order++) {
        const color = getCategoryPrimaryColor(order);
        expect(color).toMatch(hexRegex);
      }
    });
  });
});

// ---------------------------------------------------------------------------
// getSecondaryColorForColumn
// ---------------------------------------------------------------------------

describe("getSecondaryColorForColumn", () => {
  describe("direct index access", () => {
    it("returns first color for column 0", () => {
      const color = getSecondaryColorForColumn(0);

      expect(color).toBe(GRADIENT_SECONDARY_COLORS[0]);
      expect(color).toBe("#FF6B6B");
    });

    it("returns correct color for column 5", () => {
      const color = getSecondaryColorForColumn(5);

      expect(color).toBe(GRADIENT_SECONDARY_COLORS[5]);
      expect(color).toBe("#C4F54A");
    });

    it("returns last color for column 9", () => {
      const color = getSecondaryColorForColumn(9);

      expect(color).toBe(GRADIENT_SECONDARY_COLORS[9]);
      expect(color).toBe("#FFAB76");
    });
  });

  describe("cycling behavior", () => {
    it("cycles back to first color at column 10", () => {
      const color = getSecondaryColorForColumn(10);

      expect(color).toBe(GRADIENT_SECONDARY_COLORS[0]);
    });

    it("cycles correctly for column 15", () => {
      const color = getSecondaryColorForColumn(15);

      expect(color).toBe(GRADIENT_SECONDARY_COLORS[5]);
    });

    it("cycles correctly for large column index", () => {
      const color = getSecondaryColorForColumn(23);

      expect(color).toBe(GRADIENT_SECONDARY_COLORS[3]);
    });
  });

  describe("all colors are valid hex", () => {
    it("returns valid hex colors for first 10 columns", () => {
      const hexRegex = /^#[0-9A-F]{6}$/i;

      for (let col = 0; col < 10; col++) {
        const color = getSecondaryColorForColumn(col);
        expect(color).toMatch(hexRegex);
      }
    });
  });
});

// ---------------------------------------------------------------------------
// getCategoryGradientPair
// ---------------------------------------------------------------------------

describe("getCategoryGradientPair", () => {
  describe("valid order values", () => {
    it("returns first gradient for order 1", () => {
      const gradient = getCategoryGradientPair(1);

      expect(gradient).toEqual(CATEGORY_GRADIENT_PAIRS[0]);
      expect(gradient.from).toBe("#4ECDC4");
      expect(gradient.to).toBe("#FF8C42");
    });

    it("returns correct gradient for order 5", () => {
      const gradient = getCategoryGradientPair(5);

      expect(gradient).toEqual(CATEGORY_GRADIENT_PAIRS[4]);
      expect(gradient.from).toBe("#F472B6");
      expect(gradient.to).toBe("#38BDF8");
    });

    it("returns last gradient for order 10", () => {
      const gradient = getCategoryGradientPair(10);

      expect(gradient).toEqual(CATEGORY_GRADIENT_PAIRS[9]);
      expect(gradient.from).toBe("#A3E635");
      expect(gradient.to).toBe("#E879F9");
    });
  });

  describe("cycling behavior", () => {
    it("cycles back to first gradient for order 11", () => {
      const gradient = getCategoryGradientPair(11);

      expect(gradient).toEqual(CATEGORY_GRADIENT_PAIRS[0]);
    });

    it("cycles correctly for order 15", () => {
      const gradient = getCategoryGradientPair(15);

      expect(gradient).toEqual(CATEGORY_GRADIENT_PAIRS[4]);
    });

    it("cycles correctly for large order", () => {
      const gradient = getCategoryGradientPair(23);

      expect(gradient).toEqual(CATEGORY_GRADIENT_PAIRS[2]);
    });
  });

  describe("zero and negative orders", () => {
    it("returns last gradient for order 0", () => {
      const gradient = getCategoryGradientPair(0);

      expect(gradient).toEqual(CATEGORY_GRADIENT_PAIRS[9]);
    });

    it("cycles correctly for negative order -1", () => {
      const gradient = getCategoryGradientPair(-1);

      expect(gradient).toEqual(CATEGORY_GRADIENT_PAIRS[8]);
    });

    it("cycles correctly for negative order -10", () => {
      const gradient = getCategoryGradientPair(-10);

      expect(gradient).toEqual(CATEGORY_GRADIENT_PAIRS[9]);
    });
  });

  describe("edge cases", () => {
    it("returns last gradient for NaN", () => {
      const gradient = getCategoryGradientPair(NaN);

      expect(gradient).toEqual(CATEGORY_GRADIENT_PAIRS[9]);
    });

    it("returns last gradient for Infinity", () => {
      const gradient = getCategoryGradientPair(Infinity);

      expect(gradient).toEqual(CATEGORY_GRADIENT_PAIRS[9]);
    });

    it("returns last gradient for -Infinity", () => {
      const gradient = getCategoryGradientPair(-Infinity);

      expect(gradient).toEqual(CATEGORY_GRADIENT_PAIRS[9]);
    });
  });

  describe("gradient structure", () => {
    it("all gradients have from and to properties", () => {
      for (let order = 1; order <= 10; order++) {
        const gradient = getCategoryGradientPair(order);

        expect(gradient).toHaveProperty("from");
        expect(gradient).toHaveProperty("to");
      }
    });

    it("all gradient colors are valid hex", () => {
      const hexRegex = /^#[0-9A-F]{6}$/i;

      for (let order = 1; order <= 10; order++) {
        const gradient = getCategoryGradientPair(order);

        expect(gradient.from).toMatch(hexRegex);
        expect(gradient.to).toMatch(hexRegex);
      }
    });

    it("from and to colors are different", () => {
      for (let order = 1; order <= 10; order++) {
        const gradient = getCategoryGradientPair(order);

        expect(gradient.from).not.toBe(gradient.to);
      }
    });
  });
});

// ---------------------------------------------------------------------------
// Constants integrity
// ---------------------------------------------------------------------------

describe("Constants integrity", () => {
  it("CATEGORY_PRIMARY_COLORS has 10 colors", () => {
    expect(CATEGORY_PRIMARY_COLORS).toHaveLength(10);
  });

  it("GRADIENT_SECONDARY_COLORS has 10 colors", () => {
    expect(GRADIENT_SECONDARY_COLORS).toHaveLength(10);
  });

  it("CATEGORY_GRADIENT_PAIRS has 10 pairs", () => {
    expect(CATEGORY_GRADIENT_PAIRS).toHaveLength(10);
  });

  it("all primary colors are unique", () => {
    const unique = new Set(CATEGORY_PRIMARY_COLORS);
    expect(unique.size).toBe(CATEGORY_PRIMARY_COLORS.length);
  });

  it("all secondary colors are unique", () => {
    const unique = new Set(GRADIENT_SECONDARY_COLORS);
    expect(unique.size).toBe(GRADIENT_SECONDARY_COLORS.length);
  });
});
