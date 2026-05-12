/**
 * Debug session recording types.
 *
 * This module provides types for recording debug sessions during development.
 * Sessions capture layout solver events, user interactions, and state changes
 * to help diagnose bugs.
 */

import type { LayoutBlock, LayoutIntent } from "@/lib/layout/solver/types";

/**
 * Base event with timestamp and category.
 */
export type DebugEventBase = {
  /** Unique event ID */
  id: string;
  /** Timestamp in ms since session start */
  timestamp: number;
  /** Event category for filtering */
  category: "solver" | "interaction" | "state" | "user";
};

/**
 * Solver intent event - when an intent is applied.
 */
export type SolverIntentEvent = DebugEventBase & {
  type: "solver:intent";
  data: {
    intent: LayoutIntent;
    startLayout: LayoutBlock[];
    resultLayout: LayoutBlock[];
    accepted: boolean;
    pushedIds: string[];
    shrunkIds: string[];
  };
};

/**
 * Solver collision event - when collisions are detected.
 */
export type SolverCollisionEvent = DebugEventBase & {
  type: "solver:collision";
  data: {
    sourceId: string;
    sourcePosition: { x: number; y: number; w: number; h: number };
    originalPosition: { x: number; y: number };
    axis: "horizontal" | "vertical";
    direction: "north" | "south" | "east" | "west";
    allCollisions: string[];
    collisionsInPath: string[];
  };
};

/**
 * Solver final pass event - when final collisions are resolved.
 */
export type SolverFinalPassEvent = DebugEventBase & {
  type: "solver:finalPass";
  data: {
    sourceId: string;
    finalCollisions: Array<{
      id: string;
      position: { x: number; y: number; w: number; h: number };
      pushDistance: number;
    }>;
  };
};

/**
 * Interaction start event.
 */
export type InteractionStartEvent = DebugEventBase & {
  type: "interaction:start";
  data: {
    interactionType: "drag" | "resize" | "keyboard";
    blockId: string;
    startLayout: LayoutBlock[];
  };
};

/**
 * Interaction end event.
 */
export type InteractionEndEvent = DebugEventBase & {
  type: "interaction:end";
  data: {
    interactionType: "drag" | "resize" | "keyboard";
    blockId: string;
    outcome: "commit" | "cancel";
    finalLayout: LayoutBlock[];
  };
};

/**
 * State change event.
 */
export type StateChangeEvent = DebugEventBase & {
  type: "state:change";
  data: {
    field: string;
    oldValue: unknown;
    newValue: unknown;
  };
};

/**
 * User action event (button clicks, etc).
 */
export type UserActionEvent = DebugEventBase & {
  type: "user:action";
  data: {
    action: string;
    details?: Record<string, unknown>;
  };
};

/**
 * Union of all debug events.
 */
export type DebugEvent =
  | SolverIntentEvent
  | SolverCollisionEvent
  | SolverFinalPassEvent
  | InteractionStartEvent
  | InteractionEndEvent
  | StateChangeEvent
  | UserActionEvent;

/**
 * Debug session metadata.
 */
export type DebugSessionMeta = {
  /** Session ID */
  id: string;
  /** Session start timestamp (ISO string) */
  startedAt: string;
  /** Session end timestamp (ISO string) */
  endedAt: string;
  /** Duration in ms */
  duration: number;
  /** Page/sheet being debugged */
  page: string;
  /** User-provided description */
  description?: string;
  /** Number of events captured */
  eventCount: number;
};

/**
 * Complete debug session.
 */
export type DebugSession = DebugSessionMeta & {
  /** All captured events */
  events: DebugEvent[];
  /** Map of block IDs to debug letters (A, B, C...) for easier identification */
  debugIdMap?: Record<string, string>;
};

/**
 * Recording state.
 */
export type RecordingState = {
  /** Whether recording is active */
  isRecording: boolean;
  /** Session ID if recording */
  sessionId: string | null;
  /** Session start time */
  startTime: number | null;
  /** Number of events captured so far */
  eventCount: number;
};
