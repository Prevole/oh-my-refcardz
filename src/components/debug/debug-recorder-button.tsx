"use client";

import { useEffect, useState } from "react";
import { useDebugRecorder, debugRecorder } from "@/lib/debug";
import type { BlockConstraints } from "@/lib/layout/engine";
import styles from "./debug-recorder-button.module.css";

type Props = {
  page: string;
  /** Engine setup captured at recording start so the session is replayable. */
  engine: {
    gridColumns: number;
    constraints: Map<string, BlockConstraints>;
  };
  debugIdMap?: Map<string, string>;
};

/**
 * Debug recorder button — only visible in development mode.
 *
 * Floating control to start/stop recording debug sessions. Captures the engine
 * setup at start so sessions can be replayed with
 * `scripts/replay-layout-journal.ts`.
 */
export function DebugRecorderButton({ page, engine, debugIdMap }: Props) {
  const { isRecording, eventCount, start, stop, cancel } = useDebugRecorder();
  const [isSaving, setIsSaving] = useState(false);
  const [lastResult, setLastResult] = useState<{ success: boolean; path?: string } | null>(null);

  // Keep the recorder's debug id map in sync if the layout changes mid-recording.
  useEffect(() => {
    if (isRecording && debugIdMap) {
      debugRecorder.updateDebugIdMap(debugIdMap);
    }
  }, [isRecording, debugIdMap]);

  if (process.env.NODE_ENV !== "development") {
    return null;
  }

  const handleClick = async () => {
    if (isRecording) {
      setIsSaving(true);
      const result = await stop();
      setLastResult(result);
      setIsSaving(false);

      if (result.success) {
        setTimeout(() => setLastResult(null), 3000);
      }
    } else {
      setLastResult(null);
      start({ page, engine, debugIdMap });
    }
  };

  const handleRightClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (isRecording) {
      cancel();
      setLastResult(null);
    }
  };

  return (
    <div className={styles.container}>
      <button
        type="button"
        className={`${styles.button} ${isRecording ? styles.recording : ""}`}
        onClick={handleClick}
        onContextMenu={handleRightClick}
        disabled={isSaving}
        title={
          isRecording
            ? `Recording... (${eventCount} events)\nClick to stop, right-click to cancel`
            : "Start debug recording"
        }
      >
        <span className={styles.icon}>
          {isSaving ? "⏳" : isRecording ? "⏹" : "⏺"}
        </span>
        {isRecording && <span className={styles.count}>{eventCount}</span>}
        {isRecording && <span className={styles.pulse} />}
      </button>

      {lastResult && (
        <div
          className={`${styles.toast} ${lastResult.success ? styles.success : styles.error}`}
        >
          {lastResult.success
            ? `Saved to ${lastResult.path}`
            : "Failed to save session"}
        </div>
      )}
    </div>
  );
}
