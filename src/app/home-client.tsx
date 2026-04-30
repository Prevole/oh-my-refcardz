"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import type { CheatSheetCategory } from "@/lib/yaml-cheatsheets";
import { Keycap } from "@/components/keycap";
import { ArrowGlyph } from "@/components/arrow-glyph";

type Props = {
  categories: CheatSheetCategory[];
};

type HexRows = CheatSheetCategory["sheets"][];

type NavigationCard = {
  rowIndex: number;
  colIndex: number;
};

const SELECTED_SHEET_STORAGE_KEY = "home:selected-sheet-slug";
const HEX_CARD_RATIO = 14 / 15;
const HEX_SHAPE_HEIGHT_RATIO = 86 / 100;
const HEX_VERTICAL_GAP_RATIO = 0.5;

function getHexMetrics(hexWidth: number) {
  const hexCardWidth = hexWidth * HEX_CARD_RATIO;
  const hexCardHeight = hexWidth * HEX_CARD_RATIO;
  const hexShapeHeight = hexCardHeight * HEX_SHAPE_HEIGHT_RATIO;
  const hexGap = hexWidth - hexCardWidth;
  const cardInset = hexGap / 2;
  const horizontalStep = hexCardWidth * 1.5 + hexGap;

  return {
    hexCardWidth,
    hexCardHeight,
    hexShapeHeight,
    cardInset,
    horizontalStep,
    oddRowOffset: horizontalStep / 2,
    verticalStep: hexShapeHeight / 2 + hexGap * HEX_VERTICAL_GAP_RATIO,
  };
}

function buildHexRows(sheets: CheatSheetCategory["sheets"], columns: number) {
  const evenCount = Math.max(1, columns);
  const oddCount = Math.max(1, columns - 1);
  const rows: HexRows = [];

  if (sheets.length > 1 && sheets.length <= evenCount) {
    const firstRowCount = Math.min(evenCount, Math.ceil(sheets.length / 2));
    return [sheets.slice(0, firstRowCount), sheets.slice(firstRowCount)].filter((row) => row.length > 0);
  }

  let cursor = 0;
  let rowIndex = 0;

  while (cursor < sheets.length) {
    const targetCount = rowIndex % 2 === 0 ? evenCount : oddCount;
    const count = Math.min(targetCount, sheets.length - cursor);
    rows.push(sheets.slice(cursor, cursor + count));
    cursor += count;
    rowIndex += 1;
  }

  return rows;
}

function getVerticalTarget(rows: HexRows, rowParityByIndex: number[], rowIndex: number, colIndex: number, direction: "up" | "down") {
  const rowStep = direction === "down" ? 1 : -1;
  const currentParity = rowParityByIndex[rowIndex];

  for (let nextRowIndex = rowIndex + rowStep; nextRowIndex >= 0 && nextRowIndex < rows.length; nextRowIndex += rowStep) {
    const nextRow = rows[nextRowIndex];
    if (nextRow.length === 0 || rowParityByIndex[nextRowIndex] !== currentParity) {
      continue;
    }

    return nextRow[colIndex] ?? nextRow[0] ?? null;
  }

  return null;
}

function getHorizontalTarget(rows: HexRows, isOddRow: boolean, rowIndex: number, colIndex: number, direction: "left" | "right") {
  const targetCol = direction === "right"
    ? isOddRow ? colIndex + 1 : colIndex
    : isOddRow ? colIndex : colIndex - 1;

  const preferredRowIndex = isOddRow ? rowIndex - 1 : rowIndex + 1;
  const fallbackRowIndex = isOddRow ? rowIndex + 1 : rowIndex - 1;
  const currentRow = rows[rowIndex];
  const sameRowCol = direction === "right" ? colIndex + 1 : colIndex - 1;

  for (const nextRowIndex of [preferredRowIndex]) {
    const nextRow = rows[nextRowIndex];
    if (!nextRow || targetCol < 0 || targetCol >= nextRow.length) {
      continue;
    }

    return nextRow[targetCol] ?? null;
  }

  if (sameRowCol >= 0 && sameRowCol < currentRow.length) {
    return currentRow[sameRowCol] ?? null;
  }

  for (const nextRowIndex of [fallbackRowIndex]) {
    const nextRow = rows[nextRowIndex];
    if (!nextRow || targetCol < 0 || targetCol >= nextRow.length) {
      continue;
    }

    return nextRow[targetCol] ?? null;
  }

  return null;
}

