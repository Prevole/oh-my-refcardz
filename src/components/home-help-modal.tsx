import { Modal } from "@/components/modal";
import { ArrowGlyph } from "@/components/arrow-glyph";

type Props = {
  open: boolean;
  onClose: () => void;
};

export function HomeHelpModal({ open, onClose }: Props) {
  return (
    <Modal open={open} onClose={onClose} className="max-w-2xl">
      <p className="font-mono text-xs tracking-[0.15em] text-white/70">
        KEYBOARD SHORTCUTS
      </p>
      <h3 className="mt-2 text-xl font-semibold">Navigation</h3>
      <table className="legend-table mt-4">
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
            <td>
              <span className="inline-flex items-center gap-1">
                <span className="legend-keycap">↩</span>
                <span className="text-xs text-white/40">or</span>
                <span className="legend-keycap">␣</span>
              </span>
            </td>
            <td>Open sheet</td>
            <td>
              <span className="legend-keycap">/</span>
            </td>
            <td>Focus search</td>
          </tr>
          <tr>
            <td>
              <span className="legend-keycap">
                <span className="small-caps">esc</span>
              </span>
            </td>
            <td>Clear search</td>
            <td>
              <span className="legend-keycap">i</span>
            </td>
            <td>Toggle details</td>
          </tr>
          <tr>
            <td>
              <span className="legend-keycap">?</span>
            </td>
            <td>Toggle help</td>
            <td />
            <td />
          </tr>
        </tbody>
      </table>
      <p className="mt-4 text-xs text-white/75">
        Press <span className="font-mono">?</span> to toggle,{" "}
        <span className="font-mono">Esc</span> to close.
      </p>
    </Modal>
  );
}
