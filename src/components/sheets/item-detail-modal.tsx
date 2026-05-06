"use client";

import { useEffect, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { useRegisterModalOpen } from "@/components/sheets/sheet-commands-shell";
import { EntryRenderer } from "@/components/sheets/entry-renderers";
import type { CheatSheetEntry } from "@/lib/yaml-cheatsheets";
import sheetCommandStyles from "./sheet-commands.module.css";
import dialogStyles from "@/components/ui/modal.module.css";

type ItemDetailModalProps = {
  title: string;
  detailedEntries: CheatSheetEntry[];
  accentColor: string | null;
  onClose: () => void;
};

export function ItemDetailModal({ title, detailedEntries, accentColor, onClose }: ItemDetailModalProps) {
  const registerModalOpen = useRegisterModalOpen();

  useEffect(() => {
    const unregister = registerModalOpen();
    return unregister;
  }, [registerModalOpen]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const hasAliases = detailedEntries.some(
    (entry) => "alias" in entry || "aliases" in entry
  );

  const style: CSSProperties | undefined = accentColor
    ? { "--sheet-accent": accentColor } as CSSProperties
    : undefined;

  return createPortal(
    <div
      className={sheetCommandStyles.modalOverlay}
      style={style}
      data-command-modal-overlay
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Details for: ${title}`}
    >
      <div
        className={sheetCommandStyles.modal}
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" className={dialogStyles.dismiss} onClick={onClose} aria-label="Close">✕</button>
        <h3 className={sheetCommandStyles.modalTitle}>{title}</h3>

        <div className={sheetCommandStyles.modalEntries}>
          {detailedEntries.map((entry, index) => (
            <EntryRenderer key={index} entry={entry} hasAliases={hasAliases} />
          ))}
        </div>

        <p className={sheetCommandStyles.modalFooter}>
          <span className={sheetCommandStyles.modalFooterBinding}>Esc</span> to close.
        </p>
      </div>
    </div>,
    document.body
  );
}