function getHexRowWidth(columnCount: number, hexWidth: number) {
  const { cardInset, hexCardWidth, horizontalStep } = getHexMetrics(hexWidth);
  return cardInset + hexCardWidth + Math.max(0, columnCount - 1) * horizontalStep;
}

function getHexBoardDimensions(rows: CheatSheetCategory["sheets"][], hexWidth: number) {
  const { oddRowOffset, verticalStep } = getHexMetrics(hexWidth);

  const width = rows.reduce((maxWidth, row, rowIndex) => {
    const rowWidth = getHexRowWidth(row.length, hexWidth) + (rowIndex % 2 === 1 ? oddRowOffset : 0);
    return Math.max(maxWidth, rowWidth);
  }, 0);

  const height = rows.length > 0 ? (rows.length - 1) * verticalStep + hexWidth : hexWidth;

  return { width, height };
}

function getMaxColumnsForWidth(width: number, hexWidth: number) {
  let maxColumns = 1;

  while (getHexRowWidth(maxColumns + 1, hexWidth) <= width) {
    maxColumns += 1;
  }

  return maxColumns;
}

export function HomeClient({ categories }: Props) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [columns, setColumns] = useState(1);
  const [hexCellSize, setHexCellSize] = useState(168);
  const [helpOpen, setHelpOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const hasRestoredSelectionRef = useRef(false);
  const boardMeasureRef = useRef<HTMLDivElement | null>(null);
  const hexBoardStyle = {
    "--hex-cell-size": `${hexCellSize}px`,
    "--hex-card-ratio": HEX_CARD_RATIO,
  } as CSSProperties;

  useEffect(() => {
    const node = boardMeasureRef.current;
    if (!node) {
      return;
    }

    const computeColumns = (width: number) => {
      const hexWidth = width <= 640 ? 139 : 168;
      const maxColumns = getMaxColumnsForWidth(width, hexWidth);
      setHexCellSize(hexWidth);
      setColumns(maxColumns);
    };

    computeColumns(node.clientWidth);
    const observer = new ResizeObserver((entries) => {
      const nextWidth = entries[0]?.contentRect.width;
      if (nextWidth) {
        computeColumns(nextWidth);
      }
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const visibleCategories = useMemo(() => {
    const normalized = query.toLowerCase().trim();
    if (!normalized) {
      return categories;
    }

    return categories
      .map((category) => ({
        ...category,
        sheets: category.sheets.filter((sheet) => {
          return (
            sheet.title.toLowerCase().includes(normalized) ||
            sheet.summary.toLowerCase().includes(normalized) ||
            sheet.slug.toLowerCase().includes(normalized) ||
            category.title.toLowerCase().includes(normalized)
          );
        }),
      }))
      .filter((category) => category.sheets.length > 0);
  }, [categories, query]);

  const categoryLayouts = useMemo(() => {
    return visibleCategories.map((category) => ({
      category,
      rows: buildHexRows(category.sheets, columns),
    }));
  }, [visibleCategories, columns]);

  const navigationRows = useMemo(() => {
    return categoryLayouts.flatMap(({ rows }) => rows);
  }, [categoryLayouts]);

  const navigationRowParityByIndex = useMemo(() => {
    return categoryLayouts.flatMap(({ rows }) => rows.map((_, rowIndex) => rowIndex % 2));
  }, [categoryLayouts]);

  const visibleCards = useMemo(() => {
    return categoryLayouts.flatMap(({ category }) => category.sheets);
  }, [categoryLayouts]);

  const selectedCard = visibleCards[selectedIndex] ?? null;

  const cardIndexBySlug = useMemo(() => {
    const map = new Map<string, number>();
    visibleCards.forEach((card, index) => {
      map.set(card.slug, index);
    });
    return map;
  }, [visibleCards]);

  const navigationBySlug = useMemo(() => {
    const map = new Map<string, NavigationCard>();
    let rowOffset = 0;

    categoryLayouts.forEach(({ rows }) => {
      rows.forEach((row, rowIndex) => {
        row.forEach((sheet, colIndex) => {
          map.set(sheet.slug, { rowIndex: rowOffset + rowIndex, colIndex });
        });
      });

      rowOffset += rows.length;
    });

    return map;
  }, [categoryLayouts]);

  const selectedCategory = useMemo(() => {
    if (!selectedCard) {
      return null;
    }

    return visibleCategories.find((category) => category.id === selectedCard.categoryId) ?? null;
  }, [selectedCard, visibleCategories]);

  useEffect(() => {
    if (hasRestoredSelectionRef.current || visibleCards.length === 0) {
      return;
    }

    const savedSlug = window.sessionStorage.getItem(SELECTED_SHEET_STORAGE_KEY);
    if (!savedSlug) {
      hasRestoredSelectionRef.current = true;
      return;
    }

    const savedIndex = visibleCards.findIndex((card) => card.slug === savedSlug);
    if (savedIndex >= 0) {
      window.setTimeout(() => setSelectedIndex(savedIndex), 0);
    }

    hasRestoredSelectionRef.current = true;
  }, [visibleCards]);

  useEffect(() => {
    if (!selectedCard) {
      return;
    }
    window.sessionStorage.setItem(SELECTED_SHEET_STORAGE_KEY, selectedCard.slug);
  }, [selectedCard]);

  const openSheet = useCallback((slug: string) => {
    window.sessionStorage.setItem(SELECTED_SHEET_STORAGE_KEY, slug);
    router.push(`/cheatsheets/${slug}`);
  }, [router]);

  const moveSelection = useCallback((direction: "left" | "right" | "up" | "down") => {
    if (!selectedCard) {
      return;
    }

    const current = navigationBySlug.get(selectedCard.slug);
    if (!current) {
      return;
    }

    if (navigationRows.length === 0) {
      return;
    }

    const isOddRow = navigationRowParityByIndex[current.rowIndex] === 1;

    const target = direction === "left" || direction === "right"
      ? getHorizontalTarget(navigationRows, isOddRow, current.rowIndex, current.colIndex, direction)
      : getVerticalTarget(navigationRows, navigationRowParityByIndex, current.rowIndex, current.colIndex, direction);

    if (!target) {
      return;
    }

    const nextIndex = cardIndexBySlug.get(target.slug);
    if (nextIndex !== undefined) {
      setSelectedIndex(nextIndex);
    }
  }, [cardIndexBySlug, navigationBySlug, navigationRowParityByIndex, navigationRows, selectedCard]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (target?.tagName === "INPUT" && event.key !== "Escape") {
        return;
      }

      if (event.key === "?") {
        event.preventDefault();
        setHelpOpen((prev) => !prev);
        return;
      }

      if (event.key === "/") {
        event.preventDefault();
        document.getElementById("search")?.focus();
      }

      if (event.key === "i") {
        if (selectedCard) {
          event.preventDefault();
          setInfoOpen((prev) => !prev);
        }
      }

      if (event.key === "ArrowRight" || event.key === "l") {
        event.preventDefault();
        moveSelection("right");
      }

      if (event.key === "ArrowLeft" || event.key === "h") {
        event.preventDefault();
        moveSelection("left");
      }

      if (event.key === "ArrowDown" || event.key === "j") {
        event.preventDefault();
        moveSelection("down");
      }

      if (event.key === "ArrowUp" || event.key === "k") {
        event.preventDefault();
        moveSelection("up");
      }

      if (event.key === "Enter" || event.key === " ") {
        if (selectedCard) {
          event.preventDefault();
          openSheet(selectedCard.slug);
        }
      }

      if (event.key === "Escape") {
        if (helpOpen) {
          setHelpOpen(false);
          return;
        }
        if (infoOpen) {
          setInfoOpen(false);
          return;
        }
        setQuery("");
        (target as HTMLElement)?.blur?.();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [helpOpen, infoOpen, moveSelection, openSheet, selectedCard]);

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden px-6 py-10 md:px-12">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_10%_20%,#ffb70355,transparent_30%),radial-gradient(circle_at_90%_0%,#00d1b250,transparent_35%),linear-gradient(130deg,#0d1321,#111f35)]" />

      <button
        type="button"
        onClick={() => setHelpOpen(true)}
        className="fixed right-5 top-5 z-20 rounded-full border border-white/25 bg-white/10 px-3 py-1 font-mono text-xs text-white/85 backdrop-blur transition hover:border-white/35 hover:bg-white/15"
      >
        ? Help
      </button>

      {helpOpen ? (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-[#03060ecc] px-6" onClick={() => setHelpOpen(false)}>
          <div className="relative w-full max-w-2xl rounded-2xl border border-white/20 bg-[#11203ad9] p-6 text-sm text-white/90 shadow-2xl backdrop-blur" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="command-modal-dismiss" onClick={() => setHelpOpen(false)} aria-label="Close">✕</button>
            <p className="font-mono text-xs tracking-[0.15em] text-white/70">KEYBOARD SHORTCUTS</p>
            <h3 className="mt-2 text-xl font-semibold">Navigation</h3>
            <table className="legend-table mt-4">
              <tbody>
                <tr>
                  <td>
                    <span className="inline-flex items-center gap-1">
                      <span className="legend-keycap">h</span>
                      <span className="text-xs text-white/40">or</span>
                      <span className="legend-keycap"><ArrowGlyph direction="left" className="legend-arrow" /></span>
                    </span>
                  </td>
                  <td>Move left</td>
                  <td>
                    <span className="inline-flex items-center gap-1">
                      <span className="legend-keycap">l</span>
                      <span className="text-xs text-white/40">or</span>
                      <span className="legend-keycap"><ArrowGlyph direction="right" className="legend-arrow" /></span>
                    </span>
                  </td>
                  <td>Move right</td>
                </tr>
                <tr>
                  <td>
                    <span className="inline-flex items-center gap-1">
                      <span className="legend-keycap">j</span>
                      <span className="text-xs text-white/40">or</span>
                      <span className="legend-keycap"><ArrowGlyph direction="down" className="legend-arrow" /></span>
                    </span>
                  </td>
                  <td>Move down</td>
                  <td>
                    <span className="inline-flex items-center gap-1">
                      <span className="legend-keycap">k</span>
                      <span className="text-xs text-white/40">or</span>
                      <span className="legend-keycap"><ArrowGlyph direction="up" className="legend-arrow" /></span>
                    </span>
                  </td>
                  <td>Move up</td>
                </tr>
                <tr>
                  <td>
                    <span className="inline-flex items-center gap-1">
                      <span className="legend-keycap">↩</span>
                      <span className="text-xs text-white/40">or</span>
                      <span className="legend-keycap">␣</span>
                    </span>
                  </td>
                  <td>Open sheet</td>
                  <td><span className="legend-keycap">/</span></td>
                  <td>Focus search</td>
                </tr>
                <tr>
                  <td><span className="legend-keycap"><span className="small-caps">esc</span></span></td>
                  <td>Clear search</td>
                  <td><span className="legend-keycap">i</span></td>
                  <td>Toggle details</td>
                </tr>
                <tr>
                  <td><span className="legend-keycap">?</span></td>
                  <td>Toggle help</td>
                  <td />
                  <td />
                </tr>
              </tbody>
            </table>
            <p className="mt-4 text-xs text-white/75">Press <span className="font-mono">?</span> to toggle, <span className="font-mono">Esc</span> to close.</p>
          </div>
        </div>
      ) : null}

      {infoOpen && selectedCard && selectedCategory ? (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-[#03060ecc] px-6" onClick={() => setInfoOpen(false)}>
          <div className="relative w-full max-w-xl rounded-2xl border border-white/20 bg-[#11203ad9] p-6 text-sm text-white/90 shadow-2xl backdrop-blur" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="command-modal-dismiss" onClick={() => setInfoOpen(false)} aria-label="Close">✕</button>
            <p className="font-mono text-xs tracking-[0.15em] text-white/70">CHEATSHEET DETAILS</p>
            <h3 className="mt-2 text-2xl font-semibold" style={{ color: selectedCard.color }}>{selectedCard.title}</h3>
            <p className="mt-1 font-mono text-xs uppercase tracking-[0.13em] text-white/70">{selectedCard.slug}</p>
            <p className="mt-4 text-white/90">{selectedCard.summary}</p>
            <div className="mt-5 rounded-xl border border-white/15 bg-white/5 p-4">
              <p className="font-mono text-xs tracking-[0.1em] text-white/65">CATEGORY</p>
              <p className="mt-1 text-base font-semibold text-white">{selectedCategory.title}</p>
              {selectedCategory.description ? <p className="mt-2 text-sm text-white/80">{selectedCategory.description}</p> : null}
            </div>
            <p className="mt-4 text-xs text-white/75">Press <span className="font-mono">i</span> or <span className="font-mono">Esc</span> to close.</p>
          </div>
        </div>
      ) : null}
      <main className="z-10 mx-auto flex w-full max-w-6xl flex-1 flex-col">
        <p className="font-mono text-xs tracking-[0.2em] text-white/70">OH MY REFCARDZ</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight md:text-5xl">Keyboard-first cheat sheets</h1>
        <p className="mt-3 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-white/75 md:text-base">
          <span>Navigate with</span>
          <Keycap>h<span className="text-white/30 font-normal">|</span>j<span className="text-white/30 font-normal">|</span>k<span className="text-white/30 font-normal">|</span>l</Keycap>
          <span>or</span>
          <span className="keycap"><ArrowGlyph direction="left" className="keycap-arrow" /><span className="text-white/30 font-normal">|</span><ArrowGlyph direction="up" className="keycap-arrow" /><span className="text-white/30 font-normal">|</span><ArrowGlyph direction="down" className="keycap-arrow" /><span className="text-white/30 font-normal">|</span><ArrowGlyph direction="right" className="keycap-arrow" /></span>
          <span>, open with</span>
          <Keycap>↩</Keycap>
          <span>or</span>
          <Keycap>␣</Keycap>
          <span>, search with</span>
          <Keycap>/</Keycap>
          <span>, clear with</span>
          <Keycap><span className="small-caps">esc</span></Keycap>
          <span>, details with</span>
          <Keycap>i</Keycap>
          <span>.</span>
        </p>
        <input
          id="search"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setSelectedIndex(0);
          }}
          placeholder="Search tools, commands, or topics"
          className="mt-8 rounded-xl border border-white/20 bg-white/10 px-4 py-3 font-mono text-sm outline-none ring-0 backdrop-blur placeholder:text-white/45 focus:border-[var(--accent)]"
        />

        <section className="mt-8 space-y-8" ref={boardMeasureRef} style={hexBoardStyle}>
          {categoryLayouts.map(({ category, rows }, categoryIndex) => {
            const hexCellWidth = hexCellSize;
            const { horizontalStep, oddRowOffset, verticalStep } = getHexMetrics(hexCellWidth);

            const positionedSheets = rows.flatMap((row, currentRowIndex) => {
              return row.map((sheet, colIndex) => {
                return {
                  sheet,
                  left: colIndex * horizontalStep + (currentRowIndex % 2 === 1 ? oddRowOffset : 0),
                  top: currentRowIndex * verticalStep,
                };
              });
            });

            const boardDimensions = getHexBoardDimensions(rows, hexCellWidth);

            return (
              <div key={category.id}>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-[0.7rem] tracking-[0.18em] text-white/45">{String(categoryIndex + 1).padStart(2, "0")}</span>
                  <h2 className="text-lg font-semibold tracking-[0.01em] text-white/95">{category.title}</h2>
                  <div className="h-px flex-1 bg-white/10" />
                </div>
                {category.description ? <p className="mt-2 text-sm text-white/70">{category.description}</p> : null}
                <div className="home-hex-board mt-4" style={{ width: `${boardDimensions.width}px`, maxWidth: "100%", height: `${boardDimensions.height}px` }}>
                  {positionedSheets.map(({ sheet, left, top }) => {
                    const index = cardIndexBySlug.get(sheet.slug) ?? -1;
                    const isSelected = selectedIndex === index;
                    return (
                      <div key={sheet.slug} className="home-hex-cell home-hex-cell-abs" style={{ left: `${left}px`, top: `${top}px` }}>
                        <button
                          onClick={() => openSheet(sheet.slug)}
                          data-selected={isSelected}
                          className="home-hex-card text-left"
                          style={{ "--hex-border-color": sheet.color } as CSSProperties}
                        >
                          <svg className="home-hex-shape" viewBox="0 0 100 100" aria-hidden="true" focusable="false">
                            <path
                              className="home-hex-shape-path"
                              d="M30 7 L70 7 Q75 7 77.4 11.3 L94.2 42.5 Q99 50 94.2 57.5 L77.4 88.7 Q75 93 70 93 L30 93 Q25 93 22.6 88.7 L5.8 57.5 Q1 50 5.8 42.5 L22.6 11.3 Q25 7 30 7 Z"
                            />
                          </svg>
                          <div className="home-hex-card-inner flex h-full items-center justify-center text-center">
                            <h3 className="text-[1.3rem] font-semibold leading-tight" style={{ color: sheet.color }}>
                              {sheet.title}
                            </h3>
                          </div>
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </section>
        {visibleCards.length === 0 ? (
          <p className="mt-6 text-sm text-white/70">No match. Press Esc to clear your query.</p>
        ) : null}
      </main>
    </div>
  );
}
