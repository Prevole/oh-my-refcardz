/** Distance from viewport edge where auto-scroll activates (px) */
export const AUTO_SCROLL_THRESHOLD = 80;
/** Maximum scroll speed (px per frame) */
export const AUTO_SCROLL_MAX_SPEED = 15;

/**
 * Calculates scroll speed based on pointer distance from viewport edge.
 * Returns negative value for scrolling up, positive for scrolling down, 0 if no scroll needed.
 *
 * @param clientY - The Y coordinate of the pointer relative to the viewport
 * @param viewportHeight - The height of the viewport (defaults to window.innerHeight)
 */
export function calculateAutoScrollSpeed(clientY: number, viewportHeight: number): number {
  // Near top edge - scroll up (negative)
  if (clientY < AUTO_SCROLL_THRESHOLD) {
    const proximity = 1 - clientY / AUTO_SCROLL_THRESHOLD;
    return -Math.round(AUTO_SCROLL_MAX_SPEED * proximity);
  }

  // Near bottom edge - scroll down (positive)
  if (clientY > viewportHeight - AUTO_SCROLL_THRESHOLD) {
    const distanceFromBottom = viewportHeight - clientY;
    const proximity = 1 - distanceFromBottom / AUTO_SCROLL_THRESHOLD;
    return Math.round(AUTO_SCROLL_MAX_SPEED * proximity);
  }

  return 0;
}
