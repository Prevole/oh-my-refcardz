"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { useKeyboardContext } from "@/hooks/use-keyboard-context";
import { useKeybindings } from "@/hooks/use-keybindings";
import { ACTION_IDS } from "@/lib/keybindings";
import { GRID_COLUMNS } from "../sheet-grid";
import { getBlockConstraints } from "./block-types";
import { clamp, resolveBlockLayout } from "./layout-algorithms";
import { getAllCards, findCardInDirection, findFirstCard, validateFocus, type CardFocus } from "./card-navigation";
import type { BlockLayoutState } from "./layout-types";

export type { CardFocus } from "./card-navigation";

export type UseCardKeyboardResult = {
  focusedCard: CardFocus | null;
  setFocusedCard: Dispatch<SetStateAction<CardFocus | null>>;
  isManipulating: boolean;
};

type UseCardKeyboardOptions = {
  blockLayouts: BlockLayoutState[];
  setBlockLayouts: Dispatch<SetStateAction<BlockLayoutState[]>>;
};

export function useCardKeyboard({ blockLayouts, setBlockLayouts }: UseCardKeyboardOptions): UseCardKeyboardResult {
  const { isScopeActive, pushScope, popScope } = useKeyboardContext();
  const { matchesAction } = useKeybindings();

  const [rawFocusedCard, setRawFocusedCard] = useState<CardFocus | null>(null);
  const [isManipulating, setIsManipulating] = useState(false);
  const manipulationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scopePushedRef = useRef(false);

  const focusedCard = validateFocus(rawFocusedCard, blockLayouts);

  const setFocusedCard: Dispatch<SetStateAction<CardFocus | null>> = useCallback((action) => {
    setRawFocusedCard(action);
  }, []);

  useEffect(() => {
    if (focusedCard && !scopePushedRef.current) {
      pushScope("sheet-layout");
      scopePushedRef.current = true;
    } else if (!focusedCard && scopePushedRef.current) {
      popScope("sheet-layout");
      scopePushedRef.current = false;
    }

    return () => {
      if (scopePushedRef.current) {
        popScope("sheet-layout");
        scopePushedRef.current = false;
      }
    };
  }, [focusedCard, popScope, pushScope]);

  useEffect(() => {
    if (!focusedCard) return;

    const card = document.querySelector<HTMLElement>(
      `[data-layout-card="true"][data-layout-block-id="${focusedCard.blockId}"]`
    );

    if (!card) return;

    card.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
  }, [focusedCard, blockLayouts]);

  const handleNavigation = useCallback(
    (direction: "up" | "down" | "left" | "right") => {
      const validFocus = validateFocus(rawFocusedCard, blockLayouts);

      if (!validFocus) {
        const first = findFirstCard(blockLayouts);
        if (first) setRawFocusedCard(first);
        return;
      }

      const allCards = getAllCards(blockLayouts);
      const current = allCards.find((card) => card.blockId === validFocus.blockId);
      if (!current) return;

      const target = findCardInDirection(allCards, current, direction);
      if (target) {
        setRawFocusedCard({ blockId: target.blockId });
      }
    },
    [blockLayouts, rawFocusedCard]
  );

  const handleMove = useCallback(
    (direction: "up" | "down" | "left" | "right") => {
      const validFocus = validateFocus(rawFocusedCard, blockLayouts);
      if (!validFocus) return;

      const currentLayout = blockLayouts.find((layout) => layout.id === validFocus.blockId);
      if (!currentLayout) return;

      let nextLayout: BlockLayoutState;
      switch (direction) {
        case "left":
          nextLayout = { ...currentLayout, colStart: Math.max(1, currentLayout.colStart - 1) };
          break;
        case "right":
          nextLayout = {
            ...currentLayout,
            colStart: Math.min(GRID_COLUMNS - currentLayout.colSpan + 1, currentLayout.colStart + 1),
          };
          break;
        case "up":
          nextLayout = { ...currentLayout, rowStart: Math.max(1, currentLayout.rowStart - 1) };
          break;
        case "down":
          nextLayout = { ...currentLayout, rowStart: currentLayout.rowStart + 1 };
          break;
      }

      if (nextLayout.colStart === currentLayout.colStart && nextLayout.rowStart === currentLayout.rowStart) {
        return;
      }

      setBlockLayouts((layouts) => resolveBlockLayout(layouts, validFocus.blockId, nextLayout));
      setIsManipulating(true);
      if (manipulationTimeoutRef.current) clearTimeout(manipulationTimeoutRef.current);
      manipulationTimeoutRef.current = setTimeout(() => setIsManipulating(false), 300);
    },
    [blockLayouts, rawFocusedCard, setBlockLayouts]
  );

  const handleResize = useCallback(
    (direction: "up" | "down" | "left" | "right") => {
      const validFocus = validateFocus(rawFocusedCard, blockLayouts);
      if (!validFocus) return;

      const currentLayout = blockLayouts.find((layout) => layout.id === validFocus.blockId);
      if (!currentLayout) return;

      const constraints = getBlockConstraints(currentLayout.kind);
      const { minColSpan, maxColSpan, minRowSpan, maxRowSpan } = constraints;

      let nextLayout: BlockLayoutState;
      switch (direction) {
        case "left":
          nextLayout = { ...currentLayout, colSpan: clamp(currentLayout.colSpan - 1, minColSpan, maxColSpan) };
          break;
        case "right":
          nextLayout = { ...currentLayout, colSpan: clamp(currentLayout.colSpan + 1, minColSpan, maxColSpan) };
          if (nextLayout.colStart + nextLayout.colSpan - 1 > GRID_COLUMNS) {
            nextLayout.colStart = GRID_COLUMNS - nextLayout.colSpan + 1;
          }
          break;
        case "up":
          nextLayout = { ...currentLayout, rowSpan: clamp(currentLayout.rowSpan - 1, minRowSpan, maxRowSpan) };
          break;
        case "down":
          nextLayout = { ...currentLayout, rowSpan: clamp(currentLayout.rowSpan + 1, minRowSpan, maxRowSpan) };
          break;
      }

      if (
        nextLayout.colSpan === currentLayout.colSpan &&
        nextLayout.rowSpan === currentLayout.rowSpan &&
        nextLayout.colStart === currentLayout.colStart
      ) {
        return;
      }

      setBlockLayouts((layouts) => resolveBlockLayout(layouts, validFocus.blockId, nextLayout));
      setIsManipulating(true);
      if (manipulationTimeoutRef.current) clearTimeout(manipulationTimeoutRef.current);
      manipulationTimeoutRef.current = setTimeout(() => setIsManipulating(false), 300);
    },
    [blockLayouts, rawFocusedCard, setBlockLayouts]
  );

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const layoutScopeActive = isScopeActive("sheet-layout");
      const globalScopeActive = isScopeActive("global");

      if (!layoutScopeActive && !globalScopeActive) return;
      if (!layoutScopeActive && !rawFocusedCard && !event.shiftKey && !event.altKey) return;

      const tag = (event.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return;

      if (matchesAction(event, ACTION_IDS.CARD_NAV_LEFT)) {
        event.preventDefault();
        handleNavigation("left");
        return;
      }
      if (matchesAction(event, ACTION_IDS.CARD_NAV_RIGHT)) {
        event.preventDefault();
        handleNavigation("right");
        return;
      }
      if (matchesAction(event, ACTION_IDS.CARD_NAV_UP)) {
        event.preventDefault();
        handleNavigation("up");
        return;
      }
      if (matchesAction(event, ACTION_IDS.CARD_NAV_DOWN)) {
        event.preventDefault();
        handleNavigation("down");
        return;
      }

      const validFocus = validateFocus(rawFocusedCard, blockLayouts);
      if (!validFocus) return;

      if (matchesAction(event, ACTION_IDS.CARD_CLEAR_FOCUS)) {
        event.preventDefault();
        event.stopImmediatePropagation();
        setRawFocusedCard(null);
        setIsManipulating(false);
        return;
      }

      if (matchesAction(event, ACTION_IDS.CARD_MOVE_LEFT)) {
        event.preventDefault();
        handleMove("left");
        return;
      }
      if (matchesAction(event, ACTION_IDS.CARD_MOVE_RIGHT)) {
        event.preventDefault();
        handleMove("right");
        return;
      }
      if (matchesAction(event, ACTION_IDS.CARD_MOVE_UP)) {
        event.preventDefault();
        handleMove("up");
        return;
      }
      if (matchesAction(event, ACTION_IDS.CARD_MOVE_DOWN)) {
        event.preventDefault();
        handleMove("down");
        return;
      }

      if (matchesAction(event, ACTION_IDS.CARD_SHRINK_WIDTH)) {
        event.preventDefault();
        handleResize("left");
        return;
      }
      if (matchesAction(event, ACTION_IDS.CARD_GROW_WIDTH)) {
        event.preventDefault();
        handleResize("right");
        return;
      }
      if (matchesAction(event, ACTION_IDS.CARD_SHRINK_HEIGHT)) {
        event.preventDefault();
        handleResize("up");
        return;
      }
      if (matchesAction(event, ACTION_IDS.CARD_GROW_HEIGHT)) {
        event.preventDefault();
        handleResize("down");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [blockLayouts, handleMove, handleNavigation, handleResize, isScopeActive, matchesAction, rawFocusedCard]);

  useEffect(() => {
    return () => {
      if (manipulationTimeoutRef.current) {
        clearTimeout(manipulationTimeoutRef.current);
      }
    };
  }, []);

  return {
    focusedCard,
    setFocusedCard,
    isManipulating,
  };
}
