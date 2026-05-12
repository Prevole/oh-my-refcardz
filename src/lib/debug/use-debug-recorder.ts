"use client";

import { useSyncExternalStore, useCallback } from "react";
import { debugRecorder } from "./recorder";
import type { RecordingState } from "./types";

// Stable server snapshot - must be cached outside the component
const SERVER_SNAPSHOT: RecordingState = {
  isRecording: false,
  sessionId: null,
  startTime: null,
  eventCount: 0,
};

function getServerSnapshot(): RecordingState {
  return SERVER_SNAPSHOT;
}

/**
 * Hook to use the debug recorder in React components.
 *
 * Provides reactive access to recording state and control functions.
 */
export function useDebugRecorder() {
  const state = useSyncExternalStore(
    debugRecorder.subscribe,
    debugRecorder.getState,
    getServerSnapshot
  );

  const start = useCallback((page: string, debugIdMap?: Map<string, string>) => {
    debugRecorder.start(page, debugIdMap);
  }, []);

  const stop = useCallback(async (description?: string) => {
    return debugRecorder.stop(description);
  }, []);

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
