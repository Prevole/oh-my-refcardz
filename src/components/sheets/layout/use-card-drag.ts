"use client";

import { useEffect, useRef, useState } from "react";
import type { Dispatch, PointerEvent as ReactPointerEvent, SetStateAction } from "react";
import { GRID_GAP_PX } from "../sheet-grid";
import { pointerToGridPosition, resolveBlockLayout } from "./layout-algorithms";
import type { BlockLayoutState, DragState, GridMetricsState } from "./layout-types";
import { FALLBACK_METRICS } from "./layout-types";

export type UseCardDragResult = {
  dragState: DragState | null;
  startBlockDrag: (blockId: string, event: ReactPointerEvent<HTMLElement>) => void;
};

export function useCardDrag(
  blockLayouts: BlockLayoutState[],
  setBlockLayouts: Dispatch<SetStateAction<BlockLayoutState[]>>,
  gridMetrics: GridMetricsState
): UseCardDragResult {
  const [dragState, setDragState] = useState<DragState | null>(null);
  const dragStateRef = useRef<DragState | null>(null);

  useEffect(() => {
    dragStateRef.current = dragState;
  }, [dragState]);

  useEffect(() => {
    if (!dragState) return;

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

      setBlockLayouts((currentLayouts) =>
        resolveBlockLayout(currentLayouts, active.blockId, {
          colStart: active.colStart,
          rowStart: active.rowStart,
          colSpan: active.colSpan,
          rowSpan: active.rowSpan,
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
  }, [dragState, setBlockLayouts]);

  function startBlockDrag(blockId: string, event: ReactPointerEvent<HTMLElement>) {
    if ((event.target as HTMLElement).closest("[data-card-layout-controls]")) return;
    if ((event.target as HTMLElement).closest("[data-card-resize-handle]")) return;

    const grid = event.currentTarget.closest("[data-sheet-grid]");
    if (!(grid instanceof HTMLElement)) return;

    const metrics = gridMetrics ?? FALLBACK_METRICS;
    const blockLayout = blockLayouts.find((layout) => layout.id === blockId);
    if (!blockLayout) return;

    const gridRect = grid.getBoundingClientRect();

    event.preventDefault();

    setDragState({
      blockId,
      colStart: blockLayout.colStart,
      rowStart: blockLayout.rowStart,
      colSpan: blockLayout.colSpan,
      rowSpan: blockLayout.rowSpan,
      gridRect,
      unitSize: metrics.unitSize,
      pointerOffsetX: event.clientX - (gridRect.left + (blockLayout.colStart - 1) * (metrics.unitSize + GRID_GAP_PX)),
      pointerOffsetY: event.clientY - (gridRect.top + (blockLayout.rowStart - 1) * (metrics.unitSize + GRID_GAP_PX)),
    });
  }

  return {
    dragState,
    startBlockDrag,
  };
}
