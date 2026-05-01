/**
 * Color utilities for HSL interpolation.
 * Used to create gradient effects across hex grids.
 */

type HSL = { h: number; s: number; l: number };

/**
 * Parse a hex color string to HSL values.
 * Supports #RGB and #RRGGBB formats.
 */
export function hexToHSL(hex: string): HSL {
  // Normalize hex
  let normalizedHex = hex.replace("#", "");
  if (normalizedHex.length === 3) {
    normalizedHex = normalizedHex
      .split("")
      .map((c) => c + c)
      .join("");
  }

  const r = parseInt(normalizedHex.slice(0, 2), 16) / 255;
  const g = parseInt(normalizedHex.slice(2, 4), 16) / 255;
  const b = parseInt(normalizedHex.slice(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;

  if (max === min) {
    return { h: 0, s: 0, l };
  }

  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

  let h: number;
  switch (max) {
    case r:
      h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
      break;
    case g:
      h = ((b - r) / d + 2) / 6;
      break;
    default:
      h = ((r - g) / d + 4) / 6;
      break;
  }

  return { h, s, l };
}

/**
 * Convert HSL values to a hex color string.
 */
export function hslToHex(hsl: HSL): string {
  const { h, s, l } = hsl;

  if (s === 0) {
    const gray = Math.round(l * 255);
    return `#${gray.toString(16).padStart(2, "0").repeat(3)}`;
  }

  const hue2rgb = (p: number, q: number, t: number): number => {
    let normalizedT = t;
    if (normalizedT < 0) normalizedT += 1;
    if (normalizedT > 1) normalizedT -= 1;
    if (normalizedT < 1 / 6) return p + (q - p) * 6 * normalizedT;
    if (normalizedT < 1 / 2) return q;
    if (normalizedT < 2 / 3) return p + (q - p) * (2 / 3 - normalizedT) * 6;
    return p;
  };

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;

  const r = Math.round(hue2rgb(p, q, h + 1 / 3) * 255);
  const g = Math.round(hue2rgb(p, q, h) * 255);
  const b = Math.round(hue2rgb(p, q, h - 1 / 3) * 255);

  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

/**
 * Interpolate between two hex colors in HSL space.
 * @param colorFrom - Starting color (hex)
 * @param colorTo - Ending color (hex)
 * @param t - Interpolation factor (0.0 to 1.0)
 * @returns Interpolated color as hex string
 */
export function interpolateHSL(colorFrom: string, colorTo: string, t: number): string {
  const from = hexToHSL(colorFrom);
  const to = hexToHSL(colorTo);

  // Clamp t to [0, 1]
  const clampedT = Math.max(0, Math.min(1, t));

  // Handle hue interpolation (shortest path around the color wheel)
  let hDiff = to.h - from.h;
  if (hDiff > 0.5) hDiff -= 1;
  if (hDiff < -0.5) hDiff += 1;

  const h = (from.h + hDiff * clampedT + 1) % 1;
  const s = from.s + (to.s - from.s) * clampedT;
  const l = from.l + (to.l - from.l) * clampedT;

  return hslToHex({ h, s, l });
}

/**
 * Calculate interpolation factor for a position in a grid.
 * Uses diagonal interpolation (top-left to bottom-right).
 * @param rowIndex - Current row index
 * @param colIndex - Current column index
 * @param maxRow - Maximum row index in the grid
 * @param maxCol - Maximum column index in the grid
 * @returns Interpolation factor (0.0 to 1.0)
 */
export function getGridInterpolationFactor(
  rowIndex: number,
  colIndex: number,
  maxRow: number,
  maxCol: number
): number {
  const maxSum = maxRow + maxCol;
  if (maxSum === 0) return 0;
  return (rowIndex + colIndex) / maxSum;
}
