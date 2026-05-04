"use client";

import { useEffect, useRef, useState } from "react";
import type { Dispatch, PointerEvent as ReactPointerEvent, SetStateAction } from "react";
import { GRID_GAP_PX, GRID_COLUMNS } from "../sheet-grid";
import { clamp, resolveSectionLayout } from "./layout-algorithms";
import type { ResizeHandleDirection, ResizeState, SectionLayoutState, SectionMetricsState } from "./layout-types";
import { FALLBACK_METRICS, MAX_ROW_SPAN } from "./layout-types";

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

      let nextColStart = active.originColStart;
      let nextRowStart = active.originRowStart;
      let nextColSpan = active.originColSpan;
      let nextRowSpan = active.originRowSpan;

      if (active.direction === "east" || active.direction === "north-east" || active.direction === "south-east") {
        nextColSpan = clamp(active.originColSpan + deltaCols, 1, GRID_COLUMNS - active.originColStart + 1);
      }

      if (active.direction === "south" || active.direction === "south-east" || active.direction === "south-west") {
        nextRowSpan = clamp(active.originRowSpan + deltaRows, 1, MAX_ROW_SPAN);
      }

      if (active.direction === "west" || active.direction === "north-west" || active.direction === "south-west") {
        const maxColStart = active.originColStart + active.originColSpan - 1;
        nextColStart = clamp(active.originColStart + deltaCols, 1, maxColStart);
        nextColSpan = clamp(active.originColSpan + (active.originColStart - nextColStart), 1, GRID_COLUMNS);
      }

      if (active.direction === "north" || active.direction === "north-east" || active.direction === "north-west") {
        const maxRowStart = active.originRowStart + active.originRowSpan - 1;
        nextRowStart = clamp(active.originRowStart + deltaRows, 1, maxRowStart);
        nextRowSpan = clamp(active.originRowSpan + (active.originRowStart - nextRowStart), 1, MAX_ROW_SPAN);
      }

      if (
        nextColStart === active.colStart &&
        nextRowStart === active.rowStart &&
        nextColSpan === active.colSpan &&
        nextRowSpan === active.rowSpan
      ) {
        return;
      }

      setResizeState({
        ...active,
        colStart: nextColStart,
        rowStart: nextRowStart,
        colSpan: nextColSpan,
        rowSpan: nextRowSpan,
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
