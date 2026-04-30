"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import type { CheatSheetCategory } from "@/lib/yaml-cheatsheets";
import { Keycap } from "@/components/keycap";
import { ArrowGlyph } from "@/components/arrow-glyph";

type Props = {
  categories: CheatSheetCategory[];
};

const SELECTED_SHEET_STORAGE_KEY = "home:selected-sheet-slug";

export function HomeClient({ categories }: Props) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [columns, setColumns] = useState(3);
  const [helpOpen, setHelpOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const hasRestoredSelectionRef = useRef(false);

  useEffect(() => {
    const computeColumns = () => {
      if (window.innerWidth < 640) {
        setColumns(1);
        return;
      }
      if (window.innerWidth < 1024) {
        setColumns(2);
        return;
      }
      setColumns(3);
    };

    computeColumns();
    window.addEventListener("resize", computeColumns);
    return () => window.removeEventListener("resize", computeColumns);
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

  const visibleCards = useMemo(() => {
    return visibleCategories.flatMap((category) => category.sheets);
  }, [visibleCategories]);

  const selectedCard = visibleCards[selectedIndex] ?? null;

  const cardIndexBySlug = useMemo(() => {
    const map = new Map<string, number>();
    visibleCards.forEach((card, index) => {
      map.set(card.slug, index);
    });
    return map;
  }, [visibleCards]);

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
        setSelectedIndex((prev) => Math.min(prev + 1, Math.max(visibleCards.length - 1, 0)));
      }

      if (event.key === "ArrowLeft" || event.key === "h") {
        event.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
      }

      if (event.key === "ArrowDown" || event.key === "j") {
        event.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + columns, Math.max(visibleCards.length - 1, 0)));
      }

      if (event.key === "ArrowUp" || event.key === "k") {
        event.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - columns, 0));
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
  }, [selectedIndex, visibleCards.length, columns, helpOpen, infoOpen, selectedCard, openSheet]);

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

        <section className="mt-8 space-y-8">
          {visibleCategories.map((category) => {
            const rows = Array.from({ length: Math.ceil(category.sheets.length / columns) }, (_, rowIndex) => {
              const start = rowIndex * columns;
              return category.sheets.slice(start, start + columns);
            });

            return (
              <div key={category.id}>
                <h2 className="text-lg font-semibold text-white">{category.title}</h2>
                {category.description ? <p className="mt-1 text-sm text-white/70">{category.description}</p> : null}
                <div className="home-hex-board mt-4" style={{ "--hex-columns": String(columns) } as CSSProperties}>
                  {rows.map((row, rowIndex) => (
                    <div key={`${category.id}-row-${rowIndex}`} className="home-hex-row" data-row-odd={rowIndex % 2 === 1 && columns > 1}>
                      {row.map((sheet, rowItemIndex) => {
                        const index = cardIndexBySlug.get(sheet.slug) ?? -1;
                        const isSelected = selectedIndex === index;
                        return (
                          <button
                            key={sheet.slug}
                            onClick={() => openSheet(sheet.slug)}
                            data-selected={isSelected}
                            data-lowered={columns > 1 && rowItemIndex % 2 === 1}
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
                        );
                      })}
                    </div>
                  ))}
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
