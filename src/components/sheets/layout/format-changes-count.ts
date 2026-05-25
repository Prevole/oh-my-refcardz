/**
 * Format a positive `changesCount` into the human-readable suffix
 * displayed by `LayoutModePill` (e.g. `1 change`, `5 changes`).
 *
 * The function is callable with `0`, but the pill consumer guards
 * the suffix display upstream — callers that pass `0` get the
 * grammatically-correct plural form `0 changes` as a side effect,
 * which is acceptable as a defensive default.
 */
export function formatChangesCount(count: number): string {
  return count === 1 ? "1 change" : `${count} changes`;
}
