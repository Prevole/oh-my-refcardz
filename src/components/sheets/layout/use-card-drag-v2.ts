"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import type { LayoutBlock } from "@/lib/layout/engine";
import { GRID_GAP_PX } from "../sheet-grid";
import { calculateAutoScrollSpeed } from "./auto-scroll";
import type { GridMetricsState } from "./layout-types";
import { FALLBACK_METRICS } from "./layout-types";

/**
 * Drag input emitted on every cell crossing.
 * The consumer (sheet-renderer) is responsible for translating this into an
 * engine MoveOperation against the interaction snapshot.
 */
export type DragMove = {
  blockId: string;
  /** Cumulative delta in grid cells since the drag started. */
  dx: number;
  dy: number;
  /** Strict mode (Alt key) — engine should refuse to shrink neighbors. */
  strict: boolean;
};

export type DragStateV2 = {
  blockId: string;
  /** Origin in grid cells at drag start. */
  originX: number;
  originY: number;
  /** Current cumulative delta in grid cells (for UI feedback). */
  dx: number;
  dy: number;
};

export type UseCardDragV2Result = {
  dragState: DragStateV2 | null;
  startBlockDrag: (blockId: string, event: ReactPointerEvent<HTMLElement>) => void;
};

type UseCardDragV2Options = {
  blocks: LayoutBlock[];
  gridMetrics: GridMetricsState;
  onDragStart?: (blockId: string) => void;
  onDragMove?: (move: DragMove) => void;
  onDragEnd?: () => void;
  onDragCancel?: () => void;
};

/**
 * Convert pointer (clientX, clientY) into grid cell coordinates.
 * The pointer offset compensates for the click position inside the block.
 */
function pointerToGridCoords(
  clientX: number,
  clientY: number,
  gridRect: DOMRect,
  unitSize: number,
  offsetX: number,
  offsetY: number
): { cellX: number; cellY: number } {
  const pitch = unitSize + GRID_GAP_PX;
  const blockLeftPx = clientX - offsetX - gridRect.left;
  const blockTopPx = clientY - offsetY - gridRect.top;
  return {
    cellX: Math.max(0, Math.round(blockLeftPx / pitch)),
    cellY: Math.max(0, Math.round(blockTopPx / pitch)),
  };
}

type InternalDragState = {
  blockId: string;
  unitSize: number;
  pointerOffsetX: number;
  pointerOffsetY: number;
  originX: number;
  originY: number;
  lastCellX: number;
  lastCellY: number;
};

