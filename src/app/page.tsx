"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { cheatsheets } from "@/lib/cheatsheets";

export default function Home() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  const visibleCards = useMemo(() => {
    const normalized = query.toLowerCase().trim();
    if (!normalized) {
      return cheatsheets;
    }

    return cheatsheets.filter((sheet) => {
      return (
        sheet.title.toLowerCase().includes(normalized) ||
        sheet.summary.toLowerCase().includes(normalized) ||
        sheet.sections.some(
          (section) =>
            section.title.toLowerCase().includes(normalized) ||
            section.items.some((item) => item.keys.toLowerCase().includes(normalized))
        )
      );
    });
  }, [query]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (target?.tagName === "INPUT" && event.key !== "Escape") {
        return;
      }

      const columns = 3;

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
        setQuery("");
        (target as HTMLElement)?.blur?.();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [router, selectedIndex, visibleCards]);

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden px-6 py-10 md:px-12">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_10%_20%,#ffb70355,transparent_30%),radial-gradient(circle_at_90%_0%,#00d1b250,transparent_35%),linear-gradient(130deg,#0d1321,#111f35)]" />
      <main className="z-10 mx-auto flex w-full max-w-6xl flex-1 flex-col">
        <p className="font-mono text-xs tracking-[0.2em] text-white/70">OH MY REFCARDZ</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight md:text-5xl">Keyboard-first cheat sheets</h1>
        <p className="mt-3 max-w-2xl text-sm text-white/75 md:text-base">
          Navigate with <span className="font-mono">hjkl</span> or arrows, open with <span className="font-mono">Enter</span>, search with <span className="font-mono">/</span>, clear with <span className="font-mono">Esc</span>.
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

        <section className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
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
