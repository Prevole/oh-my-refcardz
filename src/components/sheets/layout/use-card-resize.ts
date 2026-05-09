"use client";

import { useEffect, useRef, useState } from "react";
import type { Dispatch, PointerEvent as ReactPointerEvent, SetStateAction } from "react";
import { GRID_GAP_PX, GRID_COLUMNS } from "../sheet-grid";
import { resolveBlockLayout } from "./layout-algorithms";
import { calculateResizeBounds, boundsEqual } from "./resize-calculations";
import type { BlockLayoutState, GridMetricsState, ResizeHandleDirection, ResizeState } from "./layout-types";
import { FALLBACK_METRICS } from "./layout-types";

export type UseCardResizeResult = {
  resizeState: ResizeState | null;
  startBlockResize: (
    blockId: string,
    direction: ResizeHandleDirection,
    event: ReactPointerEvent<HTMLElement>
  ) => void;
};

export function useCardResize(
  blockLayouts: BlockLayoutState[],
  setBlockLayouts: Dispatch<SetStateAction<BlockLayoutState[]>>,
  gridMetrics: GridMetricsState
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

      setResizeState({ ...active, ...nextBounds });
    }

    function handlePointerUp() {
      const active = resizeStateRef.current;
      if (!active) return;

      setBlockLayouts((currentLayouts) =>
        resolveBlockLayout(currentLayouts, active.blockId, {
          colStart: active.colStart,
          rowStart: active.rowStart,
          colSpan: active.colSpan,
          rowSpan: active.rowSpan,
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
  }, [resizeState, setBlockLayouts]);

  function startBlockResize(blockId: string, direction: ResizeHandleDirection, event: ReactPointerEvent<HTMLElement>) {
    const metrics = gridMetrics ?? FALLBACK_METRICS;
    const blockLayout = blockLayouts.find((layout) => layout.id === blockId);
    if (!blockLayout) return;

    event.preventDefault();
    event.stopPropagation();

    setResizeState({
      blockId,
      direction,
      colStart: blockLayout.colStart,
      rowStart: blockLayout.rowStart,
      colSpan: blockLayout.colSpan,
      rowSpan: blockLayout.rowSpan,
      startClientX: event.clientX,
      startClientY: event.clientY,
      originColStart: blockLayout.colStart,
      originRowStart: blockLayout.rowStart,
      originColSpan: blockLayout.colSpan,
      originRowSpan: blockLayout.rowSpan,
      unitSize: metrics.unitSize,
    });
  }

  return {
    resizeState,
    startBlockResize,
  };
}
