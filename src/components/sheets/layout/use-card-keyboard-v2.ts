"use client";

/**
 * Keyboard interactions for layout cards.
 *
 * NOTE: this hook is intentionally inert pending step 5b, which will
 * re-implement keyboard control on top of the new engine with Zellij-like
 * modal navigation (master key Ctrl+M, sub-modes n/m/r). For now we expose
 * the same shape consumed by sheet-renderer so the UI keeps compiling, but
 * no keystrokes are intercepted.
 *
 * See docs/layout-actions.md for the planned keyboard model.
 */

import { useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { LayoutBlock } from "@/lib/layout/engine";

export type CardFocusV2 = {
  blockId: string;
};

export type UseCardKeyboardV2Result = {
  focusedCard: CardFocusV2 | null;
  setFocusedCard: Dispatch<SetStateAction<CardFocusV2 | null>>;
  isManipulating: boolean;
};

type UseCardKeyboardV2Options = {
  blocks: LayoutBlock[];
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function useCardKeyboardV2(_options: UseCardKeyboardV2Options): UseCardKeyboardV2Result {
  const [focusedCard, setFocusedCard] = useState<CardFocusV2 | null>(null);
  return {
    focusedCard,
    setFocusedCard,
    isManipulating: false,
  };
}
