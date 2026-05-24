import { describe, it, expect } from "vitest";
import {
  getHexMetrics,
  buildHexRows,
  getHexRowWidth,
  getHexBoardDimensions,
  getMaxColumnsForWidth,
  getPositionedItems,
  getVerticalTarget,
  getHorizontalTarget,
} from "./hex-layout";
import {
  HEX_CARD_RATIO,
  HEX_SHAPE_HEIGHT_RATIO,
  HEX_VERTICAL_GAP_RATIO,
  HEX_CELL_SIZE_DESKTOP,
  HEX_CELL_SIZE_MOBILE,
} from "./constants";

describe("getHexMetrics", () => {
  it("calculates metrics for desktop hex size", () => {
    const metrics = getHexMetrics(HEX_CELL_SIZE_DESKTOP);

    expect(metrics.hexCardWidth).toBeCloseTo(HEX_CELL_SIZE_DESKTOP * HEX_CARD_RATIO);
    expect(metrics.hexCardHeight).toBeCloseTo(HEX_CELL_SIZE_DESKTOP * HEX_CARD_RATIO);
    expect(metrics.hexShapeHeight).toBeCloseTo(
      metrics.hexCardHeight * HEX_SHAPE_HEIGHT_RATIO
    );
  });

  it("calculates metrics for mobile hex size", () => {
    const metrics = getHexMetrics(HEX_CELL_SIZE_MOBILE);

    expect(metrics.hexCardWidth).toBeCloseTo(HEX_CELL_SIZE_MOBILE * HEX_CARD_RATIO);
    expect(metrics.hexCardHeight).toBeCloseTo(HEX_CELL_SIZE_MOBILE * HEX_CARD_RATIO);
  });

  it("calculates card inset as half the gap", () => {
    const hexWidth = 100;
    const metrics = getHexMetrics(hexWidth);
    const expectedGap = hexWidth - metrics.hexCardWidth;

    expect(metrics.cardInset).toBeCloseTo(expectedGap / 2);
  });

  it("calculates horizontal step correctly", () => {
    const hexWidth = 100;
    const metrics = getHexMetrics(hexWidth);
    const hexGap = hexWidth - metrics.hexCardWidth;

    expect(metrics.horizontalStep).toBeCloseTo(metrics.hexCardWidth * 1.5 + hexGap);
  });

  it("calculates odd row offset as half the horizontal step", () => {
    const metrics = getHexMetrics(100);

    expect(metrics.oddRowOffset).toBeCloseTo(metrics.horizontalStep / 2);
  });

  it("calculates vertical step correctly", () => {
    const hexWidth = 100;
    const metrics = getHexMetrics(hexWidth);
    const hexGap = hexWidth - metrics.hexCardWidth;

    expect(metrics.verticalStep).toBeCloseTo(
      metrics.hexShapeHeight / 2 + hexGap * HEX_VERTICAL_GAP_RATIO
    );
  });

  it("scales proportionally with hex width", () => {
    const metrics100 = getHexMetrics(100);
    const metrics200 = getHexMetrics(200);

    expect(metrics200.hexCardWidth).toBeCloseTo(metrics100.hexCardWidth * 2);
    expect(metrics200.horizontalStep).toBeCloseTo(metrics100.horizontalStep * 2);
    expect(metrics200.verticalStep).toBeCloseTo(metrics100.verticalStep * 2);
  });
});

