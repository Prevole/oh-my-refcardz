import type { BlockLayoutState } from "./layout-types";

export type CardPosition = {
  blockId: string;
  layout: BlockLayoutState;
};

export type CardBounds = {
  left: number;
  right: number;
  top: number;
  bottom: number;
};

export type CardFocus = {
  blockId: string;
};

export function getAllCards(blockLayouts: BlockLayoutState[]): CardPosition[] {
  return blockLayouts.map((layout) => ({ blockId: layout.id, layout }));
}

export function findCardInDirection(
  cards: CardPosition[],
  current: CardPosition,
  direction: "up" | "down" | "left" | "right"
): CardPosition | null {
  const currentBounds = getCardBounds(current.layout);

  const candidates = cards
    .filter((candidate) => candidate.blockId !== current.blockId)
    .map((candidate) => ({
      candidate,
      score: scoreCandidateInDirection(currentBounds, getCardBounds(candidate.layout), direction),
    }))
    .filter((entry) => entry.score !== null)
    .sort((left, right) => compareScores(left.score!, right.score!));

  return candidates[0]?.candidate ?? null;
}

export function getCardBounds(layout: BlockLayoutState): CardBounds {
  return {
    left: layout.colStart,
    right: layout.colStart + layout.colSpan - 1,
    top: layout.rowStart,
    bottom: layout.rowStart + layout.rowSpan - 1,
  };
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

export function findFirstCard(blockLayouts: BlockLayoutState[]): CardFocus | null {
  const cards = getAllCards(blockLayouts);
  if (cards.length === 0) {
    return null;
  }

  let bestCard = cards[0];
  cards.forEach((card) => {
    if (
      card.layout.rowStart < bestCard.layout.rowStart ||
      (card.layout.rowStart === bestCard.layout.rowStart && card.layout.colStart < bestCard.layout.colStart)
    ) {
      bestCard = card;
    }
  });

  return { blockId: bestCard.blockId };
}

export function validateFocus(focus: CardFocus | null, blockLayouts: BlockLayoutState[]): CardFocus | null {
  if (!focus) return null;

  const target = blockLayouts.find((layout) => layout.id === focus.blockId);
  return target ? focus : null;
}
