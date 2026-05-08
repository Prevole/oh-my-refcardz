type HSL = { h: number; s: number; l: number };

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function hexToHSL(hex: string): HSL {
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

export function interpolateHSL(colorFrom: string, colorTo: string, t: number): string {
  const from = hexToHSL(colorFrom);
  const to = hexToHSL(colorTo);

  const clampedT = Math.max(0, Math.min(1, t));

  let hDiff = to.h - from.h;
  if (hDiff > 0.5) hDiff -= 1;
  /* v8 ignore next -- hue wraparound: only triggers when from.h > to.h by more than 180° */
  if (hDiff < -0.5) hDiff += 1;

  const h = (from.h + hDiff * clampedT + 1) % 1;
  const s = from.s + (to.s - from.s) * clampedT;
  const l = from.l + (to.l - from.l) * clampedT;

  return hslToHex({ h, s, l });
}

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

export function deriveAnchorAccentColor(hex: string): string {
  const { h, s, l } = hexToHSL(hex);

  return hslToHex({
    h: (h + 0.46) % 1,
    s: clamp(Math.max(s * 0.78, 0.54), 0.54, 0.72),
    l: clamp(Math.max(l, 0.52), 0.52, 0.62),
  });
}
