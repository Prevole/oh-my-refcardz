/**
 * Debug recorder singleton.
 *
 * This module provides a global debug recorder that can capture events
 * from anywhere in the codebase (including non-React code like the solver).
 *
 * Usage:
 *   import { debugRecorder } from "@/lib/debug/recorder";
 *   debugRecorder.record({ type: "solver:intent", ... });
 */

import type {
  DebugEvent,
  DebugSession,
  RecordingState,
  SolverIntentEvent,
  SolverCollisionEvent,
  SolverFinalPassEvent,
  InteractionStartEvent,
  InteractionEndEvent,
} from "./types";
import type { LayoutBlock, LayoutIntent } from "@/lib/layout/solver/types";

// -----------------------------------------------------------------------------
// Singleton State
// -----------------------------------------------------------------------------

let state: RecordingState = {
  isRecording: false,
  sessionId: null,
  startTime: null,
  eventCount: 0,
};

let events: DebugEvent[] = [];
let currentPage = "";
let currentDebugIdMap: Map<string, string> = new Map();
let eventIdCounter = 0;
const listeners: Set<() => void> = new Set();

// -----------------------------------------------------------------------------
// Internal Helpers
// -----------------------------------------------------------------------------

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function generateEventId(): string {
  return `evt-${++eventIdCounter}`;
}

function notifyListeners(): void {
  listeners.forEach((listener) => listener());
}

function getTimestamp(): number {
  if (!state.startTime) return 0;
  return Date.now() - state.startTime;
}

// -----------------------------------------------------------------------------
// Public API
// -----------------------------------------------------------------------------

export const debugRecorder = {
  /**
   * Start recording a new session.
   */
  start(page: string, debugIdMap?: Map<string, string>): void {
    if (state.isRecording) {
      console.warn("[debugRecorder] Already recording, call stop() first");
      return;
    }

    const sessionId = generateId();
    state = {
      isRecording: true,
      sessionId,
      startTime: Date.now(),
      eventCount: 0,
    };
    events = [];
    currentPage = page;
    currentDebugIdMap = debugIdMap ?? new Map();
    eventIdCounter = 0;

    console.log(`[debugRecorder] Started session ${sessionId} on ${page}`);
    notifyListeners();
  },

  /**
   * Update the debug ID map (e.g., when layout changes).
   */
  updateDebugIdMap(debugIdMap: Map<string, string>): void {
    currentDebugIdMap = debugIdMap;
  },

  /**
   * Stop recording and save the session.
   */
  async stop(description?: string): Promise<{ success: boolean; path?: string; error?: string }> {
    if (!state.isRecording || !state.sessionId || !state.startTime) {
      console.warn("[debugRecorder] Not recording");
      return { success: false, error: "Not recording" };
    }

    // Convert Map to plain object for JSON serialization
    const debugIdMapObject: Record<string, string> = {};
    currentDebugIdMap.forEach((value, key) => {
      debugIdMapObject[key] = value;
    });

    const session: DebugSession = {
      id: state.sessionId,
      startedAt: new Date(state.startTime).toISOString(),
      endedAt: new Date().toISOString(),
      duration: Date.now() - state.startTime,
      page: currentPage,
      description,
      eventCount: events.length,
      events,
      debugIdMap: debugIdMapObject,
    };

    console.log(`[debugRecorder] Stopping session ${state.sessionId} with ${events.length} events`);

    // Reset state before async call
    state = {
      isRecording: false,
      sessionId: null,
      startTime: null,
      eventCount: 0,
    };
    events = [];
    currentDebugIdMap = new Map();
    notifyListeners();

    // Save to server
    try {
      const response = await fetch("/api/dev/debug", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(session),
      });

      if (!response.ok) {
        const error = await response.json();
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
   * Cancel recording without saving.
   */
  cancel(): void {
    if (!state.isRecording) return;

    console.log(`[debugRecorder] Cancelled session ${state.sessionId}`);
    state = {
      isRecording: false,
      sessionId: null,
      startTime: null,
      eventCount: 0,
    };
    events = [];
    currentDebugIdMap = new Map();
    notifyListeners();
  },

  /**
   * Record a raw event.
   */
  record(event: Omit<DebugEvent, "id" | "timestamp">): void {
    if (!state.isRecording) return;

    const fullEvent = {
      ...event,
      id: generateEventId(),
      timestamp: getTimestamp(),
    } as DebugEvent;

    events.push(fullEvent);
    state = { ...state, eventCount: events.length };
    notifyListeners();
  },

  /**
   * Record a solver intent event.
   */
  recordIntent(data: {
    intent: LayoutIntent;
    startLayout: LayoutBlock[];
    resultLayout: LayoutBlock[];
    accepted: boolean;
    pushedIds: string[];
    shrunkIds: string[];
  }): void {
    this.record({
      type: "solver:intent",
      category: "solver",
      data,
    } as Omit<SolverIntentEvent, "id" | "timestamp">);
  },

  /**
   * Record a solver collision event.
   */
  recordCollision(data: {
    sourceId: string;
    sourcePosition: { x: number; y: number; w: number; h: number };
    originalPosition: { x: number; y: number };
    axis: "horizontal" | "vertical";
    direction: "north" | "south" | "east" | "west";
    allCollisions: string[];
    collisionsInPath: string[];
  }): void {
    this.record({
      type: "solver:collision",
      category: "solver",
      data,
    } as Omit<SolverCollisionEvent, "id" | "timestamp">);
  },

  /**
   * Record a solver final pass event.
   */
  recordFinalPass(data: {
    sourceId: string;
    finalCollisions: Array<{
      id: string;
      position: { x: number; y: number; w: number; h: number };
      pushDistance: number;
    }>;
  }): void {
    this.record({
      type: "solver:finalPass",
      category: "solver",
      data,
    } as Omit<SolverFinalPassEvent, "id" | "timestamp">);
  },

  /**
   * Record an interaction start event.
   */
  recordInteractionStart(data: {
    interactionType: "drag" | "resize" | "keyboard";
    blockId: string;
    startLayout: LayoutBlock[];
  }): void {
    this.record({
      type: "interaction:start",
      category: "interaction",
      data,
    } as Omit<InteractionStartEvent, "id" | "timestamp">);
  },

  /**
   * Record an interaction end event.
   */
  recordInteractionEnd(data: {
    interactionType: "drag" | "resize" | "keyboard";
    blockId: string;
    outcome: "commit" | "cancel";
    finalLayout: LayoutBlock[];
  }): void {
    this.record({
      type: "interaction:end",
      category: "interaction",
      data,
    } as Omit<InteractionEndEvent, "id" | "timestamp">);
  },

  /**
   * Get current recording state.
   */
  getState(): RecordingState {
    return state;
  },

  /**
   * Subscribe to state changes.
   */
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  /**
   * Check if currently recording.
   */
  isRecording(): boolean {
    return state.isRecording;
  },

  /**
   * Get debug letter for a block ID.
   * Returns the letter (e.g., "A", "B") or "?" if not found.
   */
  getDebugId(blockId: string): string {
    return currentDebugIdMap.get(blockId) ?? "?";
  },

  /**
   * Get current debug ID map.
   */
  getDebugIdMap(): Map<string, string> {
    return currentDebugIdMap;
  },
};

// Export type for the recorder
export type DebugRecorder = typeof debugRecorder;
