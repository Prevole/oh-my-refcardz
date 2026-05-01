"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import type { CheatSheetCategory, CheatSheetMeta } from "@/lib/yaml-cheatsheets";
import {
  HEX_CARD_RATIO,
  HEX_CELL_SIZE_DESKTOP,
  HEX_CELL_SIZE_MOBILE,
  HEX_MOBILE_BREAKPOINT,
  SELECTED_SHEET_STORAGE_KEY,
} from "@/lib/constants";
import {
  buildHexRows,
  getHexBoardDimensions,
  getHorizontalTarget,
  getMaxColumnsForWidth,
  getPositionedItems,
  getVerticalTarget,
} from "@/lib/hex-layout";
import { Keycap } from "@/components/keycap";
import { ArrowGlyph } from "@/components/arrow-glyph";
import { TechIcon } from "@/components/tech-icon";
import { HomeHelpModal } from "@/components/home-help-modal";
import { HomeInfoModal } from "@/components/home-info-modal";
import { HelpButton } from "@/components/help-button";
import { SettingsButton } from "@/components/settings-button";
import { SettingsPanel } from "@/components/settings-panel";
import { useUISettings } from "@/hooks/use-ui-settings";

type Props = {
  categories: CheatSheetCategory[];
};

type NavigationCard = {
  rowIndex: number;
  colIndex: number;
};

