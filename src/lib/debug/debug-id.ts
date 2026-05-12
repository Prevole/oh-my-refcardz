/**
 * Debug ID utilities for layout blocks.
 *
 * Generates human-readable single-letter IDs (A, B, C, ..., Z, AA, AB, ...)
 * for blocks based on their order of appearance in the layout.
 */

/**
 * Convert a number to a letter-based ID (0=A, 1=B, ..., 25=Z, 26=AA, etc.)
 */
export function numberToDebugId(n: number): string {
  let result = "";
  let num = n;

  do {
    result = String.fromCharCode(65 + (num % 26)) + result;
    num = Math.floor(num / 26) - 1;
  } while (num >= 0);

  return result;
}

/**
 * Create a map of block IDs to debug letters based on their visual order.
 * Blocks are sorted by Y position first, then X position.
 */
export function createDebugIdMap(
  blocks: Array<{ id: string; position: { x: number; y: number } }>
): Map<string, string> {
  // Sort blocks by position (top-to-bottom, left-to-right)
  const sorted = [...blocks].sort((a, b) => {
    if (a.position.y !== b.position.y) {
      return a.position.y - b.position.y;
    }
    return a.position.x - b.position.x;
  });

  const map = new Map<string, string>();
  sorted.forEach((block, index) => {
    map.set(block.id, numberToDebugId(index));
  });

  return map;
}
