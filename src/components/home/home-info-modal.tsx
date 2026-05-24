"use client";

import { useCallback, type CSSProperties } from "react";
import { Modal } from "@/components/ui/modal";
import { TechIcon } from "@/components/ui/tech-icon";
import { InlineKeybinding } from "@/components/help/inline-keybinding-help";
import type { CheatSheetMeta } from "@/lib/cheatsheet-shared";
import { useScopedKeyboardHandler } from "@/hooks/use-keyboard-context";
import { useKeybindings } from "@/hooks/use-keybindings";
import { ACTION_IDS } from "@/lib/keybindings";
import styles from "./home-info-modal.module.css";

type Props = {
  open: boolean;
  onClose: () => void;
  sheet: CheatSheetMeta | null;
  accentColor: string | null;
};

export function HomeInfoModal({ open, onClose, sheet, accentColor }: Props) {
  const { resolveAction } = useKeybindings();

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      const matched = resolveAction(event, [ACTION_IDS.INFO_CLOSE]);
      if (matched === ACTION_IDS.INFO_CLOSE) {
        event.preventDefault();
        onClose();
      }
    },
    [resolveAction, onClose]
  );

  useScopedKeyboardHandler("info", handleKeyDown, [handleKeyDown]);

  if (!sheet) return null;

  const iconName = sheet.icon ?? "default";

  const titleStyle: CSSProperties = accentColor
    ? {
        background: `linear-gradient(135deg, ${sheet.colorFrom}, ${accentColor})`,
        WebkitBackgroundClip: "text",
        WebkitTextFillColor: "transparent",
        backgroundClip: "text",
      }
    : { color: sheet.color };

  const iconColor = accentColor ?? sheet.color;

  return (
    <Modal open={open} onClose={onClose} className="max-w-xl">
      <div className="flex items-stretch gap-4 max-sm:flex-col max-sm:gap-4">
        <div className="flex w-20 shrink-0 items-center justify-center max-sm:w-full max-sm:justify-start">
          <div className={`${styles.detailsIcon} p-2`}>
            <TechIcon
              icon={iconName}
              color={iconColor}
              className="h-16 w-16"
            />
          </div>
        </div>
        <div
          className={`${styles.detailsDivider} max-sm:hidden`}
          aria-hidden="true"
        />
        <div className="min-w-0 flex-1">
          <h3
            className="min-w-0 text-2xl font-semibold md:text-[2rem]"
            style={titleStyle}
          >
            {sheet.title}
          </h3>
          <p className="mt-4 text-base leading-7 text-white/90 md:text-lg">
            {sheet.summary}
          </p>
        </div>
      </div>
      <p className="mt-4 text-right text-xs text-white/75">
        Press <InlineKeybinding actionId={ACTION_IDS.INFO_CLOSE} maxCombos={3} /> to close.
      </p>
    </Modal>
  );
}
