"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowGlyph } from "@/components/arrow-glyph";

export function SheetShortcuts() {
  const router = useRouter();
  const [helpOpen, setHelpOpen] = useState(false);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      // Never hijack keys when focus is inside an editable element
      const tag = (event.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return;

      if (event.key === "?") {
        event.preventDefault();
        setHelpOpen((prev) => !prev);
        return;
      }

      if (event.key === "Escape" || event.key === "Backspace") {
        event.preventDefault();
        if (helpOpen) {
          setHelpOpen(false);
          return;
        }
        // If a command modal is open, let it handle Escape itself
        if (document.querySelector(".command-modal-overlay")) return;
        router.push("/");
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [helpOpen, router]);

  return (
    <>
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
            <h3 className="mt-2 text-xl font-semibold">Symbol legend</h3>
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
                  <td><span className="legend-keycap"><span className="small-caps">esc</span></span></td>
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
            <h3 className="mt-5 text-xl font-semibold">Navigation</h3>
            <table className="legend-table mt-4">
              <tbody>
                <tr>
                  <td><span className="legend-keycap"><span className="small-caps">esc</span></span></td>
                  <td>Back to grid</td>
                  <td><span className="legend-keycap">⌫</span></td>
                  <td>Back to grid</td>
                </tr>
                <tr>
                  <td><span className="legend-keycap">?</span></td>
                  <td>Toggle help</td>
                  <td></td>
                  <td></td>
                </tr>
              </tbody>
            </table>
            <h3 className="mt-5 text-xl font-semibold">Commands</h3>
            <table className="legend-table mt-4">
              <tbody>
                <tr>
                  <td>
                    <span style={{ display: "inline-flex", gap: "0.3rem" }}>
                      <span className="legend-keycap"><ArrowGlyph direction="up" className="legend-arrow" /></span>
                      <span className="legend-keycap"><ArrowGlyph direction="down" className="legend-arrow" /></span>
                      <span className="legend-keycap"><ArrowGlyph direction="left" className="legend-arrow" /></span>
                      <span className="legend-keycap"><ArrowGlyph direction="right" className="legend-arrow" /></span>
                    </span>
                  </td>
                  <td>Navigate commands</td>
                  <td>
                    <span style={{ display: "inline-flex", gap: "0.3rem" }}>
                      <span className="legend-keycap">h</span>
                      <span className="legend-keycap">j</span>
                      <span className="legend-keycap">k</span>
                      <span className="legend-keycap">l</span>
                    </span>
                  </td>
                  <td>Navigate (Vim)</td>
                </tr>
                <tr>
                  <td><span className="legend-keycap">y</span></td>
                  <td>Copy command</td>
                  <td><span className="legend-keycap">i</span></td>
                  <td>Show example</td>
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

