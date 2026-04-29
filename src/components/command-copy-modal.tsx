"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRegisterModalOpen } from "@/components/sheet-commands-shell";

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
      className="command-modal-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Copy command: ${title}`}
    >
      <div className="command-modal" onClick={(e) => e.stopPropagation()}>
        <p className="command-modal-label">COPY WITH PLACEHOLDERS</p>
        <h3 className="command-modal-title">{title}</h3>

        <form onSubmit={handleSubmit} className="command-copy-form">
          {placeholders.map((placeholder, index) => (
            <div key={placeholder} className="command-copy-field">
              <label className="command-copy-label" htmlFor={`placeholder-${placeholder}`}>
                {`<${placeholder}>`}
              </label>
              <input
                ref={index === 0 ? firstInputRef : undefined}
                id={`placeholder-${placeholder}`}
                type="text"
                className="command-copy-input"
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

          <div className="command-copy-preview-wrap">
            <p className="command-modal-section-label">Preview</p>
            <p className="sheet-terminal command-copy-preview">{preview}</p>
          </div>

          <div className="command-copy-actions">
            <button type="button" className="command-modal-close" onClick={onClose}>
              Cancel <kbd>Esc</kbd>
            </button>
            <button type="submit" className="command-copy-submit">
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
