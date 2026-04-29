"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export function SheetShortcuts() {
  const router = useRouter();
  const [legendOpen, setLegendOpen] = useState(false);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "?") {
        event.preventDefault();
        setLegendOpen((prev) => !prev);
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        if (legendOpen) {
          setLegendOpen(false);
          return;
        }
        router.push("/");
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [legendOpen, router]);

  return (
    <>
      <button
        type="button"
        onClick={() => setLegendOpen(true)}
        className="fixed right-5 top-5 z-20 rounded-full border border-white/25 bg-white/10 px-3 py-1 font-mono text-xs text-white/85 backdrop-blur transition hover:border-white/35 hover:bg-white/15"
      >
        ? Legend
      </button>

      {legendOpen ? (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-[#03060ecc] px-6">
          <div className="w-full max-w-2xl rounded-2xl border border-white/20 bg-[#11203ad9] p-6 text-sm text-white/90 shadow-2xl backdrop-blur">
            <p className="font-mono text-xs tracking-[0.15em] text-white/70">KEY LEGEND</p>
            <h3 className="mt-2 text-xl font-semibold">Symbol shortcuts</h3>
            <table className="legend-table mt-4">
              <tbody>
                <tr>
                  <td><span className="legend-keycap">⌘</span></td>
                  <td>Command</td>
                  <td><span className="legend-keycap">⌥</span></td>
                  <td>Option</td>
                </tr>
                <tr>
                  <td><span className="legend-keycap">^</span></td>
                  <td>Control</td>
                  <td><span className="legend-keycap">⇧</span></td>
                  <td>Shift</td>
                </tr>
                <tr>
                  <td><span className="legend-keycap">↩</span></td>
                  <td>Enter</td>
                  <td><span className="legend-keycap">⎋</span></td>
                  <td>Escape</td>
                </tr>
                <tr>
                  <td><span className="legend-keycap"><ArrowGlyph direction="left" /></span></td>
                  <td>Arrow left</td>
                  <td><span className="legend-keycap"><ArrowGlyph direction="up" /></span></td>
                  <td>Arrow up</td>
                </tr>
                <tr>
                  <td><span className="legend-keycap"><ArrowGlyph direction="down" /></span></td>
                  <td>Arrow down</td>
                  <td><span className="legend-keycap"><ArrowGlyph direction="right" /></span></td>
                  <td>Arrow right</td>
                </tr>
              </tbody>
            </table>
            <p className="mt-4 text-xs text-white/75">Press <span className="font-mono">?</span> to toggle, <span className="font-mono">Esc</span> to close.</p>
          </div>
        </div>
      ) : null}
    </>
  );
}

function ArrowGlyph({ direction }: { direction: "left" | "right" | "up" | "down" }) {
  if (direction === "left") {
    return (
      <svg viewBox="0 0 16 16" className="legend-arrow" aria-hidden="true">
        <path d="M14 8H4" />
        <path d="M7 5L4 8L7 11" />
      </svg>
    );
  }

  if (direction === "right") {
    return (
      <svg viewBox="0 0 16 16" className="legend-arrow" aria-hidden="true">
        <path d="M2 8H12" />
        <path d="M9 5L12 8L9 11" />
      </svg>
    );
  }

  if (direction === "up") {
    return (
      <svg viewBox="0 0 16 16" className="legend-arrow" aria-hidden="true">
        <path d="M8 14V4" />
        <path d="M5 7L8 4L11 7" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 16 16" className="legend-arrow" aria-hidden="true">
      <path d="M8 2V12" />
      <path d="M5 9L8 12L11 9" />
    </svg>
  );
}