describe("buildHexRows", () => {
  it("returns empty array for empty items", () => {
    const rows = buildHexRows([], 3);

    expect(rows).toEqual([]);
  });

  it("handles single item", () => {
    const rows = buildHexRows(["a"], 3);

    expect(rows).toEqual([["a"]]);
  });

  it("distributes 2 items across 2 rows when columns >= 2", () => {
    const rows = buildHexRows(["a", "b"], 3);

    expect(rows).toEqual([["a"], ["b"]]);
  });

  it("distributes 3 items as 2+1 when columns is 3", () => {
    const rows = buildHexRows(["a", "b", "c"], 3);

    expect(rows).toEqual([["a", "b"], ["c"]]);
  });

  it("balances remaining items across the next zigzag pair", () => {
    const items = ["a", "b", "c", "d", "e", "f", "g"];
    const rows = buildHexRows(items, 3);

    expect(rows[0]).toEqual(["a", "b", "c"]);
    expect(rows[1]).toEqual(["d", "e"]);
    expect(rows[2]).toEqual(["f"]);
    expect(rows[3]).toEqual(["g"]);
  });

  it("odd rows have columns - 1 items", () => {
    const items = ["a", "b", "c", "d", "e"];
    const rows = buildHexRows(items, 3);

    expect(rows[0].length).toBe(3);
    expect(rows[1].length).toBe(2);
  });

  it("balances the first two rows before starting a third row", () => {
    const items = ["a", "b", "c", "d", "e", "f"];
    const rows = buildHexRows(items, 5);

    expect(rows).toEqual([
      ["a", "b", "c"],
      ["d", "e", "f"],
    ]);
  });

  it("keeps filling the first two rows until their combined capacity is reached", () => {
    const items = ["a", "b", "c", "d", "e", "f", "g", "h", "i"];
    const rows = buildHexRows(items, 5);

    expect(rows).toEqual([
      ["a", "b", "c", "d", "e"],
      ["f", "g", "h", "i"],
    ]);
  });

  it("starts a third row only after the first zigzag pair is full", () => {
    const items = ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"];
    const rows = buildHexRows(items, 5);

    expect(rows).toEqual([
      ["a", "b", "c", "d", "e"],
      ["f", "g", "h", "i"],
      ["j"],
    ]);
  });

  it("balances the final zigzag pair instead of leaving a sparse last row", () => {
    const items = [
      "a",
      "b",
      "c",
      "d",
      "e",
      "f",
      "g",
      "h",
      "i",
      "j",
      "k",
      "l",
      "m",
      "n",
      "o",
      "p",
      "q",
      "r",
      "s",
      "t",
      "u",
      "v",
      "w",
      "x",
      "y",
    ];
    const rows = buildHexRows(items, 5);

    expect(rows).toEqual([
      ["a", "b", "c", "d", "e"],
      ["f", "g", "h", "i"],
      ["j", "k", "l", "m", "n"],
      ["o", "p", "q", "r"],
      ["s", "t", "u", "v"],
      ["w", "x", "y"],
    ]);
  });

  it("handles columns = 1", () => {
    const items = ["a", "b", "c"];
    const rows = buildHexRows(items, 1);

    expect(rows).toEqual([["a"], ["b"], ["c"]]);
  });

  it("preserves item order", () => {
    const items = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const rows = buildHexRows(items, 4);
    const flattened = rows.flat();

    expect(flattened).toEqual(items);
  });
});

describe("getHexRowWidth", () => {
  it("calculates width for single column", () => {
    const hexWidth = 100;
    const metrics = getHexMetrics(hexWidth);
    const width = getHexRowWidth(1, hexWidth);

    expect(width).toBeCloseTo(metrics.cardInset + metrics.hexCardWidth);
  });

  it("increases width with more columns", () => {
    const hexWidth = 100;
    const width1 = getHexRowWidth(1, hexWidth);
    const width2 = getHexRowWidth(2, hexWidth);
    const width3 = getHexRowWidth(3, hexWidth);

    expect(width2).toBeGreaterThan(width1);
    expect(width3).toBeGreaterThan(width2);
  });

  it("adds horizontal step for each additional column", () => {
    const hexWidth = 100;
    const metrics = getHexMetrics(hexWidth);
    const width1 = getHexRowWidth(1, hexWidth);
    const width2 = getHexRowWidth(2, hexWidth);

    expect(width2 - width1).toBeCloseTo(metrics.horizontalStep);
  });

  it("handles zero columns", () => {
    const width = getHexRowWidth(0, 100);
    const metrics = getHexMetrics(100);

    expect(width).toBeCloseTo(metrics.cardInset + metrics.hexCardWidth);
  });
});

