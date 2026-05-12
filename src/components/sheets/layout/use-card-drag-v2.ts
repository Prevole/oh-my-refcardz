"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import type { LayoutBlock, MoveIntent } from "@/lib/layout/solver/types";
import { GRID_GAP_PX } from "../sheet-grid";
import { calculateAutoScrollSpeed } from "./auto-scroll";
import type { GridMetricsState } from "./layout-types";
import { FALLBACK_METRICS } from "./layout-types";

/**
 * State tracked during a drag operation.
 */
export type DragStateV2 = {
  /** The block being dragged */
  blockId: string;
  /** Grid rect at drag start (for coordinate calculations) */
  gridRect: DOMRect;
  /** Unit size at drag start */
  unitSize: number;
  /** Offset from pointer to block top-left corner (in pixels) */
  pointerOffsetX: number;
  pointerOffsetY: number;
  /** Original block position (0-indexed) */
  originX: number;
  originY: number;
  /** Block dimensions */
  width: number;
  height: number;
  /** Current computed position (0-indexed) */
  currentX: number;
  currentY: number;
};

/**
 * Result of the useCardDragV2 hook.
 */
export type UseCardDragV2Result = {
  /** Current drag state, if any */
  dragState: DragStateV2 | null;
  /** Start dragging a block */
  startBlockDrag: (blockId: string, event: ReactPointerEvent<HTMLElement>) => void;
};

type UseCardDragV2Options = {
  /** Current layout blocks */
  blocks: LayoutBlock[];
  /** Grid metrics for coordinate calculations */
  gridMetrics: GridMetricsState;
  /** Called when drag starts */
  onDragStart?: (blockId: string) => void;
  /** Called during drag with the current move intent */
  onDragMove?: (intent: MoveIntent) => void;
  /** Called when drag ends */
  onDragEnd?: () => void;
  /** Called when drag is cancelled */
  onDragCancel?: () => void;
};

/**
 * Convert pointer position to grid coordinates.
 */
function pointerToGridCoords(
  clientX: number,
  clientY: number,
  gridRect: DOMRect,
  unitSize: number,
  offsetX: number,
  offsetY: number
): { x: number; y: number } {
  const pitch = unitSize + GRID_GAP_PX;
  const blockLeft = clientX - offsetX - gridRect.left;
  const blockTop = clientY - offsetY - gridRect.top;
  const x = Math.round(blockLeft / pitch);
  const y = Math.round(blockTop / pitch);
  return { x: Math.max(0, x), y: Math.max(0, y) };
}

/**
 * Hook for handling card drag interactions.
 *
 * This hook:
 * - Captures pointer events to start/track/end drag
 * - Converts pointer positions to grid coordinates
 * - Produces MoveIntent for the solver
 * - Handles auto-scrolling near viewport edges
 *
 * The hook does NOT directly modify the layout. It only produces intents
 * that the parent component passes to the layout editor.
 */
