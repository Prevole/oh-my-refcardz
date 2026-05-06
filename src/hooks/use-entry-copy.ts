"use client";

import { useEffect, useCallback } from "react";
import { useKeyboardContext } from "./use-keyboard-context";
import { useKeybindings } from "./use-keybindings";
import { ACTION_IDS } from "@/lib/keybindings";
import { hasPlaceholders } from "@/lib/placeholder-parser";

type UseEntryCopyOptions = {
  modalOpen: boolean;
  onCopyWithPlaceholders?: (command: string) => void;
};

export function useEntryCopy({ modalOpen, onCopyWithPlaceholders }: UseEntryCopyOptions) {
  const { isScopeActive } = useKeyboardContext();
  const { matchesAction } = useKeybindings();

  const copyFocusedEntry = useCallback(async () => {
    const focused = document.querySelector<HTMLElement>("[data-nav-focused='true'][data-copyable]");
    if (!focused) return false;

    const value = focused.dataset.copyable;
    if (!value) return false;

    if (hasPlaceholders(value) && onCopyWithPlaceholders) {
      onCopyWithPlaceholders(value);
      return true;
    }

    await navigator.clipboard.writeText(value);

    focused.dataset.copied = "true";
    setTimeout(() => {
      delete focused.dataset.copied;
    }, 1500);

    return true;
  }, [onCopyWithPlaceholders]);

  useEffect(() => {
    const onKeyDown = async (e: KeyboardEvent) => {
      if (!isScopeActive("global")) return;
      if (modalOpen) return;

      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return;

      if (matchesAction(e, ACTION_IDS.COPY_COMMAND)) {
        e.preventDefault();
        await copyFocusedEntry();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [modalOpen, isScopeActive, matchesAction, copyFocusedEntry]);
}
