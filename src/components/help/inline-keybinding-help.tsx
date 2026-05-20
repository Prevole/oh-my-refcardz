"use client";

import { ActionInlineBinding } from "@/components/settings/keybinding-display";
import { ACTION_IDS } from "@/lib/keybindings";

type InlineKeybindingProps = {
  actionId: (typeof ACTION_IDS)[keyof typeof ACTION_IDS];
  maxCombos?: number;
};

/**
 * Single-binding inline display used inside running text (e.g. the
 * dev-mode toolbar, or as a building block inside `ContextualInlineHelp`).
 *
 * For full sentence-style inline help that adapts to the active keyboard
 * scope, use `<ContextualInlineHelp />` instead.
 */
export function InlineKeybinding({ actionId, maxCombos = 1 }: InlineKeybindingProps) {
  return (
    <ActionInlineBinding
      actionId={actionId}
      maxCombos={maxCombos}
      className="underline decoration-dashed underline-offset-3 text-[#f8c94a]"
      separatorClassName="mx-1 text-white/40"
    />
  );
}
