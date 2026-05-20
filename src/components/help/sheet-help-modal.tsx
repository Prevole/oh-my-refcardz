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
              Move around the cheatsheet, jump through the page, or return to the grid without reaching for the mouse.
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
                  <HelpRow actionId={ACTION_IDS.CLEAR_COMMAND_FOCUS} />
                  <HelpRow actionId={ACTION_IDS.BACK_TO_HOME} />
                </tr>
                <tr>
                  <HelpRow actionId={ACTION_IDS.GO_TOP} />
                  <HelpRow actionId={ACTION_IDS.GO_BOTTOM} />
                </tr>
              </tbody>
            </table>
          </div>

          <div className={helpStyles.layoutSection}>
            <h3 className="text-xl font-semibold">Actions</h3>
            <p className={helpStyles.layoutSectionIntro}>
              Copy commands and inspect details while staying in flow.
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
            <h3 className="text-xl font-semibold">Enter Layout Mode</h3>
            <p className={helpStyles.layoutSectionIntro}>
              Press the shortcut below to enter the modal layout editor. The mode opens in <em>navigation</em> by default; press <kbd>m</kbd> for move or <kbd>r</kbd> for resize, and <kbd>Esc</kbd> to leave.
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
                  <HelpRow actionId={ACTION_IDS.LAYOUT_ENTER_MODE} />
                  <td />
                  <td />
                </tr>
              </tbody>
            </table>
          </div>

          <div className={helpStyles.layoutSection}>
            <h3 className="text-xl font-semibold">Navigation Sub-Mode</h3>
            <p className={helpStyles.layoutSectionIntro}>
              Move the focus between blocks. Press <kbd>m</kbd> to switch to move, <kbd>r</kbd> to switch to resize.
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
                  <HelpRow actionId={ACTION_IDS.LAYOUT_NAV_LEFT} label="Focus card left" />
                  <HelpRow actionId={ACTION_IDS.LAYOUT_NAV_RIGHT} label="Focus card right" />
                </tr>
                <tr>
                  <HelpRow actionId={ACTION_IDS.LAYOUT_NAV_UP} label="Focus card above" />
                  <HelpRow actionId={ACTION_IDS.LAYOUT_NAV_DOWN} label="Focus card below" />
                </tr>
                <tr>
                  <HelpRow actionId={ACTION_IDS.LAYOUT_NAV_TO_MOVE} />
                  <HelpRow actionId={ACTION_IDS.LAYOUT_NAV_TO_RESIZE} />
                </tr>
              </tbody>
            </table>
          </div>

          <div className={helpStyles.layoutSection}>
            <h3 className="text-xl font-semibold">Move Sub-Mode</h3>
            <p className={helpStyles.layoutSectionIntro}>
              Move the focused block by one grid cell at a time. Add <kbd>Alt</kbd> to refuse any wrap or push (strict move).
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
                  <HelpRow actionId={ACTION_IDS.LAYOUT_MOVE_LEFT} />
                  <HelpRow actionId={ACTION_IDS.LAYOUT_MOVE_RIGHT} />
                </tr>
                <tr>
                  <HelpRow actionId={ACTION_IDS.LAYOUT_MOVE_UP} />
                  <HelpRow actionId={ACTION_IDS.LAYOUT_MOVE_DOWN} />
                </tr>
                <tr>
                  <HelpRow actionId={ACTION_IDS.LAYOUT_MOVE_STRICT_LEFT} />
                  <HelpRow actionId={ACTION_IDS.LAYOUT_MOVE_STRICT_RIGHT} />
                </tr>
                <tr>
                  <HelpRow actionId={ACTION_IDS.LAYOUT_MOVE_STRICT_UP} />
                  <HelpRow actionId={ACTION_IDS.LAYOUT_MOVE_STRICT_DOWN} />
                </tr>
                <tr>
                  <HelpRow actionId={ACTION_IDS.LAYOUT_MOVE_TO_NAV} />
                  <HelpRow actionId={ACTION_IDS.LAYOUT_MOVE_TO_RESIZE} />
                </tr>
              </tbody>
            </table>
          </div>

          <div className={helpStyles.layoutSection}>
            <h3 className="text-xl font-semibold">Resize Sub-Mode</h3>
            <p className={helpStyles.layoutSectionIntro}>
              Grow or shrink the focused block. Plain <kbd>h/j/k/l</kbd> grows the matching edge; with <kbd>Shift</kbd> they shrink it. <kbd>Alt</kbd> enforces strict resizes (no wrap/push); <kbd>Ctrl+Shift</kbd> pulls neighbors in (compact shrink).
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
                  <HelpRow actionId={ACTION_IDS.LAYOUT_RESIZE_GROW_LEFT} />
                  <HelpRow actionId={ACTION_IDS.LAYOUT_RESIZE_GROW_RIGHT} />
                </tr>
                <tr>
                  <HelpRow actionId={ACTION_IDS.LAYOUT_RESIZE_GROW_UP} />
                  <HelpRow actionId={ACTION_IDS.LAYOUT_RESIZE_GROW_DOWN} />
                </tr>
                <tr>
                  <HelpRow actionId={ACTION_IDS.LAYOUT_RESIZE_SHRINK_LEFT} />
                  <HelpRow actionId={ACTION_IDS.LAYOUT_RESIZE_SHRINK_RIGHT} />
                </tr>
                <tr>
                  <HelpRow actionId={ACTION_IDS.LAYOUT_RESIZE_SHRINK_UP} />
                  <HelpRow actionId={ACTION_IDS.LAYOUT_RESIZE_SHRINK_DOWN} />
                </tr>
                <tr>
                  <HelpRow actionId={ACTION_IDS.LAYOUT_RESIZE_TO_NAV} />
                  <HelpRow actionId={ACTION_IDS.LAYOUT_RESIZE_TO_MOVE} />
                </tr>
              </tbody>
            </table>
          </div>

          <div className={helpStyles.layoutSection}>
            <h3 className="text-xl font-semibold">Reset</h3>
            <p className={helpStyles.layoutSectionIntro}>
              Discard your customizations and return to the original layout shipped with the cheatsheet.
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
                  <HelpRow actionId={ACTION_IDS.RESET_LAYOUT} />
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
