"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { useRegisterModalOpen } from "@/components/sheet-commands-shell";
import commandModalStyles from "./command-modal.module.css";
import modalStyles from "./modal.module.css";

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
      className={commandModalStyles.overlay}
      data-command-modal-overlay
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Example for: ${title}`}
    >
      <div
        className={commandModalStyles.modal}
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" className={modalStyles.dismiss} onClick={onClose} aria-label="Close">✕</button>
        <p className={commandModalStyles.label}>EXAMPLE</p>
        <h3 className={commandModalStyles.title}>{title}</h3>

        <div className={commandModalStyles.section}>
          <p className={commandModalStyles.sectionLabel}>Command</p>
          <p className={commandModalStyles.terminal}>{command}</p>
        </div>

        <div className={commandModalStyles.section}>
          <p className={commandModalStyles.sectionLabel}>Example</p>
          <p className={`${commandModalStyles.terminal} ${commandModalStyles.example}`}>{example}</p>
        </div>

        <button type="button" className={commandModalStyles.closeButton} onClick={onClose}>
          Close <kbd>Esc</kbd>
        </button>
      </div>
    </div>,
    document.body
  );
}
