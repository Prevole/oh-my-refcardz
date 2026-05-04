"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { useKeyboardContext } from "@/hooks/use-keyboard-context";
import { useKeybindings } from "@/hooks/use-keybindings";
import { ACTION_IDS } from "@/lib/keybindings";
import { GRID_COLUMNS } from "../sheet-grid";
import { clamp, resolveSectionLayout } from "./layout-algorithms";
import type { CardLayoutState, SectionLayoutState } from "./layout-types";
import { MAX_ROW_SPAN } from "./layout-types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CardFocus = {
  sectionIndex: number;
  cardIndex: number;
};

export type UseCardKeyboardResult = {
  /** Currently focused card (null if no card focused) */
  focusedCard: CardFocus | null;
  /** Set focus to a specific card */
  setFocusedCard: Dispatch<SetStateAction<CardFocus | null>>;
  /** Whether a card manipulation (move/resize) is in progress */
  isManipulating: boolean;
};

type UseCardKeyboardOptions = {
  /** Whether layout edit mode is active */
  editMode: boolean;
  /** Current section layouts */
  sectionLayouts: SectionLayoutState[];
  /** Setter for section layouts */
  setSectionLayouts: Dispatch<SetStateAction<SectionLayoutState[]>>;
  /** Total number of sections */
  sectionCount: number;
  /** Get card count for a section */
  getCardCount: (sectionIndex: number) => number;
};

// ---------------------------------------------------------------------------
// Card navigation helpers
// ---------------------------------------------------------------------------

type CardPosition = {
  sectionIndex: number;
  cardIndex: number;
  layout: CardLayoutState;
};

/**
 * Get all cards with their positions across all sections
 */
function getAllCards(sectionLayouts: SectionLayoutState[]): CardPosition[] {
  const cards: CardPosition[] = [];
  sectionLayouts.forEach((section, sectionIndex) => {
    section.cards.forEach((layout, cardIndex) => {
      cards.push({ sectionIndex, cardIndex, layout });
    });
  });
  return cards;
}

/**
 * Find the card to navigate to based on direction
 */
function findCardInDirection(
  cards: CardPosition[],
  current: CardPosition,
  direction: "up" | "down" | "left" | "right"
): CardPosition | null {
  // Filter to cards in the same section for now (simpler navigation)
  const sameSection = cards.filter((c) => c.sectionIndex === current.sectionIndex);

  switch (direction) {
    case "left": {
      // Find cards to the left (lower colStart) that overlap vertically
      const candidates = sameSection.filter((c) => {
        if (c.cardIndex === current.cardIndex) return false;
        // Card must be to the left
        if (c.layout.colStart >= current.layout.colStart) return false;
        // Check vertical overlap
        const currentTop = current.layout.rowStart;
        const currentBottom = currentTop + current.layout.rowSpan - 1;
        const candidateTop = c.layout.rowStart;
        const candidateBottom = candidateTop + c.layout.rowSpan - 1;
        return candidateTop <= currentBottom && candidateBottom >= currentTop;
      });
      if (candidates.length === 0) return null;
      // Return the rightmost of the candidates (closest to current)
      return candidates.reduce((best, c) =>
        c.layout.colStart > best.layout.colStart ? c : best
      );
    }

    case "right": {
      // Find cards to the right (higher colStart) that overlap vertically
      const candidates = sameSection.filter((c) => {
        if (c.cardIndex === current.cardIndex) return false;
        // Card must be to the right
        if (c.layout.colStart <= current.layout.colStart) return false;
        // Check vertical overlap
        const currentTop = current.layout.rowStart;
        const currentBottom = currentTop + current.layout.rowSpan - 1;
        const candidateTop = c.layout.rowStart;
        const candidateBottom = candidateTop + c.layout.rowSpan - 1;
        return candidateTop <= currentBottom && candidateBottom >= currentTop;
      });
      if (candidates.length === 0) return null;
      // Return the leftmost of the candidates (closest to current)
      return candidates.reduce((best, c) =>
        c.layout.colStart < best.layout.colStart ? c : best
      );
    }

    case "up": {
      // Find cards above (lower rowStart) that overlap horizontally
      const candidates = sameSection.filter((c) => {
        if (c.cardIndex === current.cardIndex) return false;
        // Card must be above
        if (c.layout.rowStart >= current.layout.rowStart) return false;
        // Check horizontal overlap
        const currentLeft = current.layout.colStart;
        const currentRight = currentLeft + current.layout.colSpan - 1;
        const candidateLeft = c.layout.colStart;
        const candidateRight = candidateLeft + c.layout.colSpan - 1;
        return candidateLeft <= currentRight && candidateRight >= currentLeft;
      });
      if (candidates.length === 0) return null;
      // Return the lowest of the candidates (closest to current)
      return candidates.reduce((best, c) =>
        c.layout.rowStart > best.layout.rowStart ? c : best
      );
    }

    case "down": {
      // Find cards below (higher rowStart) that overlap horizontally
      const candidates = sameSection.filter((c) => {
        if (c.cardIndex === current.cardIndex) return false;
        // Card must be below
        if (c.layout.rowStart <= current.layout.rowStart) return false;
        // Check horizontal overlap
        const currentLeft = current.layout.colStart;
        const currentRight = currentLeft + current.layout.colSpan - 1;
        const candidateLeft = c.layout.colStart;
        const candidateRight = candidateLeft + c.layout.colSpan - 1;
        return candidateLeft <= currentRight && candidateRight >= currentLeft;
      });
      if (candidates.length === 0) return null;
      // Return the highest of the candidates (closest to current)
      return candidates.reduce((best, c) =>
        c.layout.rowStart < best.layout.rowStart ? c : best
      );
    }
  }
}