describe("getHexBoardDimensions", () => {
  it("returns hexWidth as height for empty rows", () => {
    const hexWidth = 100;
    const dimensions = getHexBoardDimensions([], hexWidth);

    expect(dimensions.height).toBe(hexWidth);
    expect(dimensions.width).toBe(0);
  });

  it("calculates width based on widest row", () => {
    const hexWidth = 100;
    const rows = [["a", "b", "c"], ["d", "e"], ["f"]];
    const dimensions = getHexBoardDimensions(rows, hexWidth);
    const metrics = getHexMetrics(hexWidth);

    const row0Width = getHexRowWidth(3, hexWidth);
    const row1Width = getHexRowWidth(2, hexWidth) + metrics.oddRowOffset;

    expect(dimensions.width).toBeCloseTo(Math.max(row0Width, row1Width));
  });

  it("calculates height based on number of rows", () => {
    const hexWidth = 100;
    const rows = [["a"], ["b"], ["c"]];
    const dimensions = getHexBoardDimensions(rows, hexWidth);
    const metrics = getHexMetrics(hexWidth);

    expect(dimensions.height).toBeCloseTo(2 * metrics.verticalStep + hexWidth);
  });

  it("single row has height equal to hexWidth", () => {
    const hexWidth = 100;
    const rows = [["a", "b", "c"]];
    const dimensions = getHexBoardDimensions(rows, hexWidth);

    expect(dimensions.height).toBeCloseTo(hexWidth);
  });
});

