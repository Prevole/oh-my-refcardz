"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { useRegisterModalOpen } from "@/components/sheets/sheet-commands-shell";
import sheetCommandStyles from "./sheet-commands.module.css";
import dialogStyles from "@/components/ui/modal.module.css";

type CommandExampleModalProps = {
  title: string;
  command: string;
  example: string;
  onClose: () => void;
};

export function CommandExampleModal({ title, command, example, onClose }: CommandExampleModalProps) {
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

  return createPortal(
    <div
      className={sheetCommandStyles.modalOverlay}
      data-command-modal-overlay
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Example for: ${title}`}
    >
      <div
        className={sheetCommandStyles.modal}
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" className={dialogStyles.dismiss} onClick={onClose} aria-label="Close">✕</button>
        <p className={sheetCommandStyles.modalLabel}>EXAMPLE</p>
        <h3 className={sheetCommandStyles.modalTitle}>{title}</h3>

        <div className={sheetCommandStyles.modalSection}>
          <p className={sheetCommandStyles.modalSectionLabel}>Command</p>
          <p className={sheetCommandStyles.modalTerminal}>{command}</p>
        </div>

        <div className={sheetCommandStyles.modalSection}>
          <p className={sheetCommandStyles.modalSectionLabel}>Example</p>
          <p className={`${sheetCommandStyles.modalTerminal} ${sheetCommandStyles.modalExample}`}>{example}</p>
        </div>

        <button type="button" className={sheetCommandStyles.modalCloseButton} onClick={onClose}>
          Close <kbd>Esc</kbd>
        </button>
      </div>
    </div>,
    document.body
  );
}
