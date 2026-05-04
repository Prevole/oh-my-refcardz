"use client";

import { useEffect, useRef, useState } from "react";
import type { Dispatch, SetStateAction, PointerEvent as ReactPointerEvent } from "react";
import { GRID_GAP_PX } from "../sheet-grid";
import { pointerToGridPosition, resolveSectionLayout } from "./layout-algorithms";
import type { DragState, SectionLayoutState, SectionMetricsState } from "./layout-types";
import { FALLBACK_METRICS } from "./layout-types";

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export type UseCardDragResult = {
  dragState: DragState | null;
  startCardDrag: (sectionIndex: number, cardIndex: number, event: ReactPointerEvent<HTMLElement>) => void;
};

export function useCardDrag(
  editMode: boolean,
  sectionLayouts: SectionLayoutState[],
  setSectionLayouts: Dispatch<SetStateAction<SectionLayoutState[]>>,
  sectionMetrics: SectionMetricsState[]
): UseCardDragResult {
  const [dragState, setDragState] = useState<DragState | null>(null);
  const dragStateRef = useRef<DragState | null>(null);

  // Keep ref in sync with state for use in event listeners
  useEffect(() => {
    dragStateRef.current = dragState;
  }, [dragState]);

  // Global pointer event listeners for drag
  useEffect(() => {
    if (!editMode || !dragState) return;

    function handlePointerMove(event: PointerEvent) {
      const active = dragStateRef.current;
      if (!active) return;

      const nextPosition = pointerToGridPosition(
        event.clientX - active.pointerOffsetX,
        event.clientY - active.pointerOffsetY,
        active.gridRect,
        active.unitSize,
        active.colSpan
      );

      if (nextPosition.colStart === active.colStart && nextPosition.rowStart === active.rowStart) {
        return;
      }

      setDragState({ ...active, ...nextPosition });
    }

    function handlePointerUp() {
      const active = dragStateRef.current;
      if (!active) return;

      setSectionLayouts((currentLayouts) =>
        currentLayouts.map((sectionLayout, sectionIndex) => {
          if (sectionIndex !== active.sectionIndex) return sectionLayout;

          return {
            cards: resolveSectionLayout(sectionLayout.cards, active.cardIndex, {
              colStart: active.colStart,
              rowStart: active.rowStart,
              colSpan: active.colSpan,
              rowSpan: active.rowSpan,
            }),
          };
        })
      );

      setDragState(null);
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [dragState, editMode, setSectionLayouts]);

  function startCardDrag(sectionIndex: number, cardIndex: number, event: ReactPointerEvent<HTMLElement>) {
    if (!editMode) return;

    // Ignore clicks on layout control buttons
    if ((event.target as HTMLElement).closest("[data-card-layout-controls]")) return;

    const grid = event.currentTarget.closest("[data-sheet-grid]");
    if (!(grid instanceof HTMLElement)) return;

    const metrics = sectionMetrics[sectionIndex] ?? FALLBACK_METRICS;
    const cardLayout = sectionLayouts[sectionIndex].cards[cardIndex];
    const gridRect = grid.getBoundingClientRect();

    event.preventDefault();

    setDragState({
      sectionIndex,
      cardIndex,
      colStart: cardLayout.colStart,
      rowStart: cardLayout.rowStart,
      colSpan: cardLayout.colSpan,
      rowSpan: cardLayout.rowSpan,
      gridRect,
      unitSize: metrics.unitSize,
      pointerOffsetX: event.clientX - (gridRect.left + (cardLayout.colStart - 1) * (metrics.unitSize + GRID_GAP_PX)),
      pointerOffsetY: event.clientY - (gridRect.top + (cardLayout.rowStart - 1) * (metrics.unitSize + GRID_GAP_PX)),
    });
  }

  return {
    dragState,
    startCardDrag,
  };
}
