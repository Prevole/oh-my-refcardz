"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import type { CheatSheetMeta } from "@/lib/cheatsheet-shared";
import type { CheatSheetCategory } from "@/lib/yaml-cheatsheets";
import {
  HEX_CARD_RATIO,
  HEX_CELL_SIZE_DESKTOP,
  HEX_CELL_SIZE_MOBILE,
  HEX_MOBILE_BREAKPOINT,
  SELECTED_SHEET_STORAGE_KEY,
  SELECTED_SHEET_ACCENT_KEY,
} from "@/lib/constants";
import {
  buildHexRows,
  getHexBoardDimensions,
  getHorizontalTarget,
  getMaxColumnsForWidth,
  getPositionedItems,
  getVerticalTarget,
} from "@/lib/hex-layout";
import { getSecondaryColorForColumn } from "@/lib/color-palette";
import { interpolateHSL, getGridInterpolationFactor } from "@/lib/color-utils";
import { ACTION_IDS } from "@/lib/keybindings";
import { TechIcon } from "@/components/ui/tech-icon";
import { HomeHelpModal } from "@/components/help/home-help-modal";
import { HomeInfoModal } from "@/components/home/home-info-modal";
import { HelpButton } from "@/components/help/help-button";
import { SettingsButton } from "@/components/settings/settings-button";
import { SettingsPanel } from "@/components/settings/settings-panel";
import { AnchorNavigation } from "@/components/navigation/anchor-navigation";
import { buildIndexedAnchorId } from "@/lib/anchor-navigation";
import { ContextualInlineHelp } from "@/components/help/contextual-inline-help";
import { useUISettings } from "@/hooks/use-ui-settings";
import { useKeybindings } from "@/hooks/use-keybindings";
import { useKeyboardScope, useScopedKeyboardHandler } from "@/hooks/use-keyboard-context";
import styles from "./home-client.module.css";

type Props = {
  categories: CheatSheetCategory[];
};

