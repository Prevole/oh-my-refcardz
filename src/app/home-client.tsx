"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { CheatSheetMeta } from "@/lib/cheatsheets";
import { useColumnCount } from "@/hooks/use-column-count";
import { Keycap } from "@/components/keycap";
import { ArrowGlyph } from "@/components/arrow-glyph";

type Props = {
  sheets: CheatSheetMeta[];
};

export function HomeClient({ sheets }: Props) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [gridRef, columns] = useColumnCount<HTMLElement>();
  const [helpOpen, setHelpOpen] = useState(false);

  const visibleCards = useMemo(() => {
    const normalized = query.toLowerCase().trim();
    if (!normalized) {
      return sheets;
    }

    return sheets.filter((sheet) => {
      return (
        sheet.title.toLowerCase().includes(normalized) ||
        sheet.summary.toLowerCase().includes(normalized) ||
        sheet.slug.toLowerCase().includes(normalized)
      );
    });
  }, [query, sheets]);

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

      if (event.key === "ArrowRight" || event.key === "l") {
        event.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, visibleCards.length - 1));
      }

      if (event.key === "ArrowLeft" || event.key === "h") {
        event.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
      }

      if (event.key === "ArrowDown" || event.key === "j") {
        event.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + columns, visibleCards.length - 1));
      }

      if (event.key === "ArrowUp" || event.key === "k") {
        event.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - columns, 0));
      }

      if (event.key === "Enter" && visibleCards[selectedIndex]) {
        event.preventDefault();
        router.push(`/cheatsheets/${visibleCards[selectedIndex].slug}`);
      }

      if (event.key === "Escape") {
        if (helpOpen) {
          setHelpOpen(false);
          return;
        }
        setQuery("");
        (target as HTMLElement)?.blur?.();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [router, selectedIndex, visibleCards, columns, helpOpen]);

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
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-[#03060ecc] px-6">
          <div className="w-full max-w-2xl rounded-2xl border border-white/20 bg-[#11203ad9] p-6 text-sm text-white/90 shadow-2xl backdrop-blur">
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
                  <td><span className="legend-keycap">↩</span></td>
                  <td>Open sheet</td>
                  <td><span className="legend-keycap">/</span></td>
                  <td>Focus search</td>
                </tr>
                <tr>
                  <td><span className="legend-keycap"><span className="small-caps">esc</span></span></td>
                  <td>Clear search</td>
                  <td><span className="legend-keycap">?</span></td>
                  <td>Toggle help</td>
                </tr>
              </tbody>
            </table>
            <p className="mt-4 text-xs text-white/75">Press <span className="font-mono">?</span> to toggle, <span className="font-mono">Esc</span> to close.</p>
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
          <span>, search with</span>
          <Keycap>/</Keycap>
          <span>, clear with</span>
          <Keycap><span className="small-caps">esc</span></Keycap>
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

        <section ref={gridRef} className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visibleCards.map((sheet, index) => (
            <button
              key={sheet.slug}
              onClick={() => router.push(`/cheatsheets/${sheet.slug}`)}
              className={`rounded-2xl border p-5 text-left transition duration-150 ${
                selectedIndex === index
                  ? "scale-[1.01] border-transparent bg-white/18 shadow-[0_0_0_1px_var(--accent)]"
                  : "border-white/15 bg-white/8 hover:border-white/25 hover:bg-white/12"
              }`}
            >
              <p className="font-mono text-xs uppercase tracking-[0.15em]" style={{ color: sheet.color }}>
                {sheet.slug}
              </p>
              <h2 className="mt-2 text-xl font-semibold">{sheet.title}</h2>
              <p className="mt-2 text-sm text-white/80">{sheet.summary}</p>
            </button>
          ))}
        </section>
        {visibleCards.length === 0 ? (
          <p className="mt-6 text-sm text-white/70">No match. Press Esc to clear your query.</p>
        ) : null}
      </main>
    </div>
  );
}
