"use client";

import { useCallback, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { ActionInlineBinding } from "@/components/settings/keybinding-display";
import { useAction } from "@/hooks/use-action";
import { useKeyboardScope } from "@/hooks/use-keyboard-context";
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
  useKeyboardScope("layout-discard-confirm", open, { modal: true });
  const discardButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) {
      discardButtonRef.current?.focus();
    }
  }, [open]);

  // Bind the two modal actions through the central registry/dispatcher
  // so they participate in scope cascade and modality. Handlers must
  // stay no-ops while the modal is closed because actions stay bound
  // for the component's lifetime; the cascade will skip them as soon
  // as the `layout-discard-confirm` scope leaves the active stack.
  const handleConfirmAction = useCallback(() => {
    if (!open) return;
    onConfirm();
  }, [open, onConfirm]);

  const handleCancelAction = useCallback(() => {
    if (!open) return;
    onCancel();
  }, [open, onCancel]);

  useAction(
    ACTION_IDS.LAYOUT_DISCARD_CONFIRM,
    "layout-discard-confirm",
    handleConfirmAction,
  );
  useAction(
    ACTION_IDS.LAYOUT_DISCARD_CANCEL,
    "layout-discard-confirm",
    handleCancelAction,
  );

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
