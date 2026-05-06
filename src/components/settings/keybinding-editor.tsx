"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { ArrowGlyph } from "@/components/ui/arrow-glyph";
import { useKeybindings, type KeybindingConflict } from "@/hooks/use-keybindings";
import {
  type KeybindingContext,
  type KeybindingAction,
  type KeyCombo,
  type Modifier,
  getComboSequenceDisplayParts,
  type KeyDisplayPart,
  isArrowKey,
  getArrowDirection,
  DEFAULT_KEYBINDINGS,
} from "@/lib/keybindings";
import styles from "./keybinding-editor.module.css";

type RecordingState = {
  context: KeybindingContext;
  actionId: string;
  comboIndex: number | null;
} | null;

const SEQUENCE_TIMEOUT_MS = 800;

function KeycapDisplay({ part }: { part: KeyDisplayPart }) {
  const display = part.value;

  if (isArrowKey(display)) {
    const direction = getArrowDirection(display);
    if (direction) {
      return (
        <span className={styles.keycap}>
          <ArrowGlyph direction={direction} className={styles.arrow} />
        </span>
      );
    }
  }

  if (display === "esc") {
    return (
      <span className={styles.keycap}>
        <span className="small-caps">{display}</span>
      </span>
    );
  }

  return <span className={styles.keycap}>{display}</span>;
}

function ComboDisplay({ combo }: { combo: KeyCombo }) {
  const sequence = getComboSequenceDisplayParts(combo);
  const isCompactSequence = sequence.length > 1 && sequence.every((step) => step.length === 1 && step[0]?.type === "key" && step[0].value.length === 1);

  return (
    <span className={styles.comboSequence} data-compact-sequence={isCompactSequence}>
      {sequence.map((step, stepIndex) => (
        <span key={stepIndex} className={styles.comboStep}>
          {step.map((part, partIndex) => (
            <KeycapDisplay key={`${stepIndex}-${partIndex}-${part.type}-${part.value}`} part={part} />
          ))}
        </span>
      ))}
    </span>
  );
}

function isWideCombo(combo: KeyCombo): boolean {
  return getComboSequenceDisplayParts(combo).some((step) => step.length > 1) || combo.next !== undefined;
}

function ConflictNotice({
  conflict,
  onDismiss,
}: {
  conflict: KeybindingConflict;
  onDismiss: () => void;
}) {
  return (
    <div className={styles.conflict}>
      <span className={styles.conflictIcon}>⚠</span>
      <span className={styles.conflictText}>
        Replaced binding from &ldquo;{conflict.existingAction.label}&rdquo;
      </span>
      <button
        className={styles.conflictDismiss}
        onClick={onDismiss}
        aria-label="Dismiss"
      >
        ×
      </button>
    </div>
  );
}

function RecordingOverlay({
  onCancel,
  onKeyDown,
  pendingCombo,
}: {
  onCancel: () => void;
  onKeyDown: (combo: KeyCombo) => void;
  pendingCombo: KeyCombo | null;
}) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      event.stopPropagation();

      if (["Control", "Alt", "Shift", "Meta"].includes(event.key)) {
        return;
      }

      if (event.key === "Escape" && !event.ctrlKey && !event.altKey && !event.shiftKey && !event.metaKey) {
        event.preventDefault();
        onCancel();
        return;
      }

      event.preventDefault();

      const modifiers: Modifier[] = [];
      if (event.ctrlKey) modifiers.push("ctrl");
      if (event.altKey) modifiers.push("alt");
      if (event.shiftKey) modifiers.push("shift");
      if (event.metaKey) modifiers.push("meta");

      onKeyDown({
        key: event.key,
        modifiers,
      });
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [onCancel, onKeyDown]);

  return (
    <div ref={overlayRef} className={styles.recordingOverlay}>
      <div className={styles.recordingContent}>
        <p className={styles.recordingTitle}>
          {pendingCombo ? "Press a second key for sequence" : "Press a key combination"}
        </p>
        <p className={styles.recordingHint}>
          {pendingCombo ? `Waiting ${Math.round(SEQUENCE_TIMEOUT_MS / 1000)}s before saving single key` : "You can type two keys in a row (example: g then g)"}
        </p>
        <p className={styles.recordingHint}>
          Press <span className={styles.recordingKey}>Esc</span> to cancel
        </p>
      </div>
    </div>
  );
}

