"use client";

import { useCallback } from "react";
import { Modal } from "@/components/modal";
import { ArrowGlyph } from "@/components/arrow-glyph";
import { useScopedKeyboardHandler } from "@/hooks/use-keyboard-context";

type Props = {
  open: boolean;
  onClose: () => void;
};

export function SheetHelpModal({ open, onClose }: Props) {
  // Handle Escape key to close modal (only when help scope is active)
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === "Escape" || event.key === "?") {
        event.preventDefault();
        onClose();
      }
    },
    [onClose]
  );

  useScopedKeyboardHandler("help", handleKeyDown, [handleKeyDown]);

  return (
    <Modal open={open} onClose={onClose} className="max-w-2xl">
      <p className="font-mono text-xs tracking-[0.15em] text-white/70">
        KEYBOARD SHORTCUTS
      </p>

      {/* Symbol legend */}
      <h3 className="mt-4 text-xl font-semibold">Symbol legend</h3>
      <table className="legend-table mt-3">
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

      {/* Navigation */}
      <h3 className="mt-6 text-xl font-semibold">Navigation</h3>
      <table className="legend-table mt-3">
        <tbody>
          <tr>
            <td>
              <span className="inline-flex items-center gap-1">
                <span className="legend-keycap"><span className="small-caps">esc</span></span>
                <span className="text-xs text-white/40">or</span>
                <span className="legend-keycap">⌫</span>
              </span>
            </td>
            <td>Back to grid</td>
            <td />
            <td />
          </tr>
        </tbody>
      </table>

      {/* Commands */}
      <h3 className="mt-6 text-xl font-semibold">Commands</h3>
      <table className="legend-table mt-3">
        <tbody>
          <tr>
            <td>
              <span className="inline-flex items-center gap-1">
                <span className="legend-keycap">h</span>
                <span className="text-xs text-white/40">or</span>
                <span className="legend-keycap">
                  <ArrowGlyph direction="left" className="legend-arrow" />
                </span>
              </span>
            </td>
            <td>Move left</td>
            <td>
              <span className="inline-flex items-center gap-1">
                <span className="legend-keycap">l</span>
                <span className="text-xs text-white/40">or</span>
                <span className="legend-keycap">
                  <ArrowGlyph direction="right" className="legend-arrow" />
                </span>
              </span>
            </td>
            <td>Move right</td>
          </tr>
          <tr>
            <td>
              <span className="inline-flex items-center gap-1">
                <span className="legend-keycap">j</span>
                <span className="text-xs text-white/40">or</span>
                <span className="legend-keycap">
                  <ArrowGlyph direction="down" className="legend-arrow" />
                </span>
              </span>
            </td>
            <td>Move down</td>
            <td>
              <span className="inline-flex items-center gap-1">
                <span className="legend-keycap">k</span>
                <span className="text-xs text-white/40">or</span>
                <span className="legend-keycap">
                  <ArrowGlyph direction="up" className="legend-arrow" />
                </span>
              </span>
            </td>
            <td>Move up</td>
          </tr>
          <tr>
            <td><span className="legend-keycap">y</span></td>
            <td>Copy command</td>
            <td><span className="legend-keycap">i</span></td>
            <td>Show example</td>
          </tr>
        </tbody>
      </table>

      {/* Misc */}
      <h3 className="mt-6 text-xl font-semibold">Misc</h3>
      <table className="legend-table mt-3">
        <tbody>
          <tr>
            <td><span className="legend-keycap">?</span></td>
            <td>Toggle help</td>
            <td><span className="legend-keycap">,</span></td>
            <td>Toggle settings</td>
          </tr>
        </tbody>
      </table>

      <p className="mt-6 text-xs text-white/75">
        Press <span className="font-mono">?</span> to toggle,{" "}
        <span className="font-mono">Esc</span> to close.
      </p>
    </Modal>
  );
}