/**
 * Find the first card in a section (top-left)
 */
function findFirstCard(sectionLayouts: SectionLayoutState[]): CardFocus | null {
  for (let sectionIndex = 0; sectionIndex < sectionLayouts.length; sectionIndex++) {
    const section = sectionLayouts[sectionIndex];
    if (section.cards.length > 0) {
      // Find the top-left card
      let bestIndex = 0;
      let bestLayout = section.cards[0];
      section.cards.forEach((layout, cardIndex) => {
        if (
          layout.rowStart < bestLayout.rowStart ||
          (layout.rowStart === bestLayout.rowStart && layout.colStart < bestLayout.colStart)
        ) {
          bestIndex = cardIndex;
          bestLayout = layout;
        }
      });
      return { sectionIndex, cardIndex: bestIndex };
    }
  }
  return null;
}

/**
 * Validate a card focus against current layout state
 */
function validateFocus(
  focus: CardFocus | null,
  sectionCount: number,
  getCardCount: (sectionIndex: number) => number
): CardFocus | null {
  if (!focus) return null;
  const { sectionIndex, cardIndex } = focus;
  if (sectionIndex >= sectionCount || cardIndex >= getCardCount(sectionIndex)) {
    return null;
  }
  return focus;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useCardKeyboard({
  editMode,
  sectionLayouts,
  setSectionLayouts,
  sectionCount,
  getCardCount,
}: UseCardKeyboardOptions): UseCardKeyboardResult {
  const { isScopeActive, pushScope, popScope } = useKeyboardContext();
  const { matchesAction } = useKeybindings();

  // State is managed here but we derive valid focus
  const [rawFocusedCard, setRawFocusedCard] = useState<CardFocus | null>(null);
  const [isManipulating, setIsManipulating] = useState(false);
  const manipulationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Track if sheet-layout scope is pushed
  const scopePushedRef = useRef(false);

  // Derive the actual focused card — null if edit mode is off or focus is invalid
  const focusedCard = editMode ? validateFocus(rawFocusedCard, sectionCount, getCardCount) : null;

  // Wrapper setter that clears focus when edit mode is off
  const setFocusedCard: Dispatch<SetStateAction<CardFocus | null>> = useCallback(
    (action) => {
      if (!editMode) return;
      setRawFocusedCard(action);
    },
    [editMode]
  );

  // Push/pop scope based on edit mode and focus
  useEffect(() => {
    if (editMode && focusedCard && !scopePushedRef.current) {
      pushScope("sheet-layout");
      scopePushedRef.current = true;
    } else if ((!editMode || !focusedCard) && scopePushedRef.current) {
      popScope("sheet-layout");
      scopePushedRef.current = false;
    }

    return () => {
      if (scopePushedRef.current) {
        popScope("sheet-layout");
        scopePushedRef.current = false;
      }
    };
  }, [editMode, focusedCard, pushScope, popScope]);

  // Navigation handler
  const handleNavigation = useCallback(
    (direction: "up" | "down" | "left" | "right") => {
      const validFocus = editMode ? validateFocus(rawFocusedCard, sectionCount, getCardCount) : null;
      
      if (!validFocus) {
        // Focus first card if none focused
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
    [editMode, rawFocusedCard, sectionCount, getCardCount, sectionLayouts]
  );

  // Move handler
  const handleMove = useCallback(
    (direction: "up" | "down" | "left" | "right") => {
      const validFocus = editMode ? validateFocus(rawFocusedCard, sectionCount, getCardCount) : null;
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

      // Skip if no change
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

      // Show manipulation feedback
      setIsManipulating(true);
      if (manipulationTimeoutRef.current) {
        clearTimeout(manipulationTimeoutRef.current);
      }
      manipulationTimeoutRef.current = setTimeout(() => {
        setIsManipulating(false);
      }, 300);
    },
    [editMode, rawFocusedCard, sectionCount, getCardCount, sectionLayouts, setSectionLayouts]
  );

  // Resize handler
  const handleResize = useCallback(
    (direction: "up" | "down" | "left" | "right") => {
      const validFocus = editMode ? validateFocus(rawFocusedCard, sectionCount, getCardCount) : null;
      if (!validFocus) return;

      const { sectionIndex, cardIndex } = validFocus;
      const currentLayout = sectionLayouts[sectionIndex]?.cards[cardIndex];
      if (!currentLayout) return;

      let nextLayout: CardLayoutState;
      switch (direction) {
        case "left":
          // Shrink width
          nextLayout = {
            ...currentLayout,
            colSpan: clamp(currentLayout.colSpan - 1, 1, GRID_COLUMNS),
          };
          break;
        case "right":
          // Grow width
          nextLayout = {
            ...currentLayout,
            colSpan: clamp(currentLayout.colSpan + 1, 1, GRID_COLUMNS),
          };
          // Adjust colStart if needed to fit in grid
          if (nextLayout.colStart + nextLayout.colSpan - 1 > GRID_COLUMNS) {
            nextLayout.colStart = GRID_COLUMNS - nextLayout.colSpan + 1;
          }
          break;
        case "up":
          // Shrink height
          nextLayout = {
            ...currentLayout,
            rowSpan: clamp(currentLayout.rowSpan - 1, 1, MAX_ROW_SPAN),
          };
          break;
        case "down":
          // Grow height
          nextLayout = {
            ...currentLayout,
            rowSpan: clamp(currentLayout.rowSpan + 1, 1, MAX_ROW_SPAN),
          };
          break;
      }

      // Skip if no change
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

      // Show manipulation feedback
      setIsManipulating(true);
      if (manipulationTimeoutRef.current) {
        clearTimeout(manipulationTimeoutRef.current);
      }
      manipulationTimeoutRef.current = setTimeout(() => {
        setIsManipulating(false);
      }, 300);
    },
    [editMode, rawFocusedCard, sectionCount, getCardCount, sectionLayouts, setSectionLayouts]
  );

  // Keyboard event handler
  useEffect(() => {
    if (!editMode) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // Only handle when sheet-layout scope is active or global scope (no card focused yet)
      if (!isScopeActive("sheet-layout") && !isScopeActive("global")) return;

      // Skip if target is an input element
      const tag = (event.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return;

      // Card navigation (Shift + hjkl)
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

      // Card movement and resize only when a card is focused
      const validFocus = validateFocus(rawFocusedCard, sectionCount, getCardCount);
      if (validFocus) {
        // Card movement (Ctrl + hjkl)
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

        // Card resize (Ctrl + Shift + hjkl)
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
    editMode,
    rawFocusedCard,
    sectionCount,
    getCardCount,
    isScopeActive,
    matchesAction,
    handleNavigation,
    handleMove,
    handleResize,
  ]);

  // Cleanup timeout on unmount
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
