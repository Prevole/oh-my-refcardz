/**
 * Debug ID utilities for layout blocks.
 *
 * Generates human-readable single-letter IDs (A, B, C, ..., Z, AA, AB, ...)
 * for blocks based on their order of appearance in the YAML file.
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
 * Create a map of block IDs to debug letters based on YAML order.
 * The order of blocks in the input array is preserved (no sorting).
 * This ensures stable IDs that don't change when blocks move.
 */
export function createDebugIdMap(
  blocks: Array<{ id: string }>
): Map<string, string> {
  const map = new Map<string, string>();
  blocks.forEach((block, index) => {
    map.set(block.id, numberToDebugId(index));
  });

  return map;
}
