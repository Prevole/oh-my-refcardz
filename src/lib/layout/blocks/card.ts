import { GRID_COLUMNS, MAX_ROW_SPAN } from "../grid-constants";
import { registerBlockType } from "./blocks-registry";

/**
 * Card block: a freely resizable content block.
 *
 * - Resizable in all eight directions.
 * - Width range: 6 columns to the full grid.
 * - Height range: 4 rows to MAX_ROW_SPAN.
 */
registerBlockType("card", {
  constraints: {
    minColSpan: 6,
    maxColSpan: GRID_COLUMNS,
    minRowSpan: 4,
    maxRowSpan: MAX_ROW_SPAN,
  },
  resizeHandles: [
    "north",
    "south",
    "east",
    "west",
    "north-east",
    "north-west",
    "south-east",
    "south-west",
  ],
});
