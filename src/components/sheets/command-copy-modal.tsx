"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { useRegisterModalOpen } from "@/components/sheets/sheet-commands-shell";
import {
  parsePlaceholders,
  buildCommand,
  type Placeholder,
} from "@/lib/placeholder-parser";
import sheetCommandStyles from "./sheet-commands.module.css";
import dialogStyles from "@/components/ui/modal.module.css";

type CommandCopyModalProps = {
  title: string;
  command: string;
  accentColor: string | null;
  onClose: () => void;
};

export function CommandCopyModal({ title, command, accentColor, onClose }: CommandCopyModalProps) {
  const registerModalOpen = useRegisterModalOpen();
  const placeholders = parsePlaceholders(command);
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(placeholders.map((p) => [p.raw, ""]))
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

  async function handleCopy() {
    const resolved = buildCommand(command, values);
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

  const preview = `$ ${buildCommand(command, values)}`;

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
      aria-label={`Copy command: ${title}`}
    >
      <div className={sheetCommandStyles.modal} onClick={(e) => e.stopPropagation()}>
        <button type="button" className={dialogStyles.dismiss} onClick={onClose} aria-label="Close">✕</button>
        <h3 className={sheetCommandStyles.modalTitle}>{title}</h3>

        <form onSubmit={handleSubmit} className={sheetCommandStyles.modalForm}>
          {placeholders.map((placeholder, index) => (
            <PlaceholderInput
              key={placeholder.raw}
              placeholder={placeholder}
              value={values[placeholder.raw]}
              onChange={(val) => setValues((prev) => ({ ...prev, [placeholder.raw]: val }))}
              inputRef={index === 0 ? firstInputRef : undefined}
            />
          ))}

          <div className={sheetCommandStyles.modalPreviewWrap}>
            <p className={sheetCommandStyles.modalSectionLabel}>Preview</p>
            <p className={`${sheetCommandStyles.modalTerminal} ${sheetCommandStyles.modalPreview}`}>{preview}</p>
          </div>

          <div className={sheetCommandStyles.modalActions}>
            <button type="button" className={sheetCommandStyles.modalCloseButton} onClick={onClose}>
              Cancel <kbd>Esc</kbd>
            </button>
            <button type="submit" className={sheetCommandStyles.modalSubmitButton}>
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

type PlaceholderInputProps = {
  placeholder: Placeholder;
  value: string;
  onChange: (value: string) => void;
  inputRef?: React.RefObject<HTMLInputElement | null>;
};

function PlaceholderInput({ placeholder, value, onChange, inputRef }: PlaceholderInputProps) {
  const isInt = placeholder.type === "int";

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const newValue = e.target.value;
    if (isInt && newValue !== "" && !/^\d+$/.test(newValue)) {
      return;
    }
    onChange(newValue);
  }

  return (
    <div className={sheetCommandStyles.modalField}>
      <label className={sheetCommandStyles.modalFieldLabel} htmlFor={`placeholder-${placeholder.raw}`}>
        {`<${placeholder.name}>`}
      </label>
      <input
        ref={inputRef}
        id={`placeholder-${placeholder.raw}`}
        type="text"
        inputMode={isInt ? "numeric" : "text"}
        className={sheetCommandStyles.modalInput}
        placeholder={placeholder.name}
        value={value}
        onChange={handleChange}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
      />
    </div>
  );
}
