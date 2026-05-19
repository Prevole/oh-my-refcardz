/**
 * Debug session recording types.
 *
 * Captures engine events emitted during user interactions so they can be
 * inspected, diffed, and replayed (see `scripts/replay-layout-journal.ts`).
 *
 * Design notes:
 * - Engine events are stored verbatim — no extra abstraction layer. The replay
 *   script reads the session, reconstructs the inputs (initial blocks, op,
 *   constraints, gridColumns), runs `applyOperation`, and compares the resulting
 *   event stream with the recorded one.
 * - `UserActionEvent` is the only debug-specific event type. It marks discrete
 *   user gestures that have no direct engine equivalent (mode switches, button
 *   clicks, etc.).
 */

import type { BlockConstraints, EngineEvent } from "@/lib/layout/engine";

/**
 * Common fields for every recorded event.
 */
export type DebugEventBase = {
  /** Sequential event id within the session ("evt-1", "evt-2", ...) */
  id: string;
  /** Milliseconds elapsed since `DebugSession.startedAt` */
  timestamp: number;
  /** Coarse category used by UI filters. Derived from `event.type` for engine events. */
  category: "session" | "step" | "chain" | "block" | "user";
};

/**
 * An engine event captured during a session.
 */
export type EngineEventRecord = DebugEventBase & {
  type: "engine";
  event: EngineEvent;
};

/**
 * A user-initiated action that is not an engine event (mode switch, button
 * click, etc.). Optional but useful to trace context in long recordings.
 */
export type UserActionEvent = DebugEventBase & {
  type: "user:action";
  category: "user";
  data: {
    action: string;
    details?: Record<string, unknown>;
  };
};

export type DebugEvent = EngineEventRecord | UserActionEvent;

/**
 * Serializable block constraints map (Map<string, BlockConstraints> → record).
 * Maps are not JSON-serializable, so we use a plain object on disk.
 */
export type SerializableConstraints = Record<string, BlockConstraints>;

/**
 * Engine inputs captured at recording start so the session can be replayed
 * deterministically. Without these, the replay script cannot reproduce the
 * engine's decisions.
 */
export type DebugEngineSetup = {
  gridColumns: number;
  constraints: SerializableConstraints;
};

/**
 * Debug session metadata.
 */
export type DebugSessionMeta = {
  id: string;
  /** ISO timestamp when recording started */
  startedAt: string;
  /** ISO timestamp when recording stopped */
  endedAt: string;
  /** Duration in ms */
  duration: number;
  /** Page or sheet being debugged (free-form label) */
  page: string;
  /** Optional user-provided description */
  description?: string;
  /** Number of events captured */
  eventCount: number;
};

/**
 * Complete debug session as persisted to disk.
 */
export type DebugSession = DebugSessionMeta & {
  /** Engine inputs needed to replay the session deterministically */
  engine: DebugEngineSetup;
  /** All captured events in chronological order */
  events: DebugEvent[];
  /** Optional human-friendly id mapping (block id → letter "A", "B", ...) */
  debugIdMap?: Record<string, string>;
};

/**
 * Live recording state observable by UIs (button, badge, etc.).
 */
export type RecordingState = {
  isRecording: boolean;
  sessionId: string | null;
  /** ms since epoch when recording started (or null) */
  startTime: number | null;
  /** Number of events captured so far */
  eventCount: number;
};
