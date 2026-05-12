"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import type { LayoutBlock, ResizeDirection, ResizeIntent } from "@/lib/layout/solver/types";
import { GRID_GAP_PX } from "../sheet-grid";
import { isResizeDirectionEnabled, type ResizeHandleDirection } from "./block-types";
import type { GridMetricsState } from "./layout-types";
import { FALLBACK_METRICS } from "./layout-types";

/**
 * State tracked during a resize operation.
 */
export type ResizeStateV2 = {
  /** The block being resized */
  blockId: string;
  /** The resize direction */
  direction: ResizeDirection;
  /** Unit size at resize start */
  unitSize: number;
  /** Pointer position at resize start */
  startClientX: number;
  startClientY: number;
  /** Block position/size at resize start (0-indexed) */
  originX: number;
  originY: number;
  originW: number;
  originH: number;
  /** Current computed delta */
  currentDelta: number;
  /** Whether compact mode is active (shift key) */
  compact: boolean;
};

/**
 * Result of the useCardResizeV2 hook.
 */
export type UseCardResizeV2Result = {
  /** Current resize state, if any */
  resizeState: ResizeStateV2 | null;
  /** Start resizing a block */
  startBlockResize: (blockId: string, direction: ResizeHandleDirection, event: ReactPointerEvent<HTMLElement>) => void;
};

type UseCardResizeV2Options = {
  /** Current layout blocks */
  blocks: LayoutBlock[];
  /** Grid metrics for coordinate calculations */
  gridMetrics: GridMetricsState;
  /** Called when resize starts */
  onResizeStart?: (blockId: string) => void;
  /** Called during resize with the current resize intent */
  onResizeMove?: (intent: ResizeIntent) => void;
  /** Called when resize ends */
  onResizeEnd?: () => void;
  /** Called when resize is cancelled */
  onResizeCancel?: () => void;
};

/**
 * Convert a ResizeHandleDirection to a cardinal ResizeDirection.
 */
function toCardinalDirection(handleDirection: ResizeHandleDirection): ResizeDirection {
  switch (handleDirection) {
    case "north":
    case "north-east":
    case "north-west":
      return "north";
    case "south":
    case "south-east":
    case "south-west":
      return "south";
    case "east":
      return "east";
    case "west":
      return "west";
  }
}

/**
 * Calculate delta in grid units based on direction and pointer movement.
 */
function calculateDelta(
  direction: ResizeDirection,
  deltaXPx: number,
  deltaYPx: number,
  pitch: number
): number {
  switch (direction) {
    case "north":
      return -Math.round(deltaYPx / pitch);
    case "south":
      return Math.round(deltaYPx / pitch);
    case "east":
      return Math.round(deltaXPx / pitch);
    case "west":
      return -Math.round(deltaXPx / pitch);
  }
}

/**
 * Hook for handling card resize interactions.
 *
 * This hook:
 * - Captures pointer events to start/track/end resize
 * - Converts pointer deltas to grid units
 * - Produces ResizeIntent for the solver
 * - Tracks Shift key for compact mode
 *
 * The hook does NOT directly modify the layout. It only produces intents
 * that the parent component passes to the layout editor.
 */
export function useCardResizeV2({
  blocks,
  gridMetrics,
  onResizeStart,
  onResizeMove,
  onResizeEnd,
  onResizeCancel,
}: UseCardResizeV2Options): UseCardResizeV2Result {
  // Use state for the resize state that needs to trigger re-renders
  const [resizeState, setResizeState] = useState<ResizeStateV2 | null>(null);

  // Refs for internal tracking
  const resizeStateRef = useRef<ResizeStateV2 | null>(null);
  const callbacksRef = useRef({ onResizeStart, onResizeMove, onResizeEnd, onResizeCancel });

  // Keep callbacks ref up to date
  useEffect(() => {
    callbacksRef.current = { onResizeStart, onResizeMove, onResizeEnd, onResizeCancel };
  }, [onResizeStart, onResizeMove, onResizeEnd, onResizeCancel]);

  // Sync state to ref for use in event handlers
  useEffect(() => {
    resizeStateRef.current = resizeState;
  }, [resizeState]);

  // Set up global pointer listeners when resizing
  useEffect(() => {
    if (!resizeState) return;

    function handlePointerMove(event: PointerEvent) {
      const active = resizeStateRef.current;
      if (!active) return;

      const pitch = active.unitSize + GRID_GAP_PX;
      const deltaXPx = event.clientX - active.startClientX;
      const deltaYPx = event.clientY - active.startClientY;

      const delta = calculateDelta(active.direction, deltaXPx, deltaYPx, pitch);
      const compact = event.shiftKey;

      if (delta !== active.currentDelta || compact !== active.compact) {
        const updatedState = {
          ...active,
          currentDelta: delta,
          compact,
        };
        setResizeState(updatedState);

        const intent: ResizeIntent = {
          type: "resize",
          blockId: active.blockId,
          direction: active.direction,
          delta,
          compact,
        };
        callbacksRef.current.onResizeMove?.(intent);
      }
    }

    function handlePointerUp() {
      setResizeState(null);
      callbacksRef.current.onResizeEnd?.();
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setResizeState(null);
        callbacksRef.current.onResizeCancel?.();
        return;
      }

      if (event.key === "Shift") {
        const active = resizeStateRef.current;
        if (active && !active.compact) {
          const updatedState = { ...active, compact: true };
          setResizeState(updatedState);

          const intent: ResizeIntent = {
            type: "resize",
            blockId: active.blockId,
            direction: active.direction,
            delta: active.currentDelta,
            compact: true,
          };
          callbacksRef.current.onResizeMove?.(intent);
        }
      }
    }

    function handleKeyUp(event: KeyboardEvent) {
      if (event.key === "Shift") {
        const active = resizeStateRef.current;
        if (active && active.compact) {
          const updatedState = { ...active, compact: false };
          setResizeState(updatedState);

          const intent: ResizeIntent = {
            type: "resize",
            blockId: active.blockId,
            direction: active.direction,
            delta: active.currentDelta,
            compact: false,
          };
          callbacksRef.current.onResizeMove?.(intent);
        }
      }
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [resizeState]);

  const startBlockResize = useCallback(
    (blockId: string, handleDirection: ResizeHandleDirection, event: ReactPointerEvent<HTMLElement>) => {
      const block = blocks.find((b) => b.id === blockId);
      if (!block) return;

      if (!isResizeDirectionEnabled(block.kind, handleDirection)) {
        return;
      }

      const direction = toCardinalDirection(handleDirection);
      const metrics = gridMetrics ?? FALLBACK_METRICS;

      event.preventDefault();
      event.stopPropagation();

      const state: ResizeStateV2 = {
        blockId,
        direction,
        unitSize: metrics.unitSize,
        startClientX: event.clientX,
        startClientY: event.clientY,
        originX: block.position.x,
        originY: block.position.y,
        originW: block.position.w,
        originH: block.position.h,
        currentDelta: 0,
        compact: event.shiftKey,
      };

      setResizeState(state);
      callbacksRef.current.onResizeStart?.(blockId);
    },
    [blocks, gridMetrics]
  );

  return {
    resizeState,
    startBlockResize,
  };
}
