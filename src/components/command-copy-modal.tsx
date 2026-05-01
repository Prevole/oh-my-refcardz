"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRegisterModalOpen } from "@/components/sheet-commands-shell";
import commandModalStyles from "./command-modal.module.css";
import modalStyles from "./modal.module.css";

type CommandCopyModalProps = {
  title: string;
  command: string;
  placeholders: string[];
  onClose: () => void;
};

export function CommandCopyModal({ title, command, placeholders, onClose }: CommandCopyModalProps) {
  const registerModalOpen = useRegisterModalOpen();
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(placeholders.map((p) => [p, ""]))
  );
  const [copied, setCopied] = useState(false);
  const firstInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const unregister = registerModalOpen();
    return unregister;
  }, [registerModalOpen]);

  useEffect(() => {
    firstInputRef.current?.focus();
  }, []);

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

  function buildCommand() {
    let result = command;
    for (const [key, val] of Object.entries(values)) {
      result = result.replaceAll(`<${key}>`, val || `<${key}>`);
    }
    return result;
  }

  async function handleCopy() {
    const resolved = buildCommand();
    await navigator.clipboard.writeText(resolved);
    setCopied(true);
    setTimeout(() => {
      setCopied(false);
      onClose();
    }, 900);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    handleCopy();
  }

  const preview = buildCommand();

  return createPortal(
    <div
      className={commandModalStyles.overlay}
      data-command-modal-overlay
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Copy command: ${title}`}
    >
      <div className={commandModalStyles.modal} onClick={(e) => e.stopPropagation()}>
        <button type="button" className={modalStyles.dismiss} onClick={onClose} aria-label="Close">✕</button>
        <p className={commandModalStyles.label}>COPY WITH PLACEHOLDERS</p>
        <h3 className={commandModalStyles.title}>{title}</h3>

        <form onSubmit={handleSubmit} className={commandModalStyles.form}>
          {placeholders.map((placeholder, index) => (
            <div key={placeholder} className={commandModalStyles.field}>
              <label className={commandModalStyles.fieldLabel} htmlFor={`placeholder-${placeholder}`}>
                {`<${placeholder}>`}
              </label>
              <input
                ref={index === 0 ? firstInputRef : undefined}
                id={`placeholder-${placeholder}`}
                type="text"
                className={commandModalStyles.input}
                placeholder={placeholder}
                value={values[placeholder]}
                onChange={(e) => setValues((prev) => ({ ...prev, [placeholder]: e.target.value }))}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
              />
            </div>
          ))}

          <div className={commandModalStyles.previewWrap}>
            <p className={commandModalStyles.sectionLabel}>Preview</p>
            <p className={`${commandModalStyles.terminal} ${commandModalStyles.preview}`}>{preview}</p>
          </div>

          <div className={commandModalStyles.actions}>
            <button type="button" className={commandModalStyles.closeButton} onClick={onClose}>
              Cancel <kbd>Esc</kbd>
            </button>
            <button type="submit" className={commandModalStyles.submitButton}>
              {copied ? "Copied!" : "Copy"}
              {!copied && <kbd>↩</kbd>}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
