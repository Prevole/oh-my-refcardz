"use client";

import { useCallback, useState } from "react";
import { Modal } from "@/components/ui/modal";
import { ArrowGlyph } from "@/components/ui/arrow-glyph";
import { HelpRow } from "@/components/settings/keybinding-display";
import { useScopedKeyboardHandler } from "@/hooks/use-keyboard-context";
import { ACTION_IDS, getCombosDisplay } from "@/lib/keybindings";
import { useActionCombos } from "@/components/settings/keybinding-display";
import helpStyles from "./help-modal.module.css";
import keybindingStyles from "@/components/settings/keybinding-display.module.css";

type Props = {
  open: boolean;
  onClose: () => void;
};

type Tab = "shortcuts" | "layout" | "legend";

export function SheetHelpModal({ open, onClose }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>("shortcuts");
  const toggleHelpCombos = useActionCombos(ACTION_IDS.TOGGLE_HELP);
  const toggleHelpDisplay = getCombosDisplay(toggleHelpCombos);

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
    <Modal open={open} onClose={onClose} className="flex h-[min(80vh,44rem)] max-w-4xl flex-col">
      <p className="font-mono text-xs tracking-[0.15em] text-white/70">HELP</p>

      <div className={helpStyles.tabs}>
        <button
          className={helpStyles.tab}
          data-active={activeTab === "shortcuts"}
          onClick={() => setActiveTab("shortcuts")}
        >
          App Shortcuts
        </button>
        <button
          className={helpStyles.tab}
          data-active={activeTab === "layout"}
          onClick={() => setActiveTab("layout")}
        >
          Layout
        </button>
        <button
          className={helpStyles.tab}
          data-active={activeTab === "legend"}
          onClick={() => setActiveTab("legend")}
        >
          Symbol Legend
        </button>
      </div>

      <div className={helpStyles.panel}>
        <div className={helpStyles.tabContent} data-active={activeTab === "shortcuts"}>
          <div className={helpStyles.layoutSection}>
            <h3 className="text-xl font-semibold">Navigation</h3>
            <p className={helpStyles.layoutSectionIntro}>
              Move around the cheatsheet itself, jump through the page, or return to the grid without reaching for the mouse.
            </p>
            <table className={`${keybindingStyles.legendTable} mt-3`}>
              <colgroup>
                <col />
                <col />
                <col />
                <col />
              </colgroup>
              <tbody>
                <tr>
                  <HelpRow actionId={ACTION_IDS.BACK_TO_HOME} />
                  <HelpRow actionId={ACTION_IDS.GO_TOP} />
                </tr>
                <tr>
                  <HelpRow actionId={ACTION_IDS.GO_BOTTOM} />
                  <td />
                  <td />
                </tr>
              </tbody>
            </table>
          </div>

          <div className={helpStyles.layoutSection}>
            <h3 className="text-xl font-semibold">Commands</h3>
            <p className={helpStyles.layoutSectionIntro}>
              Browse commands inside cards, inspect examples, and copy what you need while staying in flow.
            </p>
            <table className={`${keybindingStyles.legendTable} mt-3`}>
              <colgroup>
                <col />
                <col />
                <col />
                <col />
              </colgroup>
              <tbody>
                <tr>
                  <HelpRow actionId={ACTION_IDS.MOVE_LEFT} />
                  <HelpRow actionId={ACTION_IDS.MOVE_RIGHT} />
                </tr>
                <tr>
                  <HelpRow actionId={ACTION_IDS.MOVE_DOWN} />
                  <HelpRow actionId={ACTION_IDS.MOVE_UP} />
                </tr>
                <tr>
                  <HelpRow actionId={ACTION_IDS.COPY_COMMAND} />
                  <HelpRow actionId={ACTION_IDS.SHOW_EXAMPLE} />
                </tr>
              </tbody>
            </table>
          </div>

          <div className={helpStyles.layoutSection}>
            <h3 className="text-xl font-semibold">Misc</h3>
            <p className={helpStyles.layoutSectionIntro}>
              Open supporting panels and reference surfaces from anywhere in the page.
            </p>
            <table className={`${keybindingStyles.legendTable} mt-3`}>
              <colgroup>
                <col />
                <col />
                <col />
                <col />
              </colgroup>
              <tbody>
                <tr>
                  <HelpRow actionId={ACTION_IDS.TOGGLE_HELP} />
                  <HelpRow actionId={ACTION_IDS.TOGGLE_SETTINGS} />
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className={helpStyles.tabContent} data-active={activeTab === "layout"}>
          <div className={helpStyles.layoutSection}>
            <h3 className="text-xl font-semibold">Focus a Card</h3>
            <p className={helpStyles.layoutSectionIntro}>
              Layout editing is implicit. Use the focus-card shortcuts below to select a card and reveal the layout overlay.
            </p>
            <table className={`${helpStyles.layoutTable} mt-3`}>
              <colgroup>
                <col />
                <col />
                <col />
                <col />
              </colgroup>
              <tbody>
                <tr>
                  <HelpRow actionId={ACTION_IDS.CARD_NAV_LEFT} label="Focus card left" />
                  <HelpRow actionId={ACTION_IDS.CARD_NAV_RIGHT} label="Focus card right" />
                </tr>
                <tr>
                  <HelpRow actionId={ACTION_IDS.CARD_NAV_UP} label="Focus card above" />
                  <HelpRow actionId={ACTION_IDS.CARD_NAV_DOWN} label="Focus card below" />
                </tr>
              </tbody>
            </table>
          </div>

          <div className={helpStyles.layoutSection}>
            <h3 className="text-xl font-semibold">Move a Card</h3>
            <p className={helpStyles.layoutSectionIntro}>
              Once a card is focused, use the move shortcuts below to nudge it across the dashboard grid.
            </p>
            <table className={`${helpStyles.layoutTable} mt-3`}>
              <colgroup>
                <col />
                <col />
                <col />
                <col />
              </colgroup>
              <tbody>
                <tr>
                  <HelpRow actionId={ACTION_IDS.CARD_MOVE_LEFT} />
                  <HelpRow actionId={ACTION_IDS.CARD_MOVE_RIGHT} />
                </tr>
                <tr>
                  <HelpRow actionId={ACTION_IDS.CARD_MOVE_UP} />
                  <HelpRow actionId={ACTION_IDS.CARD_MOVE_DOWN} />
                </tr>
              </tbody>
            </table>
          </div>

          <div className={helpStyles.layoutSection}>
            <h3 className="text-xl font-semibold">Resize a Card</h3>
            <p className={helpStyles.layoutSectionIntro}>
              Resize the focused card with the keyboard shortcuts below, or drag its edges with the mouse.
            </p>
            <table className={`${helpStyles.layoutTable} mt-3`}>
              <colgroup>
                <col />
                <col />
                <col />
                <col />
              </colgroup>
              <tbody>
                <tr>
                  <HelpRow actionId={ACTION_IDS.CARD_SHRINK_WIDTH} />
                  <HelpRow actionId={ACTION_IDS.CARD_GROW_WIDTH} />
                </tr>
                <tr>
                  <HelpRow actionId={ACTION_IDS.CARD_SHRINK_HEIGHT} />
                  <HelpRow actionId={ACTION_IDS.CARD_GROW_HEIGHT} />
                </tr>
              </tbody>
            </table>
          </div>

          <div className={helpStyles.layoutSection}>
            <h3 className="text-xl font-semibold">Misc</h3>
            <p className={helpStyles.layoutSectionIntro}>
              Clear the current card focus without leaving the cheatsheet.
            </p>
            <table className={`${helpStyles.layoutTable} mt-3`}>
              <colgroup>
                <col />
                <col />
                <col />
                <col />
              </colgroup>
              <tbody>
                <tr>
                  <HelpRow actionId={ACTION_IDS.CARD_CLEAR_FOCUS} />
                  <td />
                  <td />
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className={helpStyles.tabContent} data-active={activeTab === "legend"}>
          <div className={helpStyles.layoutSection}>
            <h3 className="text-xl font-semibold">Symbols</h3>
            <p className={helpStyles.layoutSectionIntro}>
              Reference symbols used across keybindings and shortcut displays in the app.
            </p>
            <table className={`${keybindingStyles.legendTable} mt-3`}>
              <colgroup>
                <col />
                <col />
                <col />
                <col />
              </colgroup>
              <tbody>
                <tr>
                  <td><span className={keybindingStyles.legendKeycapSheet}>⌘</span></td>
                  <td>Command</td>
                  <td><span className={keybindingStyles.legendKeycapSheet}>⌥</span></td>
                  <td>Option</td>
                </tr>
                <tr>
                  <td><span className={keybindingStyles.legendKeycapSheet}>^</span></td>
                  <td>Control</td>
                  <td><span className={keybindingStyles.legendKeycapSheet}>⇧</span></td>
                  <td>Shift</td>
                </tr>
                <tr>
                  <td><span className={keybindingStyles.legendKeycapSheet}>↩</span></td>
                  <td>Enter</td>
                  <td><span className={keybindingStyles.legendKeycapSheet}><span className="small-caps">esc</span></span></td>
                  <td>Escape</td>
                </tr>
                <tr>
                  <td><span className={keybindingStyles.legendKeycapSheet}><ArrowGlyph direction="left" className={keybindingStyles.legendArrow} /></span></td>
                  <td>Arrow left</td>
                  <td><span className={keybindingStyles.legendKeycapSheet}><ArrowGlyph direction="up" className={keybindingStyles.legendArrow} /></span></td>
                  <td>Arrow up</td>
                </tr>
                <tr>
                  <td><span className={keybindingStyles.legendKeycapSheet}><ArrowGlyph direction="down" className={keybindingStyles.legendArrow} /></span></td>
                  <td>Arrow down</td>
                  <td><span className={keybindingStyles.legendKeycapSheet}><ArrowGlyph direction="right" className={keybindingStyles.legendArrow} /></span></td>
                  <td>Arrow right</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <p className={`${helpStyles.footer} text-xs text-white/75`}>
        <span className={`${helpStyles.inlineBinding} font-mono`}>
          {toggleHelpDisplay.join(" or ")}
        </span>{" "}
        or <span className={`${helpStyles.inlineBinding} font-mono`}>Esc</span> to close.
      </p>
    </Modal>
  );
}
