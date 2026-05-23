"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { useRegisterModalOpen } from "@/components/sheets/sheet-commands-shell";
import { InlineCodeText } from "@/components/sheets/inline-code-text";
import { useKeybindings } from "@/hooks/use-keybindings";
import { useKeyboardScope } from "@/hooks/use-keyboard-context";
import { ACTION_IDS, matchesCombo } from "@/lib/keybindings";
import {
  parsePlaceholders,
  buildCommand,
  type Placeholder,
} from "@/lib/placeholder-parser";
import sheetCommandStyles from "./sheet-commands.module.css";
import dialogStyles from "@/components/ui/modal.module.css";

type CommandCopyModalProps = {
  title: string;
  value: string;
  previewPrefix?: string;
  accentColor: string | null;
  onClose: () => void;
};

export function CommandCopyModal({ title, value, previewPrefix = "", accentColor, onClose }: CommandCopyModalProps) {
  const registerModalOpen = useRegisterModalOpen();
  const { getAction } = useKeybindings();
  useKeyboardScope("modal", true, { modal: true });
  const firstInputRef = useRef<HTMLInputElement>(null);
  const placeholders = parsePlaceholders(value);
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(placeholders.map((p) => [p.raw, ""]))
  );
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const unregister = registerModalOpen();
    return unregister;
  }, [registerModalOpen]);

  useEffect(() => {
    firstInputRef.current?.focus();
  }, []);

  useEffect(() => {
    function moveFocus(direction: "up" | "down") {
      const root = firstInputRef.current?.form;
      const inputs = root
        ? Array.from(root.querySelectorAll<HTMLInputElement>("[data-copy-modal-input='true']"))
        : [];
      if (inputs.length === 0) {
        return;
      }

      const currentIndex = inputs.findIndex((input) => input === document.activeElement);
      if (currentIndex === -1) {
        inputs[0]?.focus();
        return;
      }

      const nextIndex = direction === "down"
        ? Math.min(currentIndex + 1, inputs.length - 1)
        : Math.max(currentIndex - 1, 0);

      inputs[nextIndex]?.focus();
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopImmediatePropagation();
        onClose();
        return;
      }

      const moveUpAction = getAction(ACTION_IDS.MODAL_MOVE_UP);
      if (moveUpAction && moveUpAction.combos[0] && matchesCombo(e, moveUpAction.combos[0])) {
        e.preventDefault();
        e.stopImmediatePropagation();
        moveFocus("up");
        return;
      }

      const moveDownAction = getAction(ACTION_IDS.MODAL_MOVE_DOWN);
      if (moveDownAction && moveDownAction.combos[0] && matchesCombo(e, moveDownAction.combos[0])) {
        e.preventDefault();
        e.stopImmediatePropagation();
        moveFocus("down");
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [getAction, onClose]);

  async function handleCopy() {
    const resolved = buildCommand(value, values);
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

  const preview = `${previewPrefix}${buildCommand(value, values)}`;

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
        aria-label={`Copy value: ${title}`}
    >
      <div className={sheetCommandStyles.modal} onClick={(e) => e.stopPropagation()}>
        <button type="button" className={dialogStyles.dismiss} onClick={onClose} aria-label="Close">✕</button>
        <h3 className={sheetCommandStyles.modalTitle}><InlineCodeText text={title} /></h3>

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
            <pre className={`${sheetCommandStyles.modalTerminal} ${sheetCommandStyles.modalPreview} ${copied ? sheetCommandStyles.modalPreviewCopied : ""}`}>{preview}</pre>
          </div>

          <div className={sheetCommandStyles.modalActions}>
            <button type="button" className={sheetCommandStyles.modalCloseButton} onClick={onClose}>
              Cancel <kbd>Esc</kbd>
            </button>
            <button type="submit" className={`${sheetCommandStyles.modalSubmitButton} ${copied ? sheetCommandStyles.modalSubmitButtonCopied : ""}`}>
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
        data-copy-modal-input="true"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
      />
    </div>
  );
}
