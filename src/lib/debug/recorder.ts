/**
 * Debug recorder singleton.
 *
 * The recorder captures engine events emitted during user interactions so they
 * can be persisted as a JSON session file under `.debug-sessions/` and replayed
 * later via `scripts/replay-layout-journal.ts`.
 *
 * Usage:
 *   import { debugRecorder } from "@/lib/debug/recorder";
 *
 *   // Once per page mount:
 *   debugRecorder.start({ page: "/sheets/git", engine: { gridColumns: 36, constraints: {...} } });
 *
 *   // Pass the emitter to every applyOperation call:
 *   applyOperation(blocks, op, { ...options, emitter: debugRecorder.getEngineEmitter() });
 *
 *   // At the end:
 *   await debugRecorder.stop("description");
 */

import type {
  BlockConstraints,
  EngineEvent,
  EngineEventEmitter,
  EngineEventListener,
} from "@/lib/layout/engine";
import { createEventEmitter, createNoopEmitter } from "@/lib/layout/engine";
import type {
  DebugEngineSetup,
  DebugEvent,
  DebugSession,
  EngineEventRecord,
  RecordingState,
  SerializableConstraints,
  UserActionEvent,
} from "./types";

// -----------------------------------------------------------------------------
// Singleton state
// -----------------------------------------------------------------------------

let state: RecordingState = {
  isRecording: false,
  sessionId: null,
  startTime: null,
  eventCount: 0,
};

let events: DebugEvent[] = [];
let currentPage = "";
let currentEngineSetup: DebugEngineSetup = { gridColumns: 0, constraints: {} };
let currentDebugIdMap: Map<string, string> = new Map();
let eventIdCounter = 0;
const stateListeners: Set<() => void> = new Set();

/**
 * Live engine emitter. Its `emit` is wired to the recorder when recording is
 * active and to a noop otherwise — flipped via `setActive` below. This keeps
 * the same reference across the recording lifecycle so callers don't need to
 * re-fetch it.
 */
let liveEmitter: EngineEventEmitter = createNoopEmitter();

// -----------------------------------------------------------------------------
// Internal helpers
// -----------------------------------------------------------------------------

