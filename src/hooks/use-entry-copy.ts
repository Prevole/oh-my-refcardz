"use client";

import { useEffect, useCallback } from "react";
import { useKeyboardContext } from "./use-keyboard-context";
import { useKeybindings } from "./use-keybindings";
import { ACTION_IDS } from "@/lib/keybindings";
import { hasPlaceholders } from "@/lib/placeholder-parser";
import { getCopyablePayload, type CopyablePayload } from "@/components/sheets/copyable";

type UseEntryCopyOptions = {
  modalOpen: boolean;
  onCopyWithPlaceholders?: (payload: CopyablePayload) => void;
};

export function useEntryCopy({ modalOpen, onCopyWithPlaceholders }: UseEntryCopyOptions) {
  const { isScopeActive } = useKeyboardContext();
  const { matchesAction } = useKeybindings();

  const copyValue = useCallback(
    async (value: string, element: HTMLElement) => {
      if (hasPlaceholders(value) && onCopyWithPlaceholders) {
        const payload = getCopyablePayload(element);
        if (payload) {
          onCopyWithPlaceholders(payload);
        }
        return true;
      }

      await navigator.clipboard.writeText(value);

      element.dataset.copied = "true";
      setTimeout(() => {
        delete element.dataset.copied;
      }, 1500);

      return true;
    },
    [onCopyWithPlaceholders]
  );

  const copyFocused = useCallback(async () => {
    // First check if a copyable is focused
    const focusedCopyable = document.querySelector<HTMLElement>("[data-copyable][data-nav-focused='true']");
    if (focusedCopyable) {
      const payload = getCopyablePayload(focusedCopyable);
      if (payload) {
        return copyValue(payload.value, focusedCopyable);
      }
      return false;
    }

    // If an item is focused, copy its first copyable
    const focusedItem = document.querySelector<HTMLElement>("[data-item][data-nav-focused='true']");
    if (focusedItem) {
      const firstCopyable = focusedItem.querySelector<HTMLElement>("[data-copyable]");
      if (firstCopyable) {
        const payload = getCopyablePayload(firstCopyable);
        if (payload) {
          return copyValue(payload.value, firstCopyable);
        }
      }
    }

    return false;
  }, [copyValue]);

  useEffect(() => {
    const onKeyDown = async (e: KeyboardEvent) => {
      if (!isScopeActive("sheet")) return;
      if (modalOpen) return;

      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return;

      if (matchesAction(e, ACTION_IDS.COPY_COMMAND)) {
        e.preventDefault();
        await copyFocused();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [modalOpen, isScopeActive, matchesAction, copyFocused]);
}
