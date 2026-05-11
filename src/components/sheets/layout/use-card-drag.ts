"use client";

import { useEffect, useRef, useState } from "react";
import type { Dispatch, PointerEvent as ReactPointerEvent, SetStateAction } from "react";
import { GRID_GAP_PX } from "../sheet-grid";
import { calculateAutoScrollSpeed } from "./auto-scroll";
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
  const autoScrollFrameRef = useRef<number | null>(null);
  const lastPointerRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  useEffect(() => {
    dragStateRef.current = dragState;
  }, [dragState]);

  useEffect(() => {
    if (!dragState) return;

    function updateDragPosition(clientX: number, clientY: number) {
      const active = dragStateRef.current;
      if (!active) return;

      // Recalculate gridRect to account for scroll changes
      const grid = document.querySelector("[data-sheet-grid]");
      if (!(grid instanceof HTMLElement)) return;

      const gridRect = grid.getBoundingClientRect();

      const nextPosition = pointerToGridPosition(
        clientX - active.pointerOffsetX,
        clientY - active.pointerOffsetY,
        gridRect,
        active.unitSize,
        active.colSpan
      );

      // Always update gridRect even if position hasn't changed (scroll may have moved it)
      if (
        nextPosition.colStart !== active.colStart ||
        nextPosition.rowStart !== active.rowStart ||
        gridRect.top !== active.gridRect.top
      ) {
        setDragState({ ...active, ...nextPosition, gridRect });
      }
    }

    function runAutoScroll() {
      const scrollSpeed = calculateAutoScrollSpeed(lastPointerRef.current.y, window.innerHeight);

      if (scrollSpeed !== 0) {
        window.scrollBy(0, scrollSpeed);
        // Update drag position after scroll to keep card following pointer
        updateDragPosition(lastPointerRef.current.x, lastPointerRef.current.y);
      }

      autoScrollFrameRef.current = requestAnimationFrame(runAutoScroll);
    }

    function handlePointerMove(event: PointerEvent) {
      lastPointerRef.current = { x: event.clientX, y: event.clientY };
      updateDragPosition(event.clientX, event.clientY);
    }

    function handlePointerUp() {
      const active = dragStateRef.current;
      if (!active) return;

      if (autoScrollFrameRef.current !== null) {
        cancelAnimationFrame(autoScrollFrameRef.current);
        autoScrollFrameRef.current = null;
      }

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

    // Start auto-scroll loop
    autoScrollFrameRef.current = requestAnimationFrame(runAutoScroll);

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);

    return () => {
      if (autoScrollFrameRef.current !== null) {
        cancelAnimationFrame(autoScrollFrameRef.current);
        autoScrollFrameRef.current = null;
      }
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
