/**
 * Grid constants shared across the layout system.
 *
 * These define the geometry of the cheatsheet grid and are server-safe
 * (no React, no DOM). Anything that needs to reason about the grid
 * (layout engine, block definitions, persistence, server-side rendering
 * of SVG previews) should import from here.
 */

/** Number of columns in the cheatsheet grid. */
export const GRID_COLUMNS = 64;

/** Gap between grid cells, in pixels. */
export const GRID_GAP_PX = 8;

/** Maximum number of rows a single block may span. */
export const MAX_ROW_SPAN = 72;
