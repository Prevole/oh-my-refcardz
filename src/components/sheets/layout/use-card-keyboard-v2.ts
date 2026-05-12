"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { useKeyboardContext } from "@/hooks/use-keyboard-context";
import { useKeybindings } from "@/hooks/use-keybindings";
import { ACTION_IDS } from "@/lib/keybindings";
import type { LayoutBlock, MoveIntent, ResizeIntent, ResizeDirection } from "@/lib/layout/solver/types";

/**
 * Focused card state.
 */
export type CardFocusV2 = {
  blockId: string;
};

/**
 * Result of the useCardKeyboardV2 hook.
 */
export type UseCardKeyboardV2Result = {
  /** Currently focused card, if any */
  focusedCard: CardFocusV2 | null;
  /** Set the focused card */
  setFocusedCard: Dispatch<SetStateAction<CardFocusV2 | null>>;
  /** Whether the focused card is actively being manipulated */
  isManipulating: boolean;
};

type UseCardKeyboardV2Options = {
  /** Current layout blocks */
  blocks: LayoutBlock[];
  /** Called when a move intent is produced */
  onMoveIntent?: (intent: MoveIntent) => void;
  /** Called when a resize intent is produced */
  onResizeIntent?: (intent: ResizeIntent) => void;
};

/**
 * Find the first card by reading order (top-to-bottom, left-to-right).
 */
function findFirstCard(blocks: LayoutBlock[]): CardFocusV2 | null {
  if (blocks.length === 0) return null;

  let best = blocks[0];
  for (const block of blocks) {
    if (
      block.position.y < best.position.y ||
      (block.position.y === best.position.y && block.position.x < best.position.x)
    ) {
      best = block;
    }
  }

  return { blockId: best.id };
}

/**
 * Find the card in a given direction from the current focus.
 */
function findCardInDirection(
  blocks: LayoutBlock[],
  currentId: string,
  direction: "up" | "down" | "left" | "right"
): CardFocusV2 | null {
  const current = blocks.find((b) => b.id === currentId);
  if (!current) return null;

  const candidates: Array<{ block: LayoutBlock; distance: number }> = [];

  for (const block of blocks) {
    if (block.id === currentId) continue;

    const pos = block.position;
    const cur = current.position;

    // Calculate overlap on the perpendicular axis
    const hOverlap = Math.max(0, Math.min(cur.x + cur.w, pos.x + pos.w) - Math.max(cur.x, pos.x));
    const vOverlap = Math.max(0, Math.min(cur.y + cur.h, pos.y + pos.h) - Math.max(cur.y, pos.y));

    let inDirection = false;
    let distance = Infinity;

    switch (direction) {
      case "left":
        if (pos.x + pos.w <= cur.x) {
          inDirection = true;
          distance = cur.x - (pos.x + pos.w);
          // Prefer cards with vertical overlap
          if (vOverlap === 0) distance += 1000;
        }
        break;
      case "right":
        if (pos.x >= cur.x + cur.w) {
          inDirection = true;
          distance = pos.x - (cur.x + cur.w);
          if (vOverlap === 0) distance += 1000;
        }
        break;
      case "up":
        if (pos.y + pos.h <= cur.y) {
          inDirection = true;
          distance = cur.y - (pos.y + pos.h);
          if (hOverlap === 0) distance += 1000;
        }
        break;
      case "down":
        if (pos.y >= cur.y + cur.h) {
          inDirection = true;
          distance = pos.y - (cur.y + cur.h);
          if (hOverlap === 0) distance += 1000;
        }
        break;
    }

    if (inDirection) {
      candidates.push({ block, distance });
    }
  }

  if (candidates.length === 0) return null;

  candidates.sort((a, b) => a.distance - b.distance);
  return { blockId: candidates[0].block.id };
}

/**
 * Validate that a focus target still exists.
 */
function validateFocus(focus: CardFocusV2 | null, blocks: LayoutBlock[]): CardFocusV2 | null {
  if (!focus) return null;
  const exists = blocks.some((b) => b.id === focus.blockId);
  return exists ? focus : null;
}

/**
 * Hook for handling keyboard interactions with layout cards.
 *
 * This hook:
 * - Manages focus state for keyboard navigation
 * - Handles arrow key navigation between cards
 * - Produces MoveIntent/ResizeIntent for the solver
 * - Integrates with the global keybinding system
 *
 * The hook does NOT directly modify the layout. It only produces intents
 * that the parent component passes to the layout editor.
 */
