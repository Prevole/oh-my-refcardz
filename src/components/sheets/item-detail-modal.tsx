"use client";

import { useEffect, useRef, useCallback, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { useRegisterModalOpen } from "@/components/sheets/sheet-commands-shell";
import { EntryRenderer } from "@/components/sheets/entry-renderers";
import { useKeybindings } from "@/hooks/use-keybindings";
import { ACTION_IDS } from "@/lib/keybindings";
import { hasPlaceholders } from "@/lib/placeholder-parser";
import type { CheatSheetEntry } from "@/lib/yaml-cheatsheets";
import sheetCommandStyles from "./sheet-commands.module.css";
import dialogStyles from "@/components/ui/modal.module.css";

type ItemDetailModalProps = {
  title: string;
  detailedEntries: CheatSheetEntry[];
  accentColor: string | null;
  onClose: () => void;
  onCopyWithPlaceholders?: (command: string) => void;
};

export function ItemDetailModal({
  title,
  detailedEntries,
  accentColor,
  onClose,
  onCopyWithPlaceholders,
}: ItemDetailModalProps) {
  const registerModalOpen = useRegisterModalOpen();
  const { matchesAction } = useKeybindings();
  const contentRef = useRef<HTMLDivElement>(null);
  const focusedIndexRef = useRef<number>(-1);

  useEffect(() => {
    const unregister = registerModalOpen();
    return unregister;
  }, [registerModalOpen]);

  const getItems = useCallback(() => {
    if (!contentRef.current) return [];
    return Array.from(contentRef.current.querySelectorAll<HTMLElement>("[data-copyable]"));
  }, []);

  const setFocused = useCallback((index: number) => {
    const items = getItems();
    items.forEach((item, i) => {
      item.dataset.navFocused = i === index ? "true" : "false";
    });
    if (index >= 0 && index < items.length) {
      focusedIndexRef.current = index;
      items[index].scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [getItems]);

  const move = useCallback((direction: "up" | "down") => {
    const items = getItems();
    if (items.length === 0) return;

    let currentIndex = focusedIndexRef.current;
    if (currentIndex < 0 || currentIndex >= items.length) {
      currentIndex = direction === "down" ? -1 : items.length;
    }

    const newIndex = direction === "down"
      ? Math.min(currentIndex + 1, items.length - 1)
      : Math.max(currentIndex - 1, 0);

    setFocused(newIndex);
  }, [getItems, setFocused]);

  const copyFocused = useCallback(async () => {
    const items = getItems();
    const index = focusedIndexRef.current;
    if (index < 0 || index >= items.length) return;

    const item = items[index];
    const value = item.dataset.copyable;
    if (!value) return;

    if (hasPlaceholders(value) && onCopyWithPlaceholders) {
      onCopyWithPlaceholders(value);
      return;
    }

    await navigator.clipboard.writeText(value);
    item.dataset.copied = "true";
    setTimeout(() => {
      delete item.dataset.copied;
    }, 1500);
  }, [getItems, onCopyWithPlaceholders]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }

      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return;

      if (matchesAction(e, ACTION_IDS.MOVE_UP)) {
        e.preventDefault();
        move("up");
      } else if (matchesAction(e, ACTION_IDS.MOVE_DOWN)) {
        e.preventDefault();
        move("down");
      } else if (matchesAction(e, ACTION_IDS.COPY_COMMAND)) {
        e.preventDefault();
        copyFocused();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, matchesAction, move, copyFocused]);

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

        <div ref={contentRef} className={sheetCommandStyles.modalEntries}>
          {detailedEntries.map((entry, index) => (
            <EntryRenderer key={index} entry={entry} hasAliases={hasAliases} />
          ))}
        </div>

        <p className={sheetCommandStyles.modalFooter}>
          <span className={sheetCommandStyles.modalFooterBinding}>j/k</span> navigate,{" "}
          <span className={sheetCommandStyles.modalFooterBinding}>y</span> copy,{" "}
          <span className={sheetCommandStyles.modalFooterBinding}>Esc</span> close.
        </p>
      </div>
    </div>,
    document.body
  );
}
