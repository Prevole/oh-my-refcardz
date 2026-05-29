/**
 * Layout engine types.
 *
 * See docs/layout-engine.md for the full contract.
 *
 * Coordinates are 0-indexed. A block at (x, y) with size (w, h) occupies
 * the half-open rectangle [x, x+w) x [y, y+h).
 */

// -----------------------------------------------------------------------------
// Grid Position
// -----------------------------------------------------------------------------

export type GridPosition = {
  x: number;
  y: number;
  w: number;
  h: number;
};

// -----------------------------------------------------------------------------
// Blocks
// -----------------------------------------------------------------------------

export type LayoutBlockKind = "heading" | "card";

export type LayoutBlock = {
  id: string;
  kind: LayoutBlockKind;
  position: GridPosition;
};

// -----------------------------------------------------------------------------
// Directions and Axes
// -----------------------------------------------------------------------------

export type Direction = "north" | "south" | "east" | "west";

export type Axis = "vertical" | "horizontal";

export function axisOf(direction: Direction): Axis {
  return direction === "north" || direction === "south" ? "vertical" : "horizontal";
}

export function oppositeDirection(direction: Direction): Direction {
  switch (direction) {
    case "north":
      return "south";
    case "south":
      return "north";
    case "east":
      return "west";
    case "west":
      return "east";
  }
}

// -----------------------------------------------------------------------------
// Constraints
// -----------------------------------------------------------------------------

export type BlockConstraints = {
  minW: number;
  minH: number;
  maxW?: number;
  maxH?: number;
  allowedResizeDirections: Direction[];
};

// -----------------------------------------------------------------------------
// Operations
// -----------------------------------------------------------------------------

export type OperationOptions = {
  /**
   * When false, a step requiring wrap is rejected instead of applied.
   * Default: true.
   */
  allowWrap?: boolean;
  /**
   * When false, a step requiring shrink of a neighbor is rejected.
   * Default: true.
   */
  allowShrink?: boolean;
  /**
   * Resize-shrink only. When true, neighbors on the opposite side are pulled
   * toward the primary into the freed space.
   * Default: false.
   */
  compact?: boolean;
};

export type MoveOperation = {
  kind: "move";
  blockId: string;
  dx: number;
  dy: number;
  options?: OperationOptions;
};

export type ResizeOperation = {
  kind: "resize";
  blockId: string;
  edge: Direction;
  delta: number;
  options?: OperationOptions;
};

export type Operation = MoveOperation | ResizeOperation;

// -----------------------------------------------------------------------------
// Result
// -----------------------------------------------------------------------------

export type OperationResult = {
  blocks: LayoutBlock[];
  accepted: boolean;
  appliedDx: number;
  appliedDy: number;
  appliedDelta: number;
  affected: {
    moved: Set<string>;
    shrunk: Map<string, { w: number; h: number }>;
    wrapped: Set<string>;
  };
  rejected?: { reason: string };
};

// -----------------------------------------------------------------------------
// Engine Events
// -----------------------------------------------------------------------------

export type EventCause =
  | { kind: "primary" }
  | { kind: "push"; sourceId: string }
  | { kind: "shrink-cascade"; sourceId: string }
  | { kind: "wrap-axis"; axis: "x" | "y" }
  | { kind: "wrap-fallback-south" }
  | { kind: "compact"; sourceId: string };

export type EngineEvent =
  | {
      type: "session.start";
      opId: string;
      operation: Operation;
      initial: LayoutBlock[];
    }
  | {
      type: "session.end";
      opId: string;
      accepted: boolean;
      final: LayoutBlock[];
    }
  | {
      type: "step.start";
      opId: string;
      stepIndex: number;
      direction: Direction;
    }
  | {
      type: "step.end";
      opId: string;
      stepIndex: number;
      accepted: boolean;
    }
  | {
      type: "chain.computed";
      opId: string;
      stepIndex: number;
      direction: Direction;
      members: string[];
    }
  | {
      type: "block.move";
      opId: string;
      stepIndex: number;
      blockId: string;
      from: GridPosition;
      to: GridPosition;
      cause: EventCause;
    }
  | {
      type: "block.shrink";
      opId: string;
      stepIndex: number;
      blockId: string;
      fromSize: { w: number; h: number };
      toSize: { w: number; h: number };
      cause: EventCause;
    }
  | {
      type: "block.wrap";
      opId: string;
      stepIndex: number;
      blockId: string;
      from: GridPosition;
      to: GridPosition;
      restoredSize: { w: number; h: number };
      cause: EventCause;
    }
  | {
      type: "block.resize";
      opId: string;
      stepIndex: number;
      blockId: string;
      from: GridPosition;
      to: GridPosition;
      fromSize: { w: number; h: number };
      toSize: { w: number; h: number };
      edge: Direction;
      delta: number;
      cause: EventCause;
    }
  | {
      type: "block.reject";
      opId: string;
      stepIndex: number;
      blockId: string;
      reason: string;
    }
  | {
      /**
       * Emitted by EngineSession when a step would land the primary on a
       * footprint already seen during the session: instead of recomputing
       * the resolution, the cached snapshot for that footprint is restored.
       *
       * `cacheKey` is the unique identifier of the restored snapshot
       * (`${primaryId}:${x}:${y}:${w}:${h}`).
       */
      type: "session.restore";
      opId: string;
      stepIndex: number;
      primaryId: string;
      cacheKey: string;
    };

export type EngineEventType = EngineEvent["type"];

// -----------------------------------------------------------------------------
// Engine Options
// -----------------------------------------------------------------------------

export type EngineEventListener = (event: EngineEvent) => void;

export type EngineEventEmitter = {
  emit(event: EngineEvent): void;
  on(listener: EngineEventListener): () => void;
};

export type EngineOptions = {
  gridColumns: number;
  constraints: Map<string, BlockConstraints>;
  emitter?: EngineEventEmitter;
  /**
   * Optional id for the session. If omitted, a random id is generated.
   */
  opId?: string;
};
