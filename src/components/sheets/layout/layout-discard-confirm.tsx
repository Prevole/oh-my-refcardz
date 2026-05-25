"use client";

import { useCallback, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { ActionInlineBinding } from "@/components/settings/keybinding-display";
import { useKeybindings } from "@/hooks/use-keybindings";
import { useKeyboardScope, useScopedKeyboardHandler } from "@/hooks/use-keyboard-context";
import { ACTION_IDS } from "@/lib/keybindings";
import styles from "./layout-discard-confirm.module.css";

type LayoutDiscardConfirmProps = {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

// Confirmation modal shown when the user requests an exit from the
// buffered layout mode while at least 5 staged changes are pending
// (see `.opencode/plans/layout-v3-fa-buffered-mode.md`, FA5). The
// modal is intentionally body-text only — it does not display the
// pending change count because the buffer is private to the keyboard
// session and the count adds no actionable information.
export function LayoutDiscardConfirm({ open, onConfirm, onCancel }: LayoutDiscardConfirmProps) {
  const { matchesAction } = useKeybindings();
  useKeyboardScope("layout-discard-confirm", open, { modal: true });
  const discardButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) {
      discardButtonRef.current?.focus();
    }
  }, [open]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (matchesAction(e, ACTION_IDS.LAYOUT_DISCARD_CONFIRM)) {
        e.preventDefault();
        e.stopImmediatePropagation();
        onConfirm();
        return;
      }
      if (matchesAction(e, ACTION_IDS.LAYOUT_DISCARD_CANCEL)) {
        e.preventDefault();
        e.stopImmediatePropagation();
        onCancel();
      }
    },
    [matchesAction, onConfirm, onCancel],
  );

  useScopedKeyboardHandler("layout-discard-confirm", handleKeyDown, [handleKeyDown]);

  if (!open) return null;

  return createPortal(
    <div
      className={styles.overlay}
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      aria-labelledby="layout-discard-confirm-title"
      data-testid="layout-discard-confirm-overlay"
    >
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h3 id="layout-discard-confirm-title" className={styles.title}>
          Discard layout changes?
        </h3>
        <p className={styles.body}>
          All changes made so far will be lost.
        </p>
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.cancelButton}
            onClick={onCancel}
            data-testid="layout-discard-confirm-cancel"
          >
            Keep editing{" "}
            <kbd>
              <ActionInlineBinding actionId={ACTION_IDS.LAYOUT_DISCARD_CANCEL} maxCombos={1} />
            </kbd>
          </button>
          <button
            ref={discardButtonRef}
            type="button"
            className={styles.discardButton}
            onClick={onConfirm}
            data-testid="layout-discard-confirm-discard"
          >
            Discard{" "}
            <kbd>
              <ActionInlineBinding actionId={ACTION_IDS.LAYOUT_DISCARD_CONFIRM} maxCombos={1} />
            </kbd>
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
