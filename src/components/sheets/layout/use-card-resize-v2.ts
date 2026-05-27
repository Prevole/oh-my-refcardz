"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import type { Direction, LayoutBlock } from "@/lib/layout/engine";
import { GRID_GAP_PX } from "../sheet-grid";
import { isResizeDirectionEnabled, type ResizeHandleDirection } from "@/lib/layout/blocks";
import type { GridMetricsState } from "./layout-types";
import { FALLBACK_METRICS } from "./layout-types";

/**
 * Resize input emitted whenever the cumulative delta or modifier flags change.
 * The consumer translates this into an engine ResizeOperation against the
 * interaction snapshot.
 */
export type ResizeMove = {
  blockId: string;
  edge: Direction;
  /** Signed delta in grid cells from the resize origin, along the edge axis. */
  delta: number;
  /** Shift key — engine should attempt compact mode. */
  compact: boolean;
  /** Alt key — engine should run in strict mode. */
  strict: boolean;
};

export type ResizeStateV2 = {
  blockId: string;
  edge: Direction;
  delta: number;
  compact: boolean;
  strict: boolean;
};

export type UseCardResizeV2Result = {
  resizeState: ResizeStateV2 | null;
  startBlockResize: (
    blockId: string,
    handle: ResizeHandleDirection,
    event: ReactPointerEvent<HTMLElement>
  ) => void;
};

type UseCardResizeV2Options = {
  blocks: LayoutBlock[];
  gridMetrics: GridMetricsState;
  onResizeStart?: (blockId: string) => void;
  onResizeMove?: (move: ResizeMove) => void;
  onResizeEnd?: () => void;
  onResizeCancel?: () => void;
};

/**
 * Reduce diagonal handles to their dominant cardinal direction.
 * Diagonal directions are not supported by the engine; we project them to the
 * vertical edge by default (north for top-row diagonals, south for bottom-row).
 */
function toCardinalEdge(handle: ResizeHandleDirection): Direction {
  switch (handle) {
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
 * Compute the cumulative delta in grid cells along the edge's axis, given the
 * pixel offset from the resize origin.
 */
function computeDelta(edge: Direction, deltaXPx: number, deltaYPx: number, pitch: number): number {
  switch (edge) {
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

type InternalResizeState = {
  blockId: string;
  edge: Direction;
  unitSize: number;
  startClientX: number;
  startClientY: number;
  lastDelta: number;
  lastCompact: boolean;
  lastStrict: boolean;
};

export function useCardResizeV2({
  blocks,
  gridMetrics,
  onResizeStart,
  onResizeMove,
  onResizeEnd,
  onResizeCancel,
}: UseCardResizeV2Options): UseCardResizeV2Result {
  const [resizeState, setResizeState] = useState<ResizeStateV2 | null>(null);
  const internalRef = useRef<InternalResizeState | null>(null);
  const callbacksRef = useRef({ onResizeStart, onResizeMove, onResizeEnd, onResizeCancel });

  useEffect(() => {
    callbacksRef.current = { onResizeStart, onResizeMove, onResizeEnd, onResizeCancel };
  }, [onResizeStart, onResizeMove, onResizeEnd, onResizeCancel]);

  useEffect(() => {
    if (!resizeState) return;

    function emitIfChanged(delta: number, compact: boolean, strict: boolean) {
      const internal = internalRef.current;
      if (!internal) return;

      if (
        delta === internal.lastDelta &&
        compact === internal.lastCompact &&
        strict === internal.lastStrict
      ) {
        return;
      }

      internal.lastDelta = delta;
      internal.lastCompact = compact;
      internal.lastStrict = strict;

      setResizeState({
        blockId: internal.blockId,
        edge: internal.edge,
        delta,
        compact,
        strict,
      });

      callbacksRef.current.onResizeMove?.({
        blockId: internal.blockId,
        edge: internal.edge,
        delta,
        compact,
        strict,
      });
    }

    function handlePointerMove(event: PointerEvent) {
      const internal = internalRef.current;
      if (!internal) return;

      const pitch = internal.unitSize + GRID_GAP_PX;
      const deltaXPx = event.clientX - internal.startClientX;
      const deltaYPx = event.clientY - internal.startClientY;
      const delta = computeDelta(internal.edge, deltaXPx, deltaYPx, pitch);

      emitIfChanged(delta, event.shiftKey, event.altKey);
    }

    function handlePointerUp() {
      internalRef.current = null;
      setResizeState(null);
      callbacksRef.current.onResizeEnd?.();
    }

    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        internalRef.current = null;
        setResizeState(null);
        callbacksRef.current.onResizeCancel?.();
        return;
      }
      const internal = internalRef.current;
      if (!internal) return;
      // Re-emit on modifier change with the last known delta.
      if (event.key === "Shift" || event.key === "Alt") {
        emitIfChanged(internal.lastDelta, event.shiftKey, event.altKey);
      }
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("keydown", handleKey);
    window.addEventListener("keyup", handleKey);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("keydown", handleKey);
      window.removeEventListener("keyup", handleKey);
    };
  }, [resizeState]);

  const startBlockResize = useCallback(
    (blockId: string, handle: ResizeHandleDirection, event: ReactPointerEvent<HTMLElement>) => {
      const block = blocks.find((b) => b.id === blockId);
      if (!block) return;
      if (!isResizeDirectionEnabled(block.kind, handle)) return;

      const edge = toCardinalEdge(handle);
      const metrics = gridMetrics ?? FALLBACK_METRICS;

      event.preventDefault();
      event.stopPropagation();

      internalRef.current = {
        blockId,
        edge,
        unitSize: metrics.unitSize,
        startClientX: event.clientX,
        startClientY: event.clientY,
        lastDelta: 0,
        lastCompact: event.shiftKey,
        lastStrict: event.altKey,
      };

      setResizeState({
        blockId,
        edge,
        delta: 0,
        compact: event.shiftKey,
        strict: event.altKey,
      });

      callbacksRef.current.onResizeStart?.(blockId);
    },
    [blocks, gridMetrics]
  );

  return {
    resizeState,
    startBlockResize,
  };
}
