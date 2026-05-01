"use client";

import { useCallback, type CSSProperties } from "react";
import { Modal } from "@/components/modal";
import { TechIcon } from "@/components/tech-icon";
import type { CheatSheetMeta } from "@/lib/yaml-cheatsheets";
import { useScopedKeyboardHandler } from "@/hooks/use-keyboard-context";

type Props = {
  open: boolean;
  onClose: () => void;
  sheet: CheatSheetMeta | null;
  accentColor: string | null;
};

export function HomeInfoModal({ open, onClose, sheet, accentColor }: Props) {
  // Handle Escape key to close modal (only when info scope is active)
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === "Escape" || event.key === "i") {
        event.preventDefault();
        onClose();
      }
    },
    [onClose]
  );

  useScopedKeyboardHandler("info", handleKeyDown, [handleKeyDown]);

  if (!sheet) return null;

  // Use accent color when provided (hexa mode: gradient, grid mode: solid interpolated color)
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
        {sheet.icon ? (
          <div className="flex w-20 shrink-0 items-center justify-center max-sm:w-full max-sm:justify-start">
            <div className="sheet-details-icon p-2">
              <TechIcon
                icon={sheet.icon}
                color={iconColor}
                className="h-16 w-16"
              />
            </div>
          </div>
        ) : null}
        {sheet.icon ? (
          <div
            className="sheet-details-divider max-sm:hidden"
            aria-hidden="true"
          />
        ) : null}
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
        Press <span className="font-mono">i</span> or{" "}
        <span className="font-mono">Esc</span> to close.
      </p>
    </Modal>
  );
}
