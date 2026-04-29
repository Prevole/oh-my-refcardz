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
          <div className="w-full max-w-md rounded-2xl border border-white/20 bg-[#11203ad9] p-5 text-sm text-white/90 shadow-2xl backdrop-blur">
            <p className="font-mono text-xs tracking-[0.15em] text-white/70">KEY LEGEND</p>
            <h3 className="mt-2 text-lg font-semibold">Symbol shortcuts</h3>
            <div className="mt-4 grid grid-cols-2 gap-2 font-mono text-xs">
              <span>⌘</span><span className="font-sans">Command</span>
              <span>⌥</span><span className="font-sans">Option</span>
              <span>^</span><span className="font-sans">Control</span>
              <span>⇧</span><span className="font-sans">Shift</span>
              <span>↩</span><span className="font-sans">Enter</span>
              <span>⎋</span><span className="font-sans">Escape</span>
              <span>← ↑ ↓ →</span><span className="font-sans">Arrow keys</span>
            </div>
            <p className="mt-4 text-xs text-white/75">Press <span className="font-mono">?</span> to toggle, <span className="font-mono">Esc</span> to close.</p>
          </div>
        </div>
      ) : null}
    </>
  );
}