export function HomeClient({ categories }: Props) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [columns, setColumns] = useState(1);
  const [hexCellSize, setHexCellSize] = useState(HEX_CELL_SIZE_DESKTOP);
  const [helpOpen, setHelpOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [settingsPanelOpen, setSettingsPanelOpen] = useState(false);
  const hasRestoredSelectionRef = useRef(false);
  const boardMeasureRef = useRef<HTMLDivElement | null>(null);

  // UI Settings
  const {
    settings: uiSettings,
    isLoaded: uiSettingsLoaded,
    setMode,
    toggleRandom,
    setBorder,
    setDirection,
    toggleAccordion,
    resetModern,
    resetAll,
  } = useUISettings();

  const getGradientCoords = () => {
    switch (uiSettings.modern.direction) {
      case "tl-br":
        return { x1: "0%", y1: "0%", x2: "100%", y2: "100%" };
      case "tr-bl":
        return { x1: "100%", y1: "0%", x2: "0%", y2: "100%" };
      case "l-r":
        return { x1: "0%", y1: "50%", x2: "100%", y2: "50%" };
    }
  };

  const hexBoardStyle = {
    "--hex-cell-size": `${hexCellSize}px`,
    "--hex-card-ratio": HEX_CARD_RATIO,
  } as CSSProperties;

  // Responsive column calculation
  useEffect(() => {
    const node = boardMeasureRef.current;
    if (!node) return;

    const computeColumns = (width: number) => {
      const hexWidth = width <= HEX_MOBILE_BREAKPOINT ? HEX_CELL_SIZE_MOBILE : HEX_CELL_SIZE_DESKTOP;
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

  // Filter categories based on search query
  const visibleCategories = useMemo(() => {
    const normalized = query.toLowerCase().trim();
    if (!normalized) return categories;

    return categories
      .map((category) => ({
        ...category,
        sheets: category.sheets.filter(
          (sheet) =>
            sheet.title.toLowerCase().includes(normalized) ||
            sheet.summary.toLowerCase().includes(normalized) ||
            sheet.slug.toLowerCase().includes(normalized) ||
            category.title.toLowerCase().includes(normalized)
        ),
      }))
      .filter((category) => category.sheets.length > 0);
  }, [categories, query]);

  // Build hex layouts for each category
  const categoryLayouts = useMemo(() => {
    return visibleCategories.map((category) => ({
      category,
      rows: buildHexRows(category.sheets, columns),
    }));
  }, [visibleCategories, columns]);

  // Flatten rows for navigation
  const navigationRows = useMemo(() => {
    return categoryLayouts.flatMap(({ rows }) => rows);
  }, [categoryLayouts]);

  const navigationRowParityByIndex = useMemo(() => {
    return categoryLayouts.flatMap(({ rows }) => rows.map((_, rowIndex) => rowIndex % 2));
  }, [categoryLayouts]);

  // Flatten all visible cards
  const visibleCards = useMemo(() => {
    return categoryLayouts.flatMap(({ category }) => category.sheets);
  }, [categoryLayouts]);

  const selectedCard = visibleCards[selectedIndex] ?? null;

  // Index maps for fast lookup
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

  // Restore selection from session storage
  useEffect(() => {
    if (hasRestoredSelectionRef.current || visibleCards.length === 0) return;

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

  // Persist selection to session storage
  useEffect(() => {
    if (!selectedCard) return;
    window.sessionStorage.setItem(SELECTED_SHEET_STORAGE_KEY, selectedCard.slug);
  }, [selectedCard]);

  const openSheet = useCallback(
    (slug: string) => {
      window.sessionStorage.setItem(SELECTED_SHEET_STORAGE_KEY, slug);
      router.push(`/cheatsheets/${slug}`);
    },
    [router]
  );

  const moveSelection = useCallback(
    (direction: "left" | "right" | "up" | "down") => {
      if (!selectedCard) return;

      const current = navigationBySlug.get(selectedCard.slug);
      if (!current || navigationRows.length === 0) return;

      const isOddRow = navigationRowParityByIndex[current.rowIndex] === 1;

      const target =
        direction === "left" || direction === "right"
          ? getHorizontalTarget<CheatSheetMeta>(
              navigationRows,
              isOddRow,
              current.rowIndex,
              current.colIndex,
              direction
            )
          : getVerticalTarget<CheatSheetMeta>(
              navigationRows,
              navigationRowParityByIndex,
              current.rowIndex,
              current.colIndex,
              direction
            );

      if (!target) return;

      const nextIndex = cardIndexBySlug.get(target.slug);
      if (nextIndex !== undefined) {
        setSelectedIndex(nextIndex);
      }
    },
    [cardIndexBySlug, navigationBySlug, navigationRowParityByIndex, navigationRows, selectedCard]
  );

  // Keyboard navigation
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (target?.tagName === "INPUT" && event.key !== "Escape") return;

      if (event.key === "?") {
        event.preventDefault();
        setHelpOpen((prev) => !prev);
        return;
      }

      if (event.key === ",") {
        event.preventDefault();
        setSettingsPanelOpen((prev) => !prev);
        return;
      }

      if (event.key === "/") {
        event.preventDefault();
        document.getElementById("search")?.focus();
      }

      if (event.key === "i" && selectedCard) {
        event.preventDefault();
        setInfoOpen((prev) => !prev);
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

      if ((event.key === "Enter" || event.key === " ") && selectedCard) {
        event.preventDefault();
        openSheet(selectedCard.slug);
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

      <HomeHelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />
      <HomeInfoModal open={infoOpen} onClose={() => setInfoOpen(false)} sheet={selectedCard} />

      <main className="z-10 mx-auto flex w-full max-w-6xl flex-1 flex-col">
        <p className="font-mono text-xs tracking-[0.2em] text-white/70">OH MY REFCARDZ</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight md:text-5xl">
          Keyboard-first cheat sheets
        </h1>
        <p className="mt-3 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-white/75 md:text-base">
          <span>Navigate with</span>
          <Keycap>
            h<span className="font-normal text-white/30">|</span>j
            <span className="font-normal text-white/30">|</span>k
            <span className="font-normal text-white/30">|</span>l
          </Keycap>
          <span>or</span>
          <span className="keycap">
            <ArrowGlyph direction="left" className="keycap-arrow" />
            <span className="font-normal text-white/30">|</span>
            <ArrowGlyph direction="up" className="keycap-arrow" />
            <span className="font-normal text-white/30">|</span>
            <ArrowGlyph direction="down" className="keycap-arrow" />
            <span className="font-normal text-white/30">|</span>
            <ArrowGlyph direction="right" className="keycap-arrow" />
          </span>
          <span>, open with</span>
          <Keycap>↩</Keycap>
          <span>or</span>
          <Keycap>␣</Keycap>
          <span>, search with</span>
          <Keycap>/</Keycap>
          <span>, clear with</span>
          <Keycap>
            <span className="small-caps">esc</span>
          </Keycap>
          <span>, help with</span>
          <Keycap>?</Keycap>
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
          {categoryLayouts.map(({ category, rows }) => {
            const positionedSheets = getPositionedItems(rows, hexCellSize);
            const boardDimensions = getHexBoardDimensions(rows, hexCellSize);

            return (
              <div key={category.id}>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-[0.7rem] tracking-[0.18em] text-white/45">
                    {String(category.order).padStart(2, "0")}
                  </span>
                  <h2 className="text-lg font-semibold tracking-[0.01em] text-white/95">
                    {category.title}
                  </h2>
                  <div className="h-px flex-1 bg-white/10" />
                </div>
                {category.description ? (
                  <p className="mt-2 text-sm text-white/70">{category.description}</p>
                ) : null}
                <div
                  className="home-hex-board mt-4"
                  style={{
                    width: `${boardDimensions.width}px`,
                    maxWidth: "100%",
                    height: `${boardDimensions.height}px`,
                  }}
                >
                  {positionedSheets.map(({ item: sheet, left, top }) => {
                    const index = cardIndexBySlug.get(sheet.slug) ?? -1;
                    const isSelected = selectedIndex === index;
                    return (
                      <div
                        key={sheet.slug}
                        className="home-hex-cell home-hex-cell-abs"
                        style={{ left: `${left}px`, top: `${top}px` }}
                      >
                        <button
                          onClick={(event) => {
                            if (event.shiftKey) {
                              event.preventDefault();
                              setSelectedIndex(index);
                              setInfoOpen(true);
                            } else {
                              openSheet(sheet.slug);
                            }
                          }}
                          onMouseEnter={() => setSelectedIndex(index)}
                          data-selected={isSelected}
                          data-has-icon={!!sheet.icon}
                          className="home-hex-card text-left"
                          style={{ "--hex-border-color": sheet.color } as CSSProperties}
                        >
                          <svg
                            className="home-hex-shape"
                            viewBox="0 0 100 100"
                            aria-hidden="true"
                            focusable="false"
                          >
                            <defs>
                              <linearGradient
                                id={`hex-grad-${sheet.slug}`}
                                {...getGradientCoords()}
                              >
                                {uiSettings.modern.border === "full" && (
                                  <>
                                    <stop offset="0%" stopColor={sheet.color} />
                                    <stop offset="100%" stopColor={sheet.color} />
                                  </>
                                )}
                                {uiSettings.modern.border === "left" && (
                                  <>
                                    <stop offset="0%" stopColor="transparent" />
                                    <stop offset="45%" stopColor={sheet.color} />
                                    <stop offset="100%" stopColor={sheet.color} />
                                  </>
                                )}
                                {uiSettings.modern.border === "right" && (
                                  <>
                                    <stop offset="0%" stopColor={sheet.color} />
                                    <stop offset="55%" stopColor={sheet.color} />
                                    <stop offset="100%" stopColor="transparent" />
                                  </>
                                )}
                                {uiSettings.modern.border === "both" && (
                                  <>
                                    <stop offset="0%" stopColor="transparent" />
                                    <stop offset="40%" stopColor={sheet.color} />
                                    <stop offset="60%" stopColor={sheet.color} />
                                    <stop offset="100%" stopColor="transparent" />
                                  </>
                                )}
                              </linearGradient>
                            </defs>
                            <path
                              className="home-hex-shape-path"
                              d="M30 7 L70 7 Q75 7 77.4 11.3 L94.2 42.5 Q99 50 94.2 57.5 L77.4 88.7 Q75 93 70 93 L30 93 Q25 93 22.6 88.7 L5.8 57.5 Q1 50 5.8 42.5 L22.6 11.3 Q25 7 30 7 Z"
                              style={{ stroke: `url(#hex-grad-${sheet.slug})` }}
                            />
                          </svg>
                          <div className={`home-hex-card-inner ${sheet.icon ? "has-icon" : ""}`}>
                            {sheet.icon ? (
                              <>
                                <div className="home-hex-half home-hex-half-icon">
                                  <TechIcon
                                    icon={sheet.icon}
                                    color={sheet.color}
                                    className="home-hex-icon"
                                  />
                                </div>
                                <div className="home-hex-half home-hex-half-title">
                                  <h3 className="home-hex-title" style={{ color: sheet.color }}>
                                    {sheet.title}
                                  </h3>
                                </div>
                              </>
                            ) : (
                              <h3
                                className="home-hex-title home-hex-title-centered"
                                style={{ color: sheet.color }}
                              >
                                {sheet.title}
                              </h3>
                            )}
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

      {/* Help Button */}
      <HelpButton onClick={() => setHelpOpen(true)} />

      {/* Settings Button */}
      <SettingsButton onClick={() => setSettingsPanelOpen(true)} />

      {/* Settings Panel */}
      <SettingsPanel
        isOpen={settingsPanelOpen}
        onClose={() => setSettingsPanelOpen(false)}
        settings={uiSettings}
        onSetMode={setMode}
        onToggleRandom={toggleRandom}
        onSetBorder={setBorder}
        onSetDirection={setDirection}
        onToggleAccordion={toggleAccordion}
        onResetModern={resetModern}
        onResetAll={resetAll}
      />
    </div>
  );
}
