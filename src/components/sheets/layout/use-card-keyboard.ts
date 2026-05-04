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
  /** Exit layout edit mode */
  onExitLayoutMode: () => void;
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

type CardBounds = {
  left: number;
  right: number;
  top: number;
  bottom: number;
};

const SECTION_ROW_GAP = 2;

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
  const sameSection = cards.filter((c) => c.sectionIndex === current.sectionIndex);
  const currentBounds = getCardBounds(current.layout);

  const sameSectionCandidates = sameSection
    .filter((c) => c.cardIndex !== current.cardIndex)
    .map((candidate) => {
      const candidateBounds = getCardBounds(candidate.layout);
      return {
        candidate,
        bounds: candidateBounds,
        score: scoreCandidateInDirection(currentBounds, candidateBounds, direction),
      };
    })
    .filter((entry) => entry.score !== null)
    .sort((left, right) => compareScores(left.score!, right.score!));

  if (sameSectionCandidates[0]) {
    return sameSectionCandidates[0].candidate;
  }

  const sectionOffsets = computeSectionRowOffsets(cards);
  const currentGlobalBounds = getGlobalCardBounds(current, sectionOffsets);

  const crossSectionCandidates = cards
    .filter(
      (candidate) =>
        !(candidate.sectionIndex === current.sectionIndex && candidate.cardIndex === current.cardIndex)
    )
    .map((candidate) => ({
      candidate,
      score: scoreCandidateInDirection(
        currentGlobalBounds,
        getGlobalCardBounds(candidate, sectionOffsets),
        direction
      ),
    }))
    .filter((entry) => entry.score !== null)
    .sort((left, right) => compareScores(left.score!, right.score!));

  return crossSectionCandidates[0]?.candidate ?? null;
}

function getCardBounds(layout: CardLayoutState): CardBounds {
  return {
    left: layout.colStart,
    right: layout.colStart + layout.colSpan - 1,
    top: layout.rowStart,
    bottom: layout.rowStart + layout.rowSpan - 1,
  };
}

function getGlobalCardBounds(
  card: CardPosition,
  sectionOffsets: Map<number, number>
): CardBounds {
  const offset = sectionOffsets.get(card.sectionIndex) ?? 0;
  const bounds = getCardBounds(card.layout);

  return {
    ...bounds,
    top: bounds.top + offset,
    bottom: bounds.bottom + offset,
  };
}

function computeSectionRowOffsets(cards: CardPosition[]) {
  const sectionMaxBottom = new Map<number, number>();

  for (const card of cards) {
    const bottom = card.layout.rowStart + card.layout.rowSpan - 1;
    const currentMax = sectionMaxBottom.get(card.sectionIndex) ?? 0;
    sectionMaxBottom.set(card.sectionIndex, Math.max(currentMax, bottom));
  }

  const sectionIndices = [...new Set(cards.map((card) => card.sectionIndex))].sort((a, b) => a - b);
  const offsets = new Map<number, number>();
  let currentOffset = 0;

  for (const sectionIndex of sectionIndices) {
    offsets.set(sectionIndex, currentOffset);
    const sectionHeight = sectionMaxBottom.get(sectionIndex) ?? 0;
    currentOffset += sectionHeight + SECTION_ROW_GAP;
  }

  return offsets;
}

function getOverlapSize(startA: number, endA: number, startB: number, endB: number) {
  return Math.max(0, Math.min(endA, endB) - Math.max(startA, startB) + 1);
}

function scoreCandidateInDirection(
  current: CardBounds,
  candidate: CardBounds,
  direction: "up" | "down" | "left" | "right"
) {
  switch (direction) {
    case "left": {
      if (candidate.right >= current.left) return null;
      const primaryDistance = current.left - candidate.right;
      const overlap = getOverlapSize(current.top, current.bottom, candidate.top, candidate.bottom);
      const secondaryDistance = overlap > 0 ? 0 : distanceBetweenRanges(current.top, current.bottom, candidate.top, candidate.bottom);
      return { overlapPriority: overlap > 0 ? 0 : 1, primaryDistance, secondaryDistance };
    }

    case "right": {
      if (candidate.left <= current.right) return null;
      const primaryDistance = candidate.left - current.right;
      const overlap = getOverlapSize(current.top, current.bottom, candidate.top, candidate.bottom);
      const secondaryDistance = overlap > 0 ? 0 : distanceBetweenRanges(current.top, current.bottom, candidate.top, candidate.bottom);
      return { overlapPriority: overlap > 0 ? 0 : 1, primaryDistance, secondaryDistance };
    }

    case "up": {
      if (candidate.bottom >= current.top) return null;
      const primaryDistance = current.top - candidate.bottom;
      const overlap = getOverlapSize(current.left, current.right, candidate.left, candidate.right);
      const secondaryDistance = overlap > 0 ? 0 : distanceBetweenRanges(current.left, current.right, candidate.left, candidate.right);
      return { overlapPriority: overlap > 0 ? 0 : 1, primaryDistance, secondaryDistance };
    }

    case "down": {
      if (candidate.top <= current.bottom) return null;
      const primaryDistance = candidate.top - current.bottom;
      const overlap = getOverlapSize(current.left, current.right, candidate.left, candidate.right);
      const secondaryDistance = overlap > 0 ? 0 : distanceBetweenRanges(current.left, current.right, candidate.left, candidate.right);
      return { overlapPriority: overlap > 0 ? 0 : 1, primaryDistance, secondaryDistance };
    }
  }
}

function distanceBetweenRanges(startA: number, endA: number, startB: number, endB: number) {
  if (endA < startB) return startB - endA;
  if (endB < startA) return startA - endB;
  return 0;
}

function compareScores(
  left: { overlapPriority: number; primaryDistance: number; secondaryDistance: number },
  right: { overlapPriority: number; primaryDistance: number; secondaryDistance: number }
) {
  if (left.overlapPriority !== right.overlapPriority) {
    return left.overlapPriority - right.overlapPriority;
  }
  if (left.primaryDistance !== right.primaryDistance) {
    return left.primaryDistance - right.primaryDistance;
  }
  return left.secondaryDistance - right.secondaryDistance;
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
  onExitLayoutMode,
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

  // Push/pop scope based on layout mode.
  useEffect(() => {
    if (editMode && !scopePushedRef.current) {
      pushScope("sheet-layout");
      scopePushedRef.current = true;
    } else if (!editMode && scopePushedRef.current) {
      popScope("sheet-layout");
      scopePushedRef.current = false;
    }

    return () => {
      if (scopePushedRef.current) {
        popScope("sheet-layout");
        scopePushedRef.current = false;
      }
    };
  }, [editMode, pushScope, popScope]);

  // Keep the focused card visible while navigating or manipulating the layout.
  useEffect(() => {
    if (!editMode || !focusedCard) return;

    const card = document.querySelector<HTMLElement>(
      `[data-layout-card="true"][data-layout-section-index="${focusedCard.sectionIndex}"][data-layout-card-index="${focusedCard.cardIndex}"]`
    );

    if (!card) return;

    card.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
  }, [editMode, focusedCard, sectionLayouts]);

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
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopImmediatePropagation();
          setRawFocusedCard(null);
          setIsManipulating(false);
          return;
        }

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

      if (event.key === "Escape") {
        event.preventDefault();
        event.stopImmediatePropagation();
        onExitLayoutMode();
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
    onExitLayoutMode,
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
