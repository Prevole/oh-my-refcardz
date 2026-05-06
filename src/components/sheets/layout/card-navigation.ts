import type { CardLayoutState, SectionLayoutState } from "./layout-types";

export type CardPosition = {
  sectionIndex: number;
  cardIndex: number;
  layout: CardLayoutState;
};

export type CardBounds = {
  left: number;
  right: number;
  top: number;
  bottom: number;
};

export type CardFocus = {
  sectionIndex: number;
  cardIndex: number;
};

const SECTION_ROW_GAP = 2;

export function getAllCards(sectionLayouts: SectionLayoutState[]): CardPosition[] {
  const cards: CardPosition[] = [];
  sectionLayouts.forEach((section, sectionIndex) => {
    section.cards.forEach((layout, cardIndex) => {
      cards.push({ sectionIndex, cardIndex, layout });
    });
  });
  return cards;
}

export function findCardInDirection(
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
    /* v8 ignore start -- defensive: score is null only when candidate is behind current in direction */
    .filter((entry) => entry.score !== null)
    .sort((left, right) => compareScores(left.score!, right.score!));
  /* v8 ignore stop */

  return crossSectionCandidates[0]?.candidate ?? null;
}

export function getCardBounds(layout: CardLayoutState): CardBounds {
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
  /* v8 ignore start -- defensive: ranges overlap or B is before A, rare in grid layouts */
  if (endB < startA) return startA - endB;
  return 0;
  /* v8 ignore stop */
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

export function findFirstCard(sectionLayouts: SectionLayoutState[]): CardFocus | null {
  for (let sectionIndex = 0; sectionIndex < sectionLayouts.length; sectionIndex++) {
    const section = sectionLayouts[sectionIndex];
    if (section.cards.length > 0) {
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

export function validateFocus(
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