type NavigationCard = {
  rowIndex: number;
  colIndex: number;
  visualColIndex: number;
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

  useKeyboardScope("home", true);
  useKeyboardScope("settings", settingsPanelOpen);
  useKeyboardScope("help", helpOpen);
  useKeyboardScope("info", infoOpen);

  const {
    settings: uiSettings,
    setColorMode,
    toggleRandom,
    setBorder,
    setDirection,
    setActivePanelTab,
    resetModern,
  } = useUISettings();

  const { resolveAction } = useKeybindings();

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

  const categoryNavigationItems = useMemo(() => {
    return categoryLayouts.map(({ category }, index) => ({
      id: buildIndexedAnchorId("home-category", category.title, index),
      label: category.title,
      color: category.color,
    }));
  }, [categoryLayouts]);

  const selectedCard = visibleCards[selectedIndex] ?? null;

  const cardIndexBySlug = useMemo(() => {
    const map = new Map<string, number>();
    visibleCards.forEach((card, index) => {
      map.set(card.slug, index);
    });
    return map;
  }, [visibleCards]);

  const cardBySlug = useMemo(() => {
    return new Map(visibleCards.map((card) => [card.slug, card]));
  }, [visibleCards]);

  const navigationBySlug = useMemo(() => {
    const map = new Map<string, NavigationCard>();
    let rowOffset = 0;

    categoryLayouts.forEach(({ rows }) => {
      rows.forEach((row, rowIndex) => {
        row.forEach((sheet, colIndex) => {
          const visualColIndex = colIndex * 2 + (rowIndex % 2);
          map.set(sheet.slug, { rowIndex: rowOffset + rowIndex, colIndex, visualColIndex });
        });
      });
      rowOffset += rows.length;
    });

    return map;
  }, [categoryLayouts]);

  const sheetGridColors = useMemo(() => {
    if (uiSettings.modern.colorMode !== "grid") return new Map<string, string>();

    const colorMap = new Map<string, string>();
    categoryLayouts.forEach(({ category, rows }) => {
      const maxRow = rows.length - 1;
      const maxCol = Math.max(0, ...rows.map((row) => row.length - 1));

      rows.forEach((row, rowIndex) => {
        row.forEach((sheet, colIndex) => {
          const t = getGridInterpolationFactor(rowIndex, colIndex, maxRow, maxCol);
          const color = interpolateHSL(category.colorFrom, category.colorTo, t);
          colorMap.set(sheet.slug, color);
        });
      });
    });

    return colorMap;
  }, [categoryLayouts, uiSettings.modern.colorMode]);

  const selectedAccentColor = useMemo(() => {
    if (!selectedCard) return null;

    if (uiSettings.modern.colorMode === "grid") {
      return sheetGridColors.get(selectedCard.slug) ?? null;
    }

    if (uiSettings.modern.colorMode === "hexa") {
      const nav = navigationBySlug.get(selectedCard.slug);
      if (!nav) return null;
      return getSecondaryColorForColumn(nav.visualColIndex);
    }

    if (uiSettings.modern.colorMode === "category") {
      return selectedCard.colorFrom;
    }

    return null;
  }, [selectedCard, navigationBySlug, sheetGridColors, uiSettings.modern.colorMode]);

  const getAccentColorForSlug = useCallback((slug: string): string | null => {
    const card = cardBySlug.get(slug);
    if (!card) return null;

    if (uiSettings.modern.colorMode === "grid") {
      return sheetGridColors.get(slug) ?? null;
    }

    if (uiSettings.modern.colorMode === "hexa") {
      const nav = navigationBySlug.get(slug);
      if (!nav) return null;
      return getSecondaryColorForColumn(nav.visualColIndex);
    }

    if (uiSettings.modern.colorMode === "category") {
      return card.colorFrom;
    }

    return card.color;
  }, [cardBySlug, navigationBySlug, sheetGridColors, uiSettings.modern.colorMode]);

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

  useEffect(() => {
    if (!selectedCard) return;
    window.sessionStorage.setItem(SELECTED_SHEET_STORAGE_KEY, selectedCard.slug);
  }, [selectedCard]);

  const openSheet = useCallback(
    (slug: string) => {
      window.sessionStorage.setItem(SELECTED_SHEET_STORAGE_KEY, slug);
      const accentColor = getAccentColorForSlug(slug);
      if (accentColor) {
        window.sessionStorage.setItem(SELECTED_SHEET_ACCENT_KEY, accentColor);
      }
      router.push(`/cheatsheets/${slug}`);
    },
    [router, getAccentColorForSlug]
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

  const handleGlobalKeyDown = useCallback(
    (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      const isInInput = target?.tagName === "INPUT";

      const matchedAction = resolveAction(event, [
        ACTION_IDS.TOGGLE_HELP,
        ACTION_IDS.TOGGLE_SETTINGS,
        ACTION_IDS.CLEAR_SEARCH,
        ACTION_IDS.FOCUS_SEARCH,
        ACTION_IDS.TOGGLE_INFO,
        ACTION_IDS.GO_TOP,
        ACTION_IDS.GO_BOTTOM,
        ACTION_IDS.HOME_MOVE_RIGHT,
        ACTION_IDS.HOME_MOVE_LEFT,
        ACTION_IDS.HOME_MOVE_DOWN,
        ACTION_IDS.HOME_MOVE_UP,
        ACTION_IDS.OPEN_SHEET,
      ]);

      if (matchedAction === ACTION_IDS.TOGGLE_HELP) {
        event.preventDefault();
        setHelpOpen(true);
        return;
      }

      if (matchedAction === ACTION_IDS.TOGGLE_SETTINGS) {
        event.preventDefault();
        setSettingsPanelOpen(true);
        return;
      }

      if (isInInput) {
        if (matchedAction === ACTION_IDS.CLEAR_SEARCH) {
          setQuery("");
          target.blur();
        }
        return;
      }

      if (matchedAction === ACTION_IDS.FOCUS_SEARCH) {
        event.preventDefault();
        document.getElementById("search")?.focus();
        return;
      }

      if (matchedAction === ACTION_IDS.TOGGLE_INFO && selectedCard) {
        event.preventDefault();
        setInfoOpen(true);
        return;
      }

      if (matchedAction === ACTION_IDS.GO_TOP) {
        event.preventDefault();
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }

      if (matchedAction === ACTION_IDS.GO_BOTTOM) {
        event.preventDefault();
        window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "smooth" });
        return;
      }

      if (matchedAction === ACTION_IDS.HOME_MOVE_RIGHT) {
        event.preventDefault();
        moveSelection("right");
        return;
      }

      if (matchedAction === ACTION_IDS.HOME_MOVE_LEFT) {
        event.preventDefault();
        moveSelection("left");
        return;
      }

      if (matchedAction === ACTION_IDS.HOME_MOVE_DOWN) {
        event.preventDefault();
        moveSelection("down");
        return;
      }

      if (matchedAction === ACTION_IDS.HOME_MOVE_UP) {
        event.preventDefault();
        moveSelection("up");
        return;
      }

      if (matchedAction === ACTION_IDS.OPEN_SHEET && selectedCard) {
        event.preventDefault();
        openSheet(selectedCard.slug);
        return;
      }

      if (matchedAction === ACTION_IDS.CLEAR_SEARCH) {
        setQuery("");
        target?.blur?.();
      }
    },
    [resolveAction, moveSelection, openSheet, selectedCard]
  );

  useScopedKeyboardHandler("home", handleGlobalKeyDown, [handleGlobalKeyDown]);

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden px-6 py-10 md:px-12">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_10%_20%,#ffb70355,transparent_30%),radial-gradient(circle_at_90%_0%,#00d1b250,transparent_35%),linear-gradient(130deg,#0d1321,#111f35)]" />

      <HomeHelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />
      <HomeInfoModal open={infoOpen} onClose={() => setInfoOpen(false)} sheet={selectedCard} accentColor={selectedAccentColor} />

      <main className="z-10 mx-auto flex w-full max-w-6xl flex-1 flex-col">
        <p className="font-mono text-xs tracking-[0.2em] text-white/70">OH MY REFCARDZ</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight md:text-5xl">
          Keyboard-first cheat sheets
        </h1>
        <ContextualInlineHelp surface="home" />

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
            const positionedSheets = getPositionedItems(rows, hexCellSize);
            const boardDimensions = getHexBoardDimensions(rows, hexCellSize);

            return (
              <div key={category.id} id={buildIndexedAnchorId("home-category", category.title, categoryIndex)}>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-[0.7rem] tracking-[0.18em]" style={{ color: category.color }}>
                    {String(category.order).padStart(2, "0")}
                  </span>
                  <h2 className="text-lg font-semibold tracking-[0.01em]" style={{ color: category.color }}>
                    {category.title}
                  </h2>
                  <div className="h-px flex-1" style={{ backgroundColor: `color-mix(in srgb, ${category.color} 30%, transparent)` }} />
                </div>
                {category.description ? (
                  <p className="mt-2 text-sm text-white/70">{category.description}</p>
                ) : null}
                <div
                  className={`${styles.hexBoard} mt-4`}
                  data-testid="hex-board"
                  style={{
                    width: `${boardDimensions.width}px`,
                    maxWidth: "100%",
                    height: `${boardDimensions.height}px`,
                  }}
                >
                  {positionedSheets.map(({ item: sheet, left, top, visualColIndex }) => {
                    const index = cardIndexBySlug.get(sheet.slug) ?? -1;
                    const isSelected = selectedIndex === index;
                    const hexaColorTo = getSecondaryColorForColumn(visualColIndex);
                    const gridColor = sheetGridColors.get(sheet.slug);
                    const isHexaMode = uiSettings.modern.colorMode === "hexa";
                    const isGridMode = uiSettings.modern.colorMode === "grid";
                    const isCategoryMode = uiSettings.modern.colorMode === "category";

                    let primaryColor: string;
                    let secondaryColor: string;
                    let titleColor: string;

                    if (isGridMode && gridColor) {
                      primaryColor = gridColor;
                      secondaryColor = gridColor;
                      titleColor = gridColor;
                    } else if (isHexaMode) {
                      primaryColor = sheet.colorFrom;
                      secondaryColor = hexaColorTo;
                      titleColor = sheet.colorFrom; // Will use gradient CSS
                    } else if (isCategoryMode) {
                      primaryColor = sheet.colorFrom;
                      secondaryColor = sheet.colorFrom;
                      titleColor = sheet.colorFrom;
                    } else {
                      primaryColor = sheet.color;
                      secondaryColor = sheet.color;
                      titleColor = sheet.color;
                    }

                    const useGradientTitle = isHexaMode;

                    const iconName = sheet.icon ?? "default";

                    return (
                      <div
                        key={sheet.slug}
                        className={`${styles.hexCell} ${styles.hexCellAbs}`}
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
                          className={`${styles.hexCard} text-left`}
                          style={{
                            "--hex-border-color": sheet.color,
                            "--hex-color-from": sheet.colorFrom,
                            "--hex-color-to": hexaColorTo,
                          } as CSSProperties}
                        >
                          <svg
                            className={styles.hexShape}
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
                                    <stop offset="0%" stopColor={primaryColor} />
                                    <stop offset="100%" stopColor={secondaryColor} />
                                  </>
                                )}
                                {uiSettings.modern.border === "left" && (
                                  <>
                                    <stop offset="0%" stopColor="transparent" />
                                    <stop offset="45%" stopColor={primaryColor} />
                                    <stop offset="100%" stopColor={secondaryColor} />
                                  </>
                                )}
                                {uiSettings.modern.border === "right" && (
                                  <>
                                    <stop offset="0%" stopColor={primaryColor} />
                                    <stop offset="55%" stopColor={secondaryColor} />
                                    <stop offset="100%" stopColor="transparent" />
                                  </>
                                )}
                                {uiSettings.modern.border === "both" && (
                                  <>
                                    <stop offset="0%" stopColor="transparent" />
                                    <stop offset="40%" stopColor={primaryColor} />
                                    <stop offset="60%" stopColor={secondaryColor} />
                                    <stop offset="100%" stopColor="transparent" />
                                  </>
                                )}
                              </linearGradient>
                            </defs>
                            <path
                              className={styles.hexShapePath}
                              d="M30 7 L70 7 Q75 7 77.4 11.3 L94.2 42.5 Q99 50 94.2 57.5 L77.4 88.7 Q75 93 70 93 L30 93 Q25 93 22.6 88.7 L5.8 57.5 Q1 50 5.8 42.5 L22.6 11.3 Q25 7 30 7 Z"
                              style={{ stroke: `url(#hex-grad-${sheet.slug})` }}
                            />
                          </svg>
                          <div className={`${styles.hexCardInner} ${styles.hasIcon}`}>
                            {
                              <>
                                <div className={`${styles.hexHalf} ${styles.hexHalfIcon}`}>
                                  <TechIcon
                                    icon={iconName}
                                    color={primaryColor}
                                    className={styles.hexIcon}
                                  />
                                </div>
                                <div className={`${styles.hexHalf} ${styles.hexHalfTitle}`}>
                                  {useGradientTitle ? (
                                    <h3
                                      className={`${styles.hexTitle} ${styles.hexTitleGradient}`}
                                      style={{
                                        "--gradient-from": sheet.colorFrom,
                                        "--gradient-to": hexaColorTo,
                                      } as CSSProperties}
                                    >
                                      {sheet.title}
                                    </h3>
                                  ) : (
                                    <h3 className={styles.hexTitle} style={{ color: titleColor }}>
                                      {sheet.title}
                                    </h3>
                                  )}
                                </div>
                              </>
                            }
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

      <HelpButton onClick={() => setHelpOpen(true)} />

      <SettingsButton onClick={() => setSettingsPanelOpen(true)} />

      <AnchorNavigation items={categoryNavigationItems} ariaLabel="Category navigation" />

      <SettingsPanel
        isOpen={settingsPanelOpen}
        onClose={() => setSettingsPanelOpen(false)}
        settings={uiSettings}
        onSetColorMode={setColorMode}
        onToggleRandom={toggleRandom}
        onSetBorder={setBorder}
        onSetDirection={setDirection}
        onSetActivePanelTab={setActivePanelTab}
        onResetModern={resetModern}
      />
    </div>
  );
}
