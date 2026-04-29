"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowGlyph } from "@/components/arrow-glyph";

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
                  <td><span className="legend-keycap"><ArrowGlyph direction="left" className="legend-arrow" /></span></td>
                  <td>Arrow left</td>
                  <td><span className="legend-keycap"><ArrowGlyph direction="up" className="legend-arrow" /></span></td>
                  <td>Arrow up</td>
                </tr>
                <tr>
                  <td><span className="legend-keycap"><ArrowGlyph direction="down" className="legend-arrow" /></span></td>
                  <td>Arrow down</td>
                  <td><span className="legend-keycap"><ArrowGlyph direction="right" className="legend-arrow" /></span></td>
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

