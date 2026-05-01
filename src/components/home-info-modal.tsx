import { Modal } from "@/components/modal";
import { TechIcon } from "@/components/tech-icon";
import type { CheatSheetMeta } from "@/lib/yaml-cheatsheets";
import type { CSSProperties } from "react";

type Props = {
  open: boolean;
  onClose: () => void;
  sheet: CheatSheetMeta | null;
  colorTo: string | null;
};

export function HomeInfoModal({ open, onClose, sheet, colorTo }: Props) {
  if (!sheet) return null;

  // Use gradient style when colorTo is provided (hex-gradient mode)
  const titleStyle: CSSProperties = colorTo
    ? {
        background: `linear-gradient(135deg, ${sheet.colorFrom}, ${colorTo})`,
        WebkitBackgroundClip: "text",
        WebkitTextFillColor: "transparent",
        backgroundClip: "text",
      }
    : { color: sheet.color };

  return (
    <Modal open={open} onClose={onClose} className="max-w-xl">
      <div className="flex items-stretch gap-4 max-sm:flex-col max-sm:gap-4">
        {sheet.icon ? (
          <div className="flex w-20 shrink-0 items-center justify-center max-sm:w-full max-sm:justify-start">
            <div className="sheet-details-icon p-2">
              <TechIcon
                icon={sheet.icon}
                color={colorTo ? sheet.colorFrom : sheet.color}
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