const generateSessionId = (): string =>
  `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

const generateEventId = (): string => `evt-${++eventIdCounter}`;

const notifyStateListeners = (): void => {
  for (const listener of stateListeners) listener();
};

const getTimestamp = (): number =>
  state.startTime === null ? 0 : Date.now() - state.startTime;

const categoryForEngineEvent = (event: EngineEvent): "session" | "step" | "chain" | "block" => {
  if (event.type.startsWith("session.")) return "session";
  if (event.type.startsWith("step.")) return "step";
  if (event.type.startsWith("chain.")) return "chain";
  return "block";
};

const captureEngineEvent: EngineEventListener = (event) => {
  if (!state.isRecording) return;
  const record: EngineEventRecord = {
    id: generateEventId(),
    timestamp: getTimestamp(),
    category: categoryForEngineEvent(event),
    type: "engine",
    event,
  };
  events.push(record);
  state = { ...state, eventCount: events.length };
  notifyStateListeners();
};

const installLiveEmitter = (): void => {
  // Always wire a fresh emitter; old references become noop after stop/cancel.
  liveEmitter = createEventEmitter();
  liveEmitter.on(captureEngineEvent);
};

const detachLiveEmitter = (): void => {
  liveEmitter = createNoopEmitter();
};

const resetRecordingState = (): void => {
  state = {
    isRecording: false,
    sessionId: null,
    startTime: null,
    eventCount: 0,
  };
  events = [];
  currentEngineSetup = { gridColumns: 0, constraints: {} };
  currentDebugIdMap = new Map();
  detachLiveEmitter();
};

// -----------------------------------------------------------------------------
// Public API
// -----------------------------------------------------------------------------

export type DebugRecorderStartOptions = {
  /** Page or sheet label being debugged. */
  page: string;
  /** Engine inputs captured at start so the session can be replayed. */
  engine: {
    gridColumns: number;
    constraints: Map<string, BlockConstraints> | SerializableConstraints;
  };
  /** Optional block id → letter mapping for readable replays. */
  debugIdMap?: Map<string, string>;
};

const serializeConstraints = (
  constraints: Map<string, BlockConstraints> | SerializableConstraints
): SerializableConstraints => {
  if (constraints instanceof Map) {
    const out: SerializableConstraints = {};
    for (const [id, c] of constraints) out[id] = c;
    return out;
  }
  return { ...constraints };
};

export const debugRecorder = {
  /**
   * Start a new recording session. Captures the engine setup so the session
   * can later be replayed deterministically.
   */
  start(options: DebugRecorderStartOptions): void {
    if (state.isRecording) {
      console.warn("[debugRecorder] Already recording, call stop() first");
      return;
    }

    state = {
      isRecording: true,
      sessionId: generateSessionId(),
      startTime: Date.now(),
      eventCount: 0,
    };
    events = [];
    currentPage = options.page;
    currentEngineSetup = {
      gridColumns: options.engine.gridColumns,
      constraints: serializeConstraints(options.engine.constraints),
    };
    currentDebugIdMap = options.debugIdMap ?? new Map();
    eventIdCounter = 0;
    installLiveEmitter();

    console.log(`[debugRecorder] Started session ${state.sessionId} on ${options.page}`);
    notifyStateListeners();
  },

  /**
   * Update the debug id map. Useful when blocks are added/removed during the
   * session.
   */
  updateDebugIdMap(debugIdMap: Map<string, string>): void {
    currentDebugIdMap = debugIdMap;
  },

  /**
   * Update the engine setup mid-session (e.g., constraints changed). Replays
   * use the final setup; consider stopping and starting a new session if you
   * want to record the change as a discrete step.
   */
  updateEngineSetup(setup: DebugEngineSetup): void {
    currentEngineSetup = {
      gridColumns: setup.gridColumns,
      constraints: { ...setup.constraints },
    };
  },

  /**
   * Stop recording, persist the session via the dev API, and return the result.
   */
  async stop(description?: string): Promise<{ success: boolean; path?: string; error?: string }> {
    if (!state.isRecording || !state.sessionId || state.startTime === null) {
      console.warn("[debugRecorder] Not recording");
      return { success: false, error: "Not recording" };
    }

    const debugIdMapObject: Record<string, string> = {};
    for (const [k, v] of currentDebugIdMap) debugIdMapObject[k] = v;

    const session: DebugSession = {
      id: state.sessionId,
      startedAt: new Date(state.startTime).toISOString(),
      endedAt: new Date().toISOString(),
      duration: Date.now() - state.startTime,
      page: currentPage,
      description,
      eventCount: events.length,
      engine: currentEngineSetup,
      events,
      debugIdMap: debugIdMapObject,
    };

    console.log(
      `[debugRecorder] Stopping session ${state.sessionId} with ${events.length} events`
    );

    resetRecordingState();
    notifyStateListeners();

    try {
      const response = await fetch("/api/dev/debug", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(session),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: "Unknown error" }));
        console.error("[debugRecorder] Failed to save session:", error);
        return { success: false, error: error.error };
      }

      const result = await response.json();
      console.log(`[debugRecorder] Session saved to ${result.path}`);
      return { success: true, path: result.path };
    } catch (error) {
      console.error("[debugRecorder] Network error:", error);
      return { success: false, error: "Network error" };
    }
  },

  /**
   * Discard the current session without saving.
   */
  cancel(): void {
    if (!state.isRecording) return;

    console.log(`[debugRecorder] Cancelled session ${state.sessionId}`);
    resetRecordingState();
    notifyStateListeners();
  },

  /**
   * Record a user action (mode switch, button click, etc.). No-op outside of
   * an active session.
   */
  recordUserAction(action: string, details?: Record<string, unknown>): void {
    if (!state.isRecording) return;
    const record: UserActionEvent = {
      id: generateEventId(),
      timestamp: getTimestamp(),
      category: "user",
      type: "user:action",
      data: { action, details },
    };
    events.push(record);
    state = { ...state, eventCount: events.length };
    notifyStateListeners();
  },

  /**
   * Engine event emitter to be passed to `applyOperation`. Always safe to use;
   * dispatches to the active session when recording, to a noop otherwise.
   *
   * The same reference is returned across the recording lifecycle for the
   * current session — after `stop()`/`cancel()`, the returned emitter is a
   * noop and a fresh one is created on the next `start()`.
   */
  getEngineEmitter(): EngineEventEmitter {
    return liveEmitter;
  },

  /**
   * Current recording state snapshot.
   */
  getState(): RecordingState {
    return state;
  },

  /**
   * Subscribe to recording state changes. Returns an unsubscribe function.
   */
  subscribe(listener: () => void): () => void {
    stateListeners.add(listener);
    return () => {
      stateListeners.delete(listener);
    };
  },

  /**
   * True when a session is currently recording.
   */
  isRecording(): boolean {
    return state.isRecording;
  },

  /**
   * Resolve a debug letter for a block id. Returns "?" when unknown.
   */
  getDebugId(blockId: string): string {
    return currentDebugIdMap.get(blockId) ?? "?";
  },

  /**
   * Current debug id map (read-only view via reference; do not mutate).
   */
  getDebugIdMap(): Map<string, string> {
    return currentDebugIdMap;
  },
};

export type DebugRecorder = typeof debugRecorder;
