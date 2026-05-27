import { GRID_COLUMNS } from "../grid-constants";
import { registerBlockType } from "./blocks-registry";

/**
 * Heading block: a horizontal section divider.
 *
 * - Fixed height (rowSpan = 2).
 * - Resizable horizontally only (east/west handles).
 * - Width range: 12 columns to the full grid.
 */
registerBlockType("heading", {
  constraints: {
    minColSpan: 12,
    maxColSpan: GRID_COLUMNS,
    minRowSpan: 2,
    maxRowSpan: 2,
  },
  resizeHandles: ["east", "west"],
});
