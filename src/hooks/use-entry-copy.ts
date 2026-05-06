"use client";

import { useEffect, useCallback } from "react";
import { useKeyboardContext } from "./use-keyboard-context";
import { useKeybindings } from "./use-keybindings";
import { ACTION_IDS } from "@/lib/keybindings";

type UseEntryCopyOptions = {
  modalOpen: boolean;
};

export function useEntryCopy({ modalOpen }: UseEntryCopyOptions) {
  const { isScopeActive } = useKeyboardContext();
  const { matchesAction } = useKeybindings();

  const copyFocusedEntry = useCallback(async () => {
    const focused = document.querySelector<HTMLElement>("[data-nav-focused='true']");
    if (!focused) return false;

    const copyable = focused.querySelector<HTMLElement>("[data-copyable]");
    if (!copyable) return false;

    const value = copyable.dataset.copyable;
    if (!value) return false;

    await navigator.clipboard.writeText(value);

    copyable.dataset.copied = "true";
    setTimeout(() => {
      delete copyable.dataset.copied;
    }, 1500);

    return true;
  }, []);

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
