"use client";

import { useSyncExternalStore, useCallback } from "react";
import { debugRecorder, type DebugRecorderStartOptions } from "./recorder";
import type { RecordingState } from "./types";

// Stable server snapshot — must be cached outside the component.
const SERVER_SNAPSHOT: RecordingState = {
  isRecording: false,
  sessionId: null,
  startTime: null,
  eventCount: 0,
};

const getServerSnapshot = (): RecordingState => SERVER_SNAPSHOT;

/**
 * React hook providing reactive access to the debug recorder state and control
 * functions. Pass the engine setup to `start()` so the session can be replayed.
 */
export function useDebugRecorder() {
  const state = useSyncExternalStore(
    debugRecorder.subscribe,
    debugRecorder.getState,
    getServerSnapshot
  );

  const start = useCallback((options: DebugRecorderStartOptions) => {
    debugRecorder.start(options);
  }, []);

  const stop = useCallback((description?: string) => debugRecorder.stop(description), []);

  const cancel = useCallback(() => {
    debugRecorder.cancel();
  }, []);

  return {
    ...state,
    start,
    stop,
    cancel,
  };
}
