"use client";

import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import { Circle, LoaderCircle, Square } from "lucide-react";
import { useDevRecorder, debugRecorder } from "@/lib/dev-mode";
import type { BlockConstraints } from "@/lib/layout/engine";
import styles from "./dev-recorder-button.module.css";

type Props = {
  page: string;
  /** Engine setup captured at recording start so the session is replayable. */
  engine: {
    gridColumns: number;
    constraints: Map<string, BlockConstraints>;
  };
  debugIdMap?: Map<string, string>;
};

/** Imperative API exposed via ref so the parent can drive the recorder via keyboard. */
export type DevRecorderButtonHandle = {
  toggle: () => void;
  cancel: () => void;
};

/**
 * Dev recorder button — only visible in development mode and only rendered
 * inside the developer mode bar.
 *
 * Inline (non-floating) control to start/stop recording debug sessions.
 * Captures the engine setup at start so sessions can be replayed with
 * `scripts/replay-layout-journal.ts`.
 *
 * Exposes an imperative handle so the developer-mode keyboard scope can
 * trigger the same start/stop logic without duplicating state.
 */
export const DevRecorderButton = forwardRef<DevRecorderButtonHandle, Props>(
  function DevRecorderButton({ page, engine, debugIdMap }, ref) {
    const { isRecording, eventCount, start, stop, cancel } = useDevRecorder();
    const [isSaving, setIsSaving] = useState(false);
    const [lastResult, setLastResult] = useState<{ success: boolean; path?: string } | null>(null);

    // Keep the recorder's debug id map in sync if the layout changes mid-recording.
    useEffect(() => {
      if (isRecording && debugIdMap) {
        debugRecorder.updateDebugIdMap(debugIdMap);
      }
    }, [isRecording, debugIdMap]);

    const handleToggle = async () => {
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

    const handleCancel = () => {
      if (isRecording) {
        cancel();
        setLastResult(null);
      }
    };

    useImperativeHandle(
      ref,
      () => ({
        toggle: () => {
          void handleToggle();
        },
        cancel: handleCancel,
      }),
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [isRecording, page, engine, debugIdMap]
    );

    if (process.env.NODE_ENV !== "development") {
      return null;
    }

    const handleRightClick = (e: React.MouseEvent) => {
      e.preventDefault();
      handleCancel();
    };

    return (
      <span className={styles.container}>
        <button
          type="button"
          className={`${styles.button} ${isRecording ? styles.recording : ""}`}
          onClick={() => void handleToggle()}
          onContextMenu={handleRightClick}
          disabled={isSaving}
          title={
            isRecording
              ? `Recording... (${eventCount} events)\nClick to stop, right-click to cancel`
              : "Start debug recording"
          }
        >
          <span className={styles.icon} aria-hidden="true">
            {isSaving ? (
              <LoaderCircle size={14} strokeWidth={2} className={styles.spinner} />
            ) : isRecording ? (
              <Square size={14} strokeWidth={2} fill="currentColor" />
            ) : (
              <Circle size={14} strokeWidth={2} fill="currentColor" />
            )}
          </span>
          {isRecording && <span className={styles.count}>{eventCount}</span>}
          {isRecording && <span className={styles.pulse} />}
        </button>

        {lastResult && (
          <span
            className={`${styles.toast} ${lastResult.success ? styles.success : styles.error}`}
          >
            {lastResult.success ? `Saved to ${lastResult.path}` : "Failed to save session"}
          </span>
        )}
      </span>
    );
  }
);
