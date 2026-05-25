"use client";

import type { ReactNode } from "react";
import { ActionInlineBinding } from "@/components/settings/keybinding-display";
import { ACTION_IDS } from "@/lib/keybindings";

/**
 * Shared visual style for all inline key/keybinding hints rendered inside
 * running text. Single source of truth so the dashed amber underline stays
 * consistent across the app (modals, settings, dev bar, contextual help).
 */
const INLINE_KEY_CLASS =
  "underline decoration-dashed underline-offset-3 text-[#f8c94a]";

/**
 * Free-text inline key hint. Use this when you want to render a literal
 * word such as `Click`, `Shift`, `Esc`, or any key label that is not tied
 * to a configurable action.
 *
 * For configurable actions, prefer `<InlineKeybinding actionId={...} />`,
 * which resolves the user's current binding.
 */
export function InlineKey({ children }: { children: ReactNode }) {
  return <span className={INLINE_KEY_CLASS}>{children}</span>;
}

type InlineKeybindingProps = {
  actionId: (typeof ACTION_IDS)[keyof typeof ACTION_IDS];
  maxCombos?: number;
};

/**
 * Action-aware inline binding. Resolves the user's configured keybinding
 * for `actionId` and renders it with the shared inline style.
 *
 * For full sentence-style inline help that adapts to the active keyboard
 * scope, use `<ContextualInlineHelp />` instead.
 */
export function InlineKeybinding({ actionId, maxCombos = 1 }: InlineKeybindingProps) {
  return (
    <ActionInlineBinding
      actionId={actionId}
      maxCombos={maxCombos}
      className={INLINE_KEY_CLASS}
      separatorClassName="mx-1 text-white/40"
    />
  );
}