describe("getMaxColumnsForWidth", () => {
  it("returns 1 for very narrow width", () => {
    const columns = getMaxColumnsForWidth(50, 100);

    expect(columns).toBe(1);
  });

  it("increases columns as width increases", () => {
    const hexWidth = 100;
    const cols1 = getMaxColumnsForWidth(200, hexWidth);
    const cols2 = getMaxColumnsForWidth(400, hexWidth);
    const cols3 = getMaxColumnsForWidth(800, hexWidth);

    expect(cols2).toBeGreaterThanOrEqual(cols1);
    expect(cols3).toBeGreaterThanOrEqual(cols2);
  });

  it("returns correct columns for exact fit", () => {
    const hexWidth = 100;

    // Find width that fits exactly 3 columns
    const width3 = getHexRowWidth(3, hexWidth);
    const width4 = getHexRowWidth(4, hexWidth);

    // Width that fits 3 but not 4
    const testWidth = (width3 + width4) / 2;
    const columns = getMaxColumnsForWidth(testWidth, hexWidth);

    expect(columns).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// getPositionedItems
// ---------------------------------------------------------------------------

describe("getPositionedItems", () => {
  it("returns empty array for empty rows", () => {
    const positioned = getPositionedItems([], 100);

    expect(positioned).toEqual([]);
  });

  it("positions first item at origin", () => {
    const rows = [["a"]];
    const positioned = getPositionedItems(rows, 100);

    expect(positioned[0].left).toBe(0);
    expect(positioned[0].top).toBe(0);
    expect(positioned[0].item).toBe("a");
  });

  it("offsets odd rows horizontally", () => {
    const hexWidth = 100;
    const rows = [["a"], ["b"]];
    const positioned = getPositionedItems(rows, hexWidth);
    const metrics = getHexMetrics(hexWidth);

    expect(positioned[0].left).toBe(0); // even row
    expect(positioned[1].left).toBeCloseTo(metrics.oddRowOffset); // odd row
  });

  it("positions items horizontally within a row", () => {
    const hexWidth = 100;
    const rows = [["a", "b", "c"]];
    const positioned = getPositionedItems(rows, hexWidth);
    const metrics = getHexMetrics(hexWidth);

    expect(positioned[0].left).toBe(0);
    expect(positioned[1].left).toBeCloseTo(metrics.horizontalStep);
    expect(positioned[2].left).toBeCloseTo(metrics.horizontalStep * 2);
  });

  it("positions rows vertically", () => {
    const hexWidth = 100;
    const rows = [["a"], ["b"], ["c"]];
    const positioned = getPositionedItems(rows, hexWidth);
    const metrics = getHexMetrics(hexWidth);

    expect(positioned[0].top).toBe(0);
    expect(positioned[1].top).toBeCloseTo(metrics.verticalStep);
    expect(positioned[2].top).toBeCloseTo(metrics.verticalStep * 2);
  });

  it("preserves all items", () => {
    const rows = [
      ["a", "b"],
      ["c"],
      ["d", "e"],
    ];
    const positioned = getPositionedItems(rows, 100);

    expect(positioned.map((p) => p.item)).toEqual(["a", "b", "c", "d", "e"]);
  });
});

// ---------------------------------------------------------------------------
// getVerticalTarget
// ---------------------------------------------------------------------------

describe("getVerticalTarget", () => {
  // Honeycomb layout (visualColIndex = colIndex * 2 + parity):
  // Row 0 (even, par 0): [A vCol 0, B vCol 2, C vCol 4]
  // Row 1 (odd,  par 1):    [D vCol 1, E vCol 3]
  // Row 2 (even, par 0): [F vCol 0, G vCol 2, H vCol 4]
  // Row 3 (odd,  par 1):    [I vCol 1, J vCol 3]
  //
  // The algorithm picks the adjacent row (no parity skip) and selects
  // the card with the closest visualColIndex. Ties resolve to the
  // leftmost candidate (smaller colIndex).

  const rows = [
    ["A", "B", "C"],
    ["D", "E"],
    ["F", "G", "H"],
    ["I", "J"],
  ];
  const rowParityByIndex = [0, 1, 0, 1];

  it("moves down to the adjacent row and picks the closest visual column", () => {
    // From B (row 0, col 1, vCol 2) down → row 1 [D vCol 1, E vCol 3].
    // Distances [1, 1], tie → leftmost = D.
    const target = getVerticalTarget(rows, rowParityByIndex, 0, 1, "down");
    expect(target).toBe("D");
  });

  it("moves up symmetrically with the same closest-visual-column rule", () => {
    // From G (row 2, col 1, vCol 2) up → row 1 [D vCol 1, E vCol 3].
    // Distances [1, 1], tie → leftmost = D.
    const target = getVerticalTarget(rows, rowParityByIndex, 2, 1, "up");
    expect(target).toBe("D");
  });

  it("favors an exact visualColIndex match over a near one", () => {
    // From D (row 1, col 0, vCol 1) down → row 2 [F vCol 0, G vCol 2, H vCol 4].
    // Distances [1, 1, 3], tie → leftmost = F.
    const target = getVerticalTarget(rows, rowParityByIndex, 1, 0, "down");
    expect(target).toBe("F");
  });

  it("picks the rightward neighbour when the source sits past the row centre", () => {
    // From C (row 0, col 2, vCol 4) down → row 1 [D vCol 1, E vCol 3].
    // Distances [3, 1] → E.
    const target = getVerticalTarget(rows, rowParityByIndex, 0, 2, "down");
    expect(target).toBe("E");
  });

  it("returns null when no row exists in the requested direction", () => {
    expect(getVerticalTarget(rows, rowParityByIndex, 0, 0, "up")).toBeNull();
    expect(getVerticalTarget(rows, rowParityByIndex, 3, 0, "down")).toBeNull();
  });

  it("crosses category boundaries by landing on the immediately adjacent row", () => {
    // Regression: the previous algorithm skipped rows of opposite
    // parity, so a card in an odd row could not move down to the
    // first row of the next category (which restarts at parity 0).
    // With the visual-column algorithm, the adjacent row is always
    // chosen regardless of parity.
    //
    // Layout mimics tooling (7 sheets, 4 cols) followed by an
    // applications category with a single sheet:
    //   Row 0 (par 0): [chez, dsf, direnv, docker]     (tooling)
    //   Row 1 (par 1):     [git, mise, op]             (tooling)
    //   Row 2 (par 0): [1pwd]                          (applications)
    const layout = [
      ["chez", "dsf", "direnv", "docker"],
      ["git", "mise", "op"],
      ["1pwd"],
    ];
    const parity = [0, 1, 0];

    // git (row 1, col 0, vCol 1), mise (col 1, vCol 3), op (col 2, vCol 5)
    // all collapse down to 1pwd (the only card in row 2 at vCol 0).
    expect(getVerticalTarget(layout, parity, 1, 0, "down")).toBe("1pwd");
    expect(getVerticalTarget(layout, parity, 1, 1, "down")).toBe("1pwd");
    expect(getVerticalTarget(layout, parity, 1, 2, "down")).toBe("1pwd");
  });

  it("falls back to the only available card when the adjacent row is sparse", () => {
    // From C (row 0, col 2, vCol 4) down → row 1 [D vCol 1].
    // Only one candidate, picked regardless of distance.
    const shortRows = [["A", "B", "C"], ["D"], ["E"]];
    const parity = [0, 1, 0];

    expect(getVerticalTarget(shortRows, parity, 0, 2, "down")).toBe("D");
  });
});

// ---------------------------------------------------------------------------
// getHorizontalTarget
// ---------------------------------------------------------------------------

describe("getHorizontalTarget", () => {
  // Honeycomb layout visualization:
  //   [A] [B] [C]     <- row 0 (even)
  //     [D] [E]       <- row 1 (odd, offset right)
  //   [F] [G] [H]     <- row 2 (even)

  const rows = [
    ["A", "B", "C"],
    ["D", "E"],
    ["F", "G", "H"],
  ];

  describe("from even row", () => {
    it("moves right to adjacent odd row below", () => {
      // From A (row 0, col 0) right → D (row 1, col 0)
      const target = getHorizontalTarget(rows, false, 0, 0, "right");

      expect(target).toBe("D");
    });

    it("moves left to adjacent odd row below", () => {
      // From B (row 0, col 1) left → D (row 1, col 0)
      const target = getHorizontalTarget(rows, false, 0, 1, "left");

      expect(target).toBe("D");
    });

    it("falls back to same row when no diagonal target", () => {
      // From A (row 0, col 0) left → no diagonal, no same row left
      // Falls back to odd row below if exists
      const target = getHorizontalTarget(rows, false, 0, 0, "left");

      // col -1 doesn't exist in row 1, same row col -1 doesn't exist
      // fallback row is row -1 which doesn't exist
      expect(target).toBeNull();
    });
  });

  describe("from odd row", () => {
    it("moves right to adjacent even row above", () => {
      // From D (row 1, col 0) right → B (row 0, col 1)
      const target = getHorizontalTarget(rows, true, 1, 0, "right");

      expect(target).toBe("B");
    });

    it("moves left to adjacent even row above", () => {
      // From E (row 1, col 1) left → B (row 0, col 1)
      const target = getHorizontalTarget(rows, true, 1, 1, "left");

      expect(target).toBe("B");
    });
  });

  describe("edge cases", () => {
    it("returns null when no valid target exists", () => {
      const singleRow = [["A", "B", "C"]];

      // From A, left → nothing
      const target = getHorizontalTarget(singleRow, false, 0, 0, "left");

      expect(target).toBeNull();
    });

    it("falls back to same row when diagonal is out of bounds", () => {
      // From C (row 0, col 2) right → try row 1 col 2, doesn't exist
      // Fall back to same row col 3, doesn't exist
      // Fall back to row -1, doesn't exist
      const target = getHorizontalTarget(rows, false, 0, 2, "right");

      expect(target).toBeNull();
    });

    it("moves within same row when possible", () => {
      // Test with a layout where same-row movement is the fallback
      const wideRows = [
        ["A", "B", "C", "D"],
        ["E"], // only one item
      ];

      // From B (row 0, col 1), right → try row 1 col 1, doesn't exist
      // Fall back to same row col 2 = C
      const target = getHorizontalTarget(wideRows, false, 0, 1, "right");

      expect(target).toBe("C");
    });

    it("uses fallback row when preferred row and same row fail", () => {
      // Layout where:
      // - preferred row (below for even) has no valid target
      // - same row has no valid target
      // - fallback row (above for even) has valid target
      //
      //     [X]           <- row 0 (even) - fallback row for row 1
      //   [A] [B]         <- row 1 (odd) - we start here
      //     [C]           <- row 2 (even) - preferred row for odd
      
      const fallbackRows = [
        ["X"],
        ["A", "B"],
        ["C"],
      ];

      // From B (row 1, col 1, odd row), going right:
      // - targetCol = colIndex + 1 = 2 (for odd row going right)
      // - preferred row (row 0) col 2 doesn't exist
      // - same row col 2 doesn't exist
      // - fallback row (row 2) col 2 doesn't exist
      // Result: null
      const target1 = getHorizontalTarget(fallbackRows, true, 1, 1, "right");
      expect(target1).toBeNull();

      // From A (row 1, col 0, odd row), going left:
      // - targetCol = colIndex = 0 (for odd row going left)
      // - preferred row (row 0) col 0 = X ✓
      const target2 = getHorizontalTarget(fallbackRows, true, 1, 0, "left");
      expect(target2).toBe("X");

      // Layout to test fallback row usage:
      //   [P] [Q]         <- row 0 (even) - preferred for row 1
      //     [A]           <- row 1 (odd) - start here, only 1 item
      //   [F] [G]         <- row 2 (even) - fallback for row 1
      
      const fallbackRows2 = [
        ["P", "Q"],
        ["A"],
        ["F", "G"],
      ];

      // From A (row 1, col 0, odd row), going right:
      // - targetCol for right on odd = col + 1 = 1
      // - preferred row (row 0) col 1 = Q ✓
      const target3 = getHorizontalTarget(fallbackRows2, true, 1, 0, "right");
      expect(target3).toBe("Q");

      // Now test a case where preferred fails but fallback works
      // We need preferred row to not have the target col,
      // same row to not have sameRowCol,
      // but fallback row to have targetCol
      //
      //     [P]           <- row 0 (even) - preferred, only col 0
      //   [A] [B]         <- row 1 (odd)
      //   [F] [G]         <- row 2 (even) - fallback, has col 0 and 1
      
      const fallbackRows3 = [
        ["P"],
        ["A", "B"],
        ["F", "G"],
      ];

      // From B (row 1, col 1, odd row), going left:
      // - targetCol for left on odd = col = 1
      // - preferred row (row 0) col 1 doesn't exist
      // - same row col 0 = A (sameRowCol = col - 1 = 0)
      const target4 = getHorizontalTarget(fallbackRows3, true, 1, 1, "left");
      expect(target4).toBe("A"); // same row fallback

      // From A (row 1, col 0, odd row), going left:
      // - targetCol for left on odd = col = 0
      // - preferred row (row 0) col 0 = P ✓
      const target5 = getHorizontalTarget(fallbackRows3, true, 1, 0, "left");
      expect(target5).toBe("P");

      // Test actual fallback row usage:
      // Need: preferred fails, same row fails, fallback succeeds
      //
      //   []              <- row 0 (even) - empty preferred
      //     [A]           <- row 1 (odd) - single item
      //   [F] [G]         <- row 2 (even) - fallback with items
      
      const fallbackRows4 = [
        [] as string[],
        ["A"],
        ["F", "G"],
      ];

      // From A (row 1, col 0, odd row), going right:
      // - targetCol for right on odd = col + 1 = 1
      // - preferred row (row 0) is empty, skip
      // - same row col 1 doesn't exist
      // - fallback row (row 2) col 1 = G ✓
      const target6 = getHorizontalTarget(fallbackRows4, true, 1, 0, "right");
      expect(target6).toBe("G");
    });
  });
});
