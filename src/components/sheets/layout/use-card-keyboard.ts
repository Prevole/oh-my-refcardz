"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { useKeyboardContext } from "@/hooks/use-keyboard-context";
import { useKeybindings } from "@/hooks/use-keybindings";
import { ACTION_IDS } from "@/lib/keybindings";
import { GRID_COLUMNS } from "../sheet-grid";
import { clamp, resolveSectionLayout } from "./layout-algorithms";
import {
  getAllCards,
  findCardInDirection,
  findFirstCard,
  validateFocus,
  type CardFocus,
} from "./card-navigation";
import type { CardLayoutState, SectionLayoutState } from "./layout-types";
import { MAX_ROW_SPAN } from "./layout-types";

export type { CardFocus } from "./card-navigation";

export type UseCardKeyboardResult = {
  focusedCard: CardFocus | null;
  setFocusedCard: Dispatch<SetStateAction<CardFocus | null>>;
  isManipulating: boolean;
};

type UseCardKeyboardOptions = {
  sectionLayouts: SectionLayoutState[];
  setSectionLayouts: Dispatch<SetStateAction<SectionLayoutState[]>>;
  sectionCount: number;
  getCardCount: (sectionIndex: number) => number;
};

export function useCardKeyboard({
  sectionLayouts,
  setSectionLayouts,
  sectionCount,
  getCardCount,
}: UseCardKeyboardOptions): UseCardKeyboardResult {
  const { isScopeActive, pushScope, popScope } = useKeyboardContext();
  const { matchesAction } = useKeybindings();

  const [rawFocusedCard, setRawFocusedCard] = useState<CardFocus | null>(null);
  const [isManipulating, setIsManipulating] = useState(false);
  const manipulationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scopePushedRef = useRef(false);

  const focusedCard = validateFocus(rawFocusedCard, sectionCount, getCardCount);

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
  }, [focusedCard, pushScope, popScope]);

  useEffect(() => {
    if (!focusedCard) return;

    const card = document.querySelector<HTMLElement>(
      `[data-layout-card="true"][data-layout-section-index="${focusedCard.sectionIndex}"][data-layout-card-index="${focusedCard.cardIndex}"]`
    );

    if (!card) return;

    card.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
  }, [focusedCard, sectionLayouts]);

  const handleNavigation = useCallback(
    (direction: "up" | "down" | "left" | "right") => {
      const validFocus = validateFocus(rawFocusedCard, sectionCount, getCardCount);

      if (!validFocus) {
        const first = findFirstCard(sectionLayouts);
        if (first) setRawFocusedCard(first);
        return;
      }

      const allCards = getAllCards(sectionLayouts);
      const current = allCards.find(
        (c) =>
          c.sectionIndex === validFocus.sectionIndex &&
          c.cardIndex === validFocus.cardIndex
      );
      if (!current) return;

      const target = findCardInDirection(allCards, current, direction);
      if (target) {
        setRawFocusedCard({
          sectionIndex: target.sectionIndex,
          cardIndex: target.cardIndex,
        });
      }
    },
    [rawFocusedCard, sectionCount, getCardCount, sectionLayouts]
  );

  const handleMove = useCallback(
    (direction: "up" | "down" | "left" | "right") => {
      const validFocus = validateFocus(rawFocusedCard, sectionCount, getCardCount);
      if (!validFocus) return;

      const { sectionIndex, cardIndex } = validFocus;
      const currentLayout = sectionLayouts[sectionIndex]?.cards[cardIndex];
      if (!currentLayout) return;

      let nextLayout: CardLayoutState;
      switch (direction) {
        case "left":
          nextLayout = {
            ...currentLayout,
            colStart: Math.max(1, currentLayout.colStart - 1),
          };
          break;
        case "right":
          nextLayout = {
            ...currentLayout,
            colStart: Math.min(
              GRID_COLUMNS - currentLayout.colSpan + 1,
              currentLayout.colStart + 1
            ),
          };
          break;
        case "up":
          nextLayout = {
            ...currentLayout,
            rowStart: Math.max(1, currentLayout.rowStart - 1),
          };
          break;
        case "down":
          nextLayout = {
            ...currentLayout,
            rowStart: currentLayout.rowStart + 1,
          };
          break;
      }

      if (
        nextLayout.colStart === currentLayout.colStart &&
        nextLayout.rowStart === currentLayout.rowStart
      ) {
        return;
      }

      setSectionLayouts((layouts) =>
        layouts.map((section, idx) => {
          if (idx !== sectionIndex) return section;
          return {
            cards: resolveSectionLayout(section.cards, cardIndex, nextLayout),
          };
        })
      );

      setIsManipulating(true);
      if (manipulationTimeoutRef.current) {
        clearTimeout(manipulationTimeoutRef.current);
      }
      manipulationTimeoutRef.current = setTimeout(() => {
        setIsManipulating(false);
      }, 300);
    },
    [rawFocusedCard, sectionCount, getCardCount, sectionLayouts, setSectionLayouts]
  );

  const handleResize = useCallback(
    (direction: "up" | "down" | "left" | "right") => {
      const validFocus = validateFocus(rawFocusedCard, sectionCount, getCardCount);
      if (!validFocus) return;

      const { sectionIndex, cardIndex } = validFocus;
      const currentLayout = sectionLayouts[sectionIndex]?.cards[cardIndex];
      if (!currentLayout) return;

      let nextLayout: CardLayoutState;
      switch (direction) {
        case "left":
          nextLayout = {
            ...currentLayout,
            colSpan: clamp(currentLayout.colSpan - 1, 1, GRID_COLUMNS),
          };
          break;
        case "right":
          nextLayout = {
            ...currentLayout,
            colSpan: clamp(currentLayout.colSpan + 1, 1, GRID_COLUMNS),
          };
          if (nextLayout.colStart + nextLayout.colSpan - 1 > GRID_COLUMNS) {
            nextLayout.colStart = GRID_COLUMNS - nextLayout.colSpan + 1;
          }
          break;
        case "up":
          nextLayout = {
            ...currentLayout,
            rowSpan: clamp(currentLayout.rowSpan - 1, 1, MAX_ROW_SPAN),
          };
          break;
        case "down":
          nextLayout = {
            ...currentLayout,
            rowSpan: clamp(currentLayout.rowSpan + 1, 1, MAX_ROW_SPAN),
          };
          break;
      }

      if (
        nextLayout.colSpan === currentLayout.colSpan &&
        nextLayout.rowSpan === currentLayout.rowSpan &&
        nextLayout.colStart === currentLayout.colStart
      ) {
        return;
      }

      setSectionLayouts((layouts) =>
        layouts.map((section, idx) => {
          if (idx !== sectionIndex) return section;
          return {
            cards: resolveSectionLayout(section.cards, cardIndex, nextLayout),
          };
        })
      );

      setIsManipulating(true);
      if (manipulationTimeoutRef.current) {
        clearTimeout(manipulationTimeoutRef.current);
      }
      manipulationTimeoutRef.current = setTimeout(() => {
        setIsManipulating(false);
      }, 300);
    },
    [rawFocusedCard, sectionCount, getCardCount, sectionLayouts, setSectionLayouts]
  );

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const layoutScopeActive = isScopeActive("sheet-layout");
      const globalScopeActive = isScopeActive("global");

      if (!layoutScopeActive && !globalScopeActive) return;

      if (!layoutScopeActive && !rawFocusedCard && !event.shiftKey && !event.altKey) {
        return;
      }

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

      const validFocus = validateFocus(rawFocusedCard, sectionCount, getCardCount);
      if (validFocus) {
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
          return;
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    rawFocusedCard,
    sectionCount,
    getCardCount,
    isScopeActive,
    matchesAction,
    handleNavigation,
    handleMove,
    handleResize,
  ]);

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
