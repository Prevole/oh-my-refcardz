"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { useRegisterModalOpen } from "@/components/sheet-commands-shell";

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
      className="command-modal-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Example for: ${title}`}
    >
      <div
        className="command-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="command-modal-label">EXAMPLE</p>
        <h3 className="command-modal-title">{title}</h3>

        <div className="command-modal-section">
          <p className="command-modal-section-label">Command</p>
          <p className="sheet-terminal">{command}</p>
        </div>

        <div className="command-modal-section">
          <p className="command-modal-section-label">Example</p>
          <p className="sheet-terminal command-modal-example">{example}</p>
        </div>

        <button type="button" className="command-modal-close" onClick={onClose}>
          Close <kbd>Esc</kbd>
        </button>
      </div>
    </div>,
    document.body
  );
}
