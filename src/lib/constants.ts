// Hex grid layout constants
// These ratios define the honeycomb visual appearance

/** Ratio of card width to cell width (14/15 ≈ 0.933) */
export const HEX_CARD_RATIO = 14 / 15;

/** Ratio of the hexagon shape height to card height (86%) */
export const HEX_SHAPE_HEIGHT_RATIO = 86 / 100;

/** Vertical gap ratio between hex rows (0.5 = half the gap) */
export const HEX_VERTICAL_GAP_RATIO = 0.5;

// Responsive breakpoints for hex cell sizing
/** Breakpoint width below which smaller hex cells are used */
export const HEX_MOBILE_BREAKPOINT = 640;

/** Hex cell size for mobile/small screens */
export const HEX_CELL_SIZE_MOBILE = 139;

/** Hex cell size for desktop/larger screens */
export const HEX_CELL_SIZE_DESKTOP = 168;

// Session storage keys
export const SELECTED_SHEET_STORAGE_KEY = "home:selected-sheet-slug";
export const SELECTED_SHEET_ACCENT_KEY = "home:selected-sheet-accent";