export function useCardDragV2({
  blocks,
  gridMetrics,
  onDragStart,
  onDragMove,
  onDragEnd,
  onDragCancel,
}: UseCardDragV2Options): UseCardDragV2Result {
  const [dragState, setDragState] = useState<DragStateV2 | null>(null);

  const internalRef = useRef<InternalDragState | null>(null);
  const autoScrollFrameRef = useRef<number | null>(null);
  const lastPointerRef = useRef<{ x: number; y: number; altKey: boolean }>({ x: 0, y: 0, altKey: false });
  const callbacksRef = useRef({ onDragStart, onDragMove, onDragEnd, onDragCancel });

  useEffect(() => {
    callbacksRef.current = { onDragStart, onDragMove, onDragEnd, onDragCancel };
  }, [onDragStart, onDragMove, onDragEnd, onDragCancel]);

  useEffect(() => {
    if (!dragState) return;

    function getGridRect(): DOMRect | null {
      const grid = document.querySelector("[data-sheet-grid]");
      if (!(grid instanceof HTMLElement)) return null;
      return grid.getBoundingClientRect();
    }

    function updateFromPointer(clientX: number, clientY: number, altKey: boolean) {
      const internal = internalRef.current;
      if (!internal) return;

      const gridRect = getGridRect();
      if (!gridRect) return;

      const { cellX, cellY } = pointerToGridCoords(
        clientX,
        clientY,
        gridRect,
        internal.unitSize,
        internal.pointerOffsetX,
        internal.pointerOffsetY
      );

      if (cellX === internal.lastCellX && cellY === internal.lastCellY) {
        // No cell boundary crossed; skip engine call.
        return;
      }

      internal.lastCellX = cellX;
      internal.lastCellY = cellY;

      const dx = cellX - internal.originX;
      const dy = cellY - internal.originY;

      setDragState({
        blockId: internal.blockId,
        originX: internal.originX,
        originY: internal.originY,
        dx,
        dy,
      });

      callbacksRef.current.onDragMove?.({
        blockId: internal.blockId,
        dx,
        dy,
        strict: altKey,
      });
    }

    function runAutoScroll() {
      const speed = calculateAutoScrollSpeed(lastPointerRef.current.y, window.innerHeight);
      if (speed !== 0) {
        window.scrollBy(0, speed);
        updateFromPointer(
          lastPointerRef.current.x,
          lastPointerRef.current.y,
          lastPointerRef.current.altKey
        );
      }
      autoScrollFrameRef.current = requestAnimationFrame(runAutoScroll);
    }

    function handlePointerMove(event: PointerEvent) {
      lastPointerRef.current = { x: event.clientX, y: event.clientY, altKey: event.altKey };
      updateFromPointer(event.clientX, event.clientY, event.altKey);
    }

    function cleanupAutoScroll() {
      if (autoScrollFrameRef.current !== null) {
        cancelAnimationFrame(autoScrollFrameRef.current);
        autoScrollFrameRef.current = null;
      }
    }

    function handlePointerUp() {
      cleanupAutoScroll();
      internalRef.current = null;
      setDragState(null);
      callbacksRef.current.onDragEnd?.();
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        cleanupAutoScroll();
        internalRef.current = null;
        setDragState(null);
        callbacksRef.current.onDragCancel?.();
        return;
      }
      if (event.key === "Alt") {
        lastPointerRef.current = { ...lastPointerRef.current, altKey: true };
        // Re-evaluate even if the pointer didn't move — strict mode change can
        // alter the engine's behavior, but it does not move the pointer to a
        // new cell. We still re-emit the current cumulative delta to allow the
        // editor to recompute with the new flag.
        const internal = internalRef.current;
        if (internal) {
          callbacksRef.current.onDragMove?.({
            blockId: internal.blockId,
            dx: internal.lastCellX - internal.originX,
            dy: internal.lastCellY - internal.originY,
            strict: true,
          });
        }
      }
    }

    function handleKeyUp(event: KeyboardEvent) {
      if (event.key === "Alt") {
        lastPointerRef.current = { ...lastPointerRef.current, altKey: false };
        const internal = internalRef.current;
        if (internal) {
          callbacksRef.current.onDragMove?.({
            blockId: internal.blockId,
            dx: internal.lastCellX - internal.originX,
            dy: internal.lastCellY - internal.originY,
            strict: false,
          });
        }
      }
    }

    autoScrollFrameRef.current = requestAnimationFrame(runAutoScroll);

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      cleanupAutoScroll();
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [dragState]);

  const startBlockDrag = useCallback(
    (blockId: string, event: ReactPointerEvent<HTMLElement>) => {
      const target = event.target as HTMLElement;
      if (target.closest("[data-card-layout-controls]")) return;
      if (target.closest("[data-card-resize-handle]")) return;

      const grid = event.currentTarget.closest("[data-sheet-grid]");
      if (!(grid instanceof HTMLElement)) return;

      const block = blocks.find((b) => b.id === blockId);
      if (!block) return;

      const metrics = gridMetrics ?? FALLBACK_METRICS;
      const gridRect = grid.getBoundingClientRect();
      const pitch = metrics.unitSize + GRID_GAP_PX;

      const blockLeftPx = gridRect.left + block.position.x * pitch;
      const blockTopPx = gridRect.top + block.position.y * pitch;
      const pointerOffsetX = event.clientX - blockLeftPx;
      const pointerOffsetY = event.clientY - blockTopPx;

      event.preventDefault();

      internalRef.current = {
        blockId,
        unitSize: metrics.unitSize,
        pointerOffsetX,
        pointerOffsetY,
        originX: block.position.x,
        originY: block.position.y,
        lastCellX: block.position.x,
        lastCellY: block.position.y,
      };

      setDragState({
        blockId,
        originX: block.position.x,
        originY: block.position.y,
        dx: 0,
        dy: 0,
      });

      lastPointerRef.current = { x: event.clientX, y: event.clientY, altKey: event.altKey };
      callbacksRef.current.onDragStart?.(blockId);
    },
    [blocks, gridMetrics]
  );

  return {
    dragState,
    startBlockDrag,
  };
}