export function useCardKeyboardV2({
  blocks,
  onMoveIntent,
  onResizeIntent,
}: UseCardKeyboardV2Options): UseCardKeyboardV2Result {
  const { isScopeActive, pushScope, popScope } = useKeyboardContext();
  const { matchesAction } = useKeybindings();

  const [rawFocusedCard, setRawFocusedCard] = useState<CardFocusV2 | null>(null);
  const [isManipulating, setIsManipulating] = useState(false);
  const manipulationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scopePushedRef = useRef(false);

  // Validate focus against current blocks
  const focusedCard = validateFocus(rawFocusedCard, blocks);

  const setFocusedCard: Dispatch<SetStateAction<CardFocusV2 | null>> = useCallback((action) => {
    setRawFocusedCard(action);
  }, []);

  // Keep callbacks ref up to date
  const callbacksRef = useRef({ onMoveIntent, onResizeIntent });
  useEffect(() => {
    callbacksRef.current = { onMoveIntent, onResizeIntent };
  }, [onMoveIntent, onResizeIntent]);

  // Manage keyboard scope
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

  // Scroll focused card into view
  useEffect(() => {
    if (!focusedCard) return;

    const card = document.querySelector<HTMLElement>(
      `[data-layout-card="true"][data-layout-block-id="${focusedCard.blockId}"]`
    );

    if (!card) return;

    card.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
  }, [focusedCard, blocks]);

  // Handle navigation between cards
  const handleNavigation = useCallback(
    (direction: "up" | "down" | "left" | "right") => {
      const validFocus = validateFocus(rawFocusedCard, blocks);

      if (!validFocus) {
        const first = findFirstCard(blocks);
        if (first) setRawFocusedCard(first);
        return;
      }

      const target = findCardInDirection(blocks, validFocus.blockId, direction);
      if (target) {
        setRawFocusedCard(target);
      }
    },
    [blocks, rawFocusedCard]
  );

  // Handle move actions
  const handleMove = useCallback(
    (direction: "up" | "down" | "left" | "right") => {
      const validFocus = validateFocus(rawFocusedCard, blocks);
      if (!validFocus) return;

      const block = blocks.find((b) => b.id === validFocus.blockId);
      if (!block) return;

      let newX = block.position.x;
      let newY = block.position.y;

      switch (direction) {
        case "left":
          newX = Math.max(0, block.position.x - 1);
          break;
        case "right":
          newX = block.position.x + 1;
          break;
        case "up":
          newY = Math.max(0, block.position.y - 1);
          break;
        case "down":
          newY = block.position.y + 1;
          break;
      }

      if (newX === block.position.x && newY === block.position.y) {
        return;
      }

      const intent: MoveIntent = {
        type: "move",
        blockId: validFocus.blockId,
        x: newX,
        y: newY,
      };

      callbacksRef.current.onMoveIntent?.(intent);

      setIsManipulating(true);
      if (manipulationTimeoutRef.current) clearTimeout(manipulationTimeoutRef.current);
      manipulationTimeoutRef.current = setTimeout(() => setIsManipulating(false), 300);
    },
    [blocks, rawFocusedCard]
  );

  // Handle resize actions
  const handleResize = useCallback(
    (direction: "up" | "down" | "left" | "right", event: KeyboardEvent) => {
      const validFocus = validateFocus(rawFocusedCard, blocks);
      if (!validFocus) return;

      const block = blocks.find((b) => b.id === validFocus.blockId);
      if (!block) return;

      // Map keyboard direction to resize direction and delta
      let resizeDirection: ResizeDirection;
      let delta: number;

      switch (direction) {
        case "left":
          resizeDirection = "west";
          delta = -1; // Shrink width
          break;
        case "right":
          resizeDirection = "east";
          delta = 1; // Grow width
          break;
        case "up":
          resizeDirection = "north";
          delta = -1; // Shrink height
          break;
        case "down":
          resizeDirection = "south";
          delta = 1; // Grow height
          break;
      }

      const intent: ResizeIntent = {
        type: "resize",
        blockId: validFocus.blockId,
        direction: resizeDirection,
        delta,
        compact: event.ctrlKey && event.shiftKey, // Ctrl+Shift for compact
      };

      callbacksRef.current.onResizeIntent?.(intent);

      setIsManipulating(true);
      if (manipulationTimeoutRef.current) clearTimeout(manipulationTimeoutRef.current);
      manipulationTimeoutRef.current = setTimeout(() => setIsManipulating(false), 300);
    },
    [blocks, rawFocusedCard]
  );

  // Handle keyboard events
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const layoutScopeActive = isScopeActive("sheet-layout");
      const globalScopeActive = isScopeActive("global");

      if (!layoutScopeActive && !globalScopeActive) return;
      if (!layoutScopeActive && !rawFocusedCard && !event.shiftKey && !event.altKey) return;

      const tag = (event.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return;

      // Navigation
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

      const validFocus = validateFocus(rawFocusedCard, blocks);
      if (!validFocus) return;

      // Clear focus
      if (matchesAction(event, ACTION_IDS.CARD_CLEAR_FOCUS)) {
        event.preventDefault();
        event.stopImmediatePropagation();
        setRawFocusedCard(null);
        setIsManipulating(false);
        return;
      }

      // Move
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

      // Resize
      if (matchesAction(event, ACTION_IDS.CARD_SHRINK_WIDTH)) {
        event.preventDefault();
        handleResize("left", event);
        return;
      }
      if (matchesAction(event, ACTION_IDS.CARD_GROW_WIDTH)) {
        event.preventDefault();
        handleResize("right", event);
        return;
      }
      if (matchesAction(event, ACTION_IDS.CARD_SHRINK_HEIGHT)) {
        event.preventDefault();
        handleResize("up", event);
        return;
      }
      if (matchesAction(event, ACTION_IDS.CARD_GROW_HEIGHT)) {
        event.preventDefault();
        handleResize("down", event);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [blocks, handleMove, handleNavigation, handleResize, isScopeActive, matchesAction, rawFocusedCard]);

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
