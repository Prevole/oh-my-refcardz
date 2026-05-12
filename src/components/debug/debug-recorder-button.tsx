"use client";

import { useEffect, useState } from "react";
import { useDebugRecorder, debugRecorder } from "@/lib/debug";
import styles from "./debug-recorder-button.module.css";

type Props = {
  page: string;
  debugIdMap?: Map<string, string>;
};

/**
 * Debug recorder button - only visible in development mode.
 *
 * Shows a floating button to start/stop recording debug sessions.
 * When recording, shows event count and pulsing indicator.
 */
export function DebugRecorderButton({ page, debugIdMap }: Props) {
  const { isRecording, eventCount, start, stop, cancel } = useDebugRecorder();
  const [isSaving, setIsSaving] = useState(false);
  const [lastResult, setLastResult] = useState<{ success: boolean; path?: string } | null>(null);

  // Update debug ID map when it changes during recording
  useEffect(() => {
    if (isRecording && debugIdMap) {
      debugRecorder.updateDebugIdMap(debugIdMap);
    }
  }, [isRecording, debugIdMap]);

  // Only render in development
  if (process.env.NODE_ENV !== "development") {
    return null;
  }

  const handleClick = async () => {
    if (isRecording) {
      setIsSaving(true);
      const result = await stop();
      setLastResult(result);
      setIsSaving(false);

      // Clear result after 3 seconds
      if (result.success) {
        setTimeout(() => setLastResult(null), 3000);
      }
    } else {
      setLastResult(null);
      start(page, debugIdMap);
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