function ActionRow({
  context,
  action,
  isRecording,
  onStartRecording,
  onSetPrimary,
  onRemoveCombo,
  onResetAction,
}: {
  context: KeybindingContext;
  action: KeybindingAction;
  isRecording: boolean;
  onStartRecording: (comboIndex: number | null) => void;
  onSetPrimary: (comboIndex: number) => void;
  onRemoveCombo: (comboIndex: number) => void;
  onResetAction: () => void;
}) {
  const defaultAction = DEFAULT_KEYBINDINGS[context].find((a) => a.id === action.id);
  const isModified = defaultAction
    ? JSON.stringify(action.combos) !== JSON.stringify(defaultAction.combos)
    : false;

  const handleComboClick = (e: React.MouseEvent, index: number) => {
    if (e.shiftKey && index > 0) {
      e.preventDefault();
      onSetPrimary(index);
    } else {
      onStartRecording(index);
    }
  };

  return (
    <div className={`${styles.row} ${isRecording ? styles.rowRecording : ""}`}>
      <div className={styles.label}>{action.label}</div>
      <div className={styles.combos}>
        {action.combos.map((combo, index) => (
          <div key={index} className={styles.comboWrapper}>
            <button
              className={`${styles.comboButton} ${isWideCombo(combo) ? styles.comboButtonWide : ""} ${index === 0 ? styles.comboPrimary : ""}`}
              onClick={(e) => handleComboClick(e, index)}
              disabled={isRecording}
              aria-label={`Edit keybinding ${index + 1} for ${action.label}${index === 0 ? " (primary)" : ""}`}
              title={index > 0 ? "Shift+Click to set as primary" : "Primary keybinding"}
            >
              <ComboDisplay combo={combo} />
            </button>
            {action.combos.length > 1 && (
              <button
                className={styles.comboRemove}
                onClick={() => onRemoveCombo(index)}
                disabled={isRecording}
                aria-label={`Remove keybinding ${index + 1}`}
              >
                ×
              </button>
            )}
          </div>
        ))}
        {action.combos.length < 3 && (
          <button
            className={styles.addButton}
            onClick={() => onStartRecording(null)}
            disabled={isRecording}
            aria-label={`Add alternative keybinding for ${action.label}`}
          >
            +
          </button>
        )}
      </div>
      <div className={styles.actions}>
        {isModified && (
          <button
            className={styles.resetButton}
            onClick={onResetAction}
            disabled={isRecording}
            aria-label={`Reset ${action.label} to default`}
            title="Reset to default"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

const CONTEXT_LABELS: Record<KeybindingContext, string> = {
  global: "Global",
  home: "Home",
  sheet: "Cheatsheet",
  "sheet-layout": "Layout",
};

function ContextSection({
  context,
  actions,
  recordingActionId,
  onStartRecording,
  onSetPrimary,
  onRemoveCombo,
  onResetAction,
}: {
  context: KeybindingContext;
  actions: KeybindingAction[];
  recordingActionId: string | null;
  onStartRecording: (actionId: string, comboIndex: number | null) => void;
  onSetPrimary: (actionId: string, comboIndex: number) => void;
  onRemoveCombo: (actionId: string, comboIndex: number) => void;
  onResetAction: (actionId: string) => void;
}) {
  return (
    <div className={styles.context}>
      <h4 className={styles.contextTitle}>{CONTEXT_LABELS[context]}</h4>
      <div className={styles.list}>
        {actions.map((action) => (
          <ActionRow
            key={action.id}
            context={context}
            action={action}
            isRecording={recordingActionId === action.id}
            onStartRecording={(comboIndex) => onStartRecording(action.id, comboIndex)}
            onSetPrimary={(comboIndex) => onSetPrimary(action.id, comboIndex)}
            onRemoveCombo={(comboIndex) => onRemoveCombo(action.id, comboIndex)}
            onResetAction={() => onResetAction(action.id)}
          />
        ))}
      </div>
    </div>
  );
}

export function KeybindingEditor() {
  const {
    config,
    setActionCombos,
    addCombo,
    removeCombo,
    setPrimaryCombo,
    resetAction,
    resetAll,
  } = useKeybindings();

  const [recording, setRecording] = useState<RecordingState>(null);
  const [lastConflict, setLastConflict] = useState<KeybindingConflict | null>(null);
  const [pendingFirstCombo, setPendingFirstCombo] = useState<KeyCombo | null>(null);
  const sequenceTimerRef = useRef<number | null>(null);

  const clearSequenceTimer = useCallback(() => {
    if (sequenceTimerRef.current !== null) {
      window.clearTimeout(sequenceTimerRef.current);
      sequenceTimerRef.current = null;
    }
  }, []);

  const handleStartRecording = useCallback(
    (context: KeybindingContext, actionId: string, comboIndex: number | null) => {
      setLastConflict(null);
      setRecording({ context, actionId, comboIndex });
    },
    []
  );

  const handleStopRecording = useCallback(() => {
    clearSequenceTimer();
    setPendingFirstCombo(null);
    setRecording(null);
  }, [clearSequenceTimer]);

  const saveCombo = useCallback((combo: KeyCombo) => {
    if (!recording) return;

    const { context, actionId, comboIndex } = recording;
    let conflict: KeybindingConflict | null = null;

    if (comboIndex === null) {
      conflict = addCombo(context, actionId, combo);
    } else {
      const action = config[context].find((a) => a.id === actionId);
      if (action) {
        const newCombos = [...action.combos];
        newCombos[comboIndex] = combo;
        conflict = setActionCombos(context, actionId, newCombos);
      }
    }

    if (conflict) {
      setLastConflict(conflict);
    }

    clearSequenceTimer();
    setPendingFirstCombo(null);
    setRecording(null);
  }, [recording, config, addCombo, setActionCombos, clearSequenceTimer]);

  const handleRecordKey = useCallback(
    (combo: KeyCombo) => {
      if (!recording) return;

      if (!pendingFirstCombo) {
        setPendingFirstCombo(combo);
        clearSequenceTimer();
        sequenceTimerRef.current = window.setTimeout(() => {
          saveCombo(combo);
        }, SEQUENCE_TIMEOUT_MS);
        return;
      }

      saveCombo({ ...pendingFirstCombo, next: combo });
    },
    [recording, pendingFirstCombo, saveCombo, clearSequenceTimer]
  );

  const handleSetPrimary = useCallback(
    (context: KeybindingContext, actionId: string, comboIndex: number) => {
      setPrimaryCombo(context, actionId, comboIndex);
    },
    [setPrimaryCombo]
  );

  const handleRemoveCombo = useCallback(
    (context: KeybindingContext, actionId: string, comboIndex: number) => {
      removeCombo(context, actionId, comboIndex);
    },
    [removeCombo]
  );

  const handleResetAction = useCallback(
    (context: KeybindingContext, actionId: string) => {
      resetAction(context, actionId);
      setLastConflict(null);
    },
    [resetAction]
  );

  const handleResetAll = useCallback(() => {
    resetAll();
    setLastConflict(null);
  }, [resetAll]);

  const contexts: KeybindingContext[] = ["global", "home", "sheet", "sheet-layout"];

  return (
    <div className={styles.editor}>
      {lastConflict && (
        <ConflictNotice
          conflict={lastConflict}
          onDismiss={() => setLastConflict(null)}
        />
      )}

      {contexts.map((context) => (
        <ContextSection
          key={context}
          context={context}
          actions={config[context]}
          recordingActionId={recording?.context === context ? recording.actionId : null}
          onStartRecording={(actionId, comboIndex) =>
            handleStartRecording(context, actionId, comboIndex)
          }
          onSetPrimary={(actionId, comboIndex) =>
            handleSetPrimary(context, actionId, comboIndex)
          }
          onRemoveCombo={(actionId, comboIndex) =>
            handleRemoveCombo(context, actionId, comboIndex)
          }
          onResetAction={(actionId) => handleResetAction(context, actionId)}
        />
      ))}

      <div className={styles.footer}>
        <button className={styles.resetAllButton} onClick={handleResetAll}>
          Reset all keybindings
        </button>
      </div>

      {recording && (
        <RecordingOverlay
          onCancel={handleStopRecording}
          onKeyDown={handleRecordKey}
          pendingCombo={pendingFirstCombo}
        />
      )}
    </div>
  );
}
