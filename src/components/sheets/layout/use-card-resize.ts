"use client";

import { useEffect, useRef, useState } from "react";
import type { Dispatch, PointerEvent as ReactPointerEvent, SetStateAction } from "react";
import { GRID_GAP_PX, GRID_COLUMNS } from "../sheet-grid";
import { resolveSectionLayout } from "./layout-algorithms";
import { calculateResizeBounds, boundsEqual } from "./resize-calculations";
import type { ResizeHandleDirection, ResizeState, SectionLayoutState, SectionMetricsState } from "./layout-types";
import { FALLBACK_METRICS } from "./layout-types";

export type UseCardResizeResult = {
  resizeState: ResizeState | null;
  startCardResize: (
    sectionIndex: number,
    cardIndex: number,
    direction: ResizeHandleDirection,
    event: ReactPointerEvent<HTMLElement>
  ) => void;
};

export function useCardResize(
  sectionLayouts: SectionLayoutState[],
  setSectionLayouts: Dispatch<SetStateAction<SectionLayoutState[]>>,
  sectionMetrics: SectionMetricsState[]
): UseCardResizeResult {
  const [resizeState, setResizeState] = useState<ResizeState | null>(null);
  const resizeStateRef = useRef<ResizeState | null>(null);

  useEffect(() => {
    resizeStateRef.current = resizeState;
  }, [resizeState]);

  useEffect(() => {
    if (!resizeState) return;

    function handlePointerMove(event: PointerEvent) {
      const active = resizeStateRef.current;
      if (!active) return;

      const pitch = active.unitSize + GRID_GAP_PX;
      const deltaCols = Math.round((event.clientX - active.startClientX) / pitch);
      const deltaRows = Math.round((event.clientY - active.startClientY) / pitch);

      const origin = {
        colStart: active.originColStart,
        rowStart: active.originRowStart,
        colSpan: active.originColSpan,
        rowSpan: active.originRowSpan,
      };

      const nextBounds = calculateResizeBounds(origin, deltaCols, deltaRows, active.direction, GRID_COLUMNS);

      const currentBounds = {
        colStart: active.colStart,
        rowStart: active.rowStart,
        colSpan: active.colSpan,
        rowSpan: active.rowSpan,
      };

      if (boundsEqual(nextBounds, currentBounds)) {
        return;
      }

      setResizeState({
        ...active,
        ...nextBounds,
      });
    }

    function handlePointerUp() {
      const active = resizeStateRef.current;
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

      setResizeState(null);
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [resizeState, setSectionLayouts]);

  function startCardResize(
    sectionIndex: number,
    cardIndex: number,
    direction: ResizeHandleDirection,
    event: ReactPointerEvent<HTMLElement>
  ) {
    const metrics = sectionMetrics[sectionIndex] ?? FALLBACK_METRICS;
    const cardLayout = sectionLayouts[sectionIndex].cards[cardIndex];

    event.preventDefault();
    event.stopPropagation();

    setResizeState({
      sectionIndex,
      cardIndex,
      direction,
      colStart: cardLayout.colStart,
      rowStart: cardLayout.rowStart,
      colSpan: cardLayout.colSpan,
      rowSpan: cardLayout.rowSpan,
      startClientX: event.clientX,
      startClientY: event.clientY,
      originColStart: cardLayout.colStart,
      originRowStart: cardLayout.rowStart,
      originColSpan: cardLayout.colSpan,
      originRowSpan: cardLayout.rowSpan,
      unitSize: metrics.unitSize,
    });
  }

  return {
    resizeState,
    startCardResize,
  };
}