export function useCardDragV2({
  blocks,
  gridMetrics,
  onDragStart,
  onDragMove,
  onDragEnd,
  onDragCancel,
}: UseCardDragV2Options): UseCardDragV2Result {
  // Use state for the drag state that needs to trigger re-renders
  const [dragState, setDragState] = useState<DragStateV2 | null>(null);

  // Refs for internal tracking that don't need to trigger re-renders
  const dragStateRef = useRef<DragStateV2 | null>(null);
  const autoScrollFrameRef = useRef<number | null>(null);
  const lastPointerRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const callbacksRef = useRef({ onDragStart, onDragMove, onDragEnd, onDragCancel });

  // Keep callbacks ref up to date
  useEffect(() => {
    callbacksRef.current = { onDragStart, onDragMove, onDragEnd, onDragCancel };
  }, [onDragStart, onDragMove, onDragEnd, onDragCancel]);

  // Sync state to ref for use in event handlers
  useEffect(() => {
    dragStateRef.current = dragState;
  }, [dragState]);

  // Set up global pointer listeners when dragging
  useEffect(() => {
    if (!dragState) return;

    function updateDragPosition(clientX: number, clientY: number) {
      const active = dragStateRef.current;
      if (!active) return;

      const grid = document.querySelector("[data-sheet-grid]");
      if (!(grid instanceof HTMLElement)) return;
      const gridRect = grid.getBoundingClientRect();

      const coords = pointerToGridCoords(
        clientX,
        clientY,
        gridRect,
        active.unitSize,
        active.pointerOffsetX,
        active.pointerOffsetY
      );

      if (coords.x !== active.currentX || coords.y !== active.currentY) {
        const updatedState = {
          ...active,
          currentX: coords.x,
          currentY: coords.y,
          gridRect,
        };
        setDragState(updatedState);

        const intent: MoveIntent = {
          type: "move",
          blockId: active.blockId,
          x: coords.x,
          y: coords.y,
        };
        callbacksRef.current.onDragMove?.(intent);
      }
    }

    function runAutoScroll() {
      const scrollSpeed = calculateAutoScrollSpeed(lastPointerRef.current.y, window.innerHeight);
      if (scrollSpeed !== 0) {
        window.scrollBy(0, scrollSpeed);
        updateDragPosition(lastPointerRef.current.x, lastPointerRef.current.y);
      }
      autoScrollFrameRef.current = requestAnimationFrame(runAutoScroll);
    }

    function handlePointerMove(event: PointerEvent) {
      lastPointerRef.current = { x: event.clientX, y: event.clientY };
      updateDragPosition(event.clientX, event.clientY);
    }

    function handlePointerUp() {
      if (autoScrollFrameRef.current !== null) {
        cancelAnimationFrame(autoScrollFrameRef.current);
        autoScrollFrameRef.current = null;
      }
      setDragState(null);
      callbacksRef.current.onDragEnd?.();
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        if (autoScrollFrameRef.current !== null) {
          cancelAnimationFrame(autoScrollFrameRef.current);
          autoScrollFrameRef.current = null;
        }
        setDragState(null);
        callbacksRef.current.onDragCancel?.();
      }
    }

    autoScrollFrameRef.current = requestAnimationFrame(runAutoScroll);

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      if (autoScrollFrameRef.current !== null) {
        cancelAnimationFrame(autoScrollFrameRef.current);
        autoScrollFrameRef.current = null;
      }
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [dragState]);

  const startBlockDrag = useCallback(
    (blockId: string, event: ReactPointerEvent<HTMLElement>) => {
      if ((event.target as HTMLElement).closest("[data-card-layout-controls]")) return;
      if ((event.target as HTMLElement).closest("[data-card-resize-handle]")) return;

      const grid = event.currentTarget.closest("[data-sheet-grid]");
      if (!(grid instanceof HTMLElement)) return;

      const metrics = gridMetrics ?? FALLBACK_METRICS;
      const block = blocks.find((b) => b.id === blockId);
      if (!block) return;

      const gridRect = grid.getBoundingClientRect();
      const pitch = metrics.unitSize + GRID_GAP_PX;

      const blockLeft = gridRect.left + block.position.x * pitch;
      const blockTop = gridRect.top + block.position.y * pitch;
      const pointerOffsetX = event.clientX - blockLeft;
      const pointerOffsetY = event.clientY - blockTop;

      event.preventDefault();

      const state: DragStateV2 = {
        blockId,
        gridRect,
        unitSize: metrics.unitSize,
        pointerOffsetX,
        pointerOffsetY,
        originX: block.position.x,
        originY: block.position.y,
        width: block.position.w,
        height: block.position.h,
        currentX: block.position.x,
        currentY: block.position.y,
      };

      setDragState(state);
      lastPointerRef.current = { x: event.clientX, y: event.clientY };
      callbacksRef.current.onDragStart?.(blockId);
    },
    [blocks, gridMetrics]
  );

  return {
    dragState,
    startBlockDrag,
  };
}
