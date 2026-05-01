"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { ArrowGlyph } from "@/components/arrow-glyph";
import { useKeybindings, type KeybindingConflict } from "@/hooks/use-keybindings";
import {
  type KeybindingContext,
  type KeybindingAction,
  type KeyCombo,
  type Modifier,
  getComboDisplay,
  isArrowKey,
  getArrowDirection,
  DEFAULT_KEYBINDINGS,
} from "@/lib/keybindings";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type RecordingState = {
  context: KeybindingContext;
  actionId: string;
  comboIndex: number | null; // null = adding new combo
} | null;

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function KeycapDisplay({ display }: { display: string }) {
  if (isArrowKey(display)) {
    const direction = getArrowDirection(display);
    if (direction) {
      return (
        <span className="keybinding-keycap">
          <ArrowGlyph direction={direction} className="keybinding-arrow" />
        </span>
      );
    }
  }

  // Check for small-caps display (esc)
  if (display === "esc") {
    return (
      <span className="keybinding-keycap">
        <span className="small-caps">{display}</span>
      </span>
    );
  }

  return <span className="keybinding-keycap">{display}</span>;
}

function ComboDisplay({ combo }: { combo: KeyCombo }) {
  const display = getComboDisplay(combo);
  return <KeycapDisplay display={display} />;
}

function ConflictNotice({
  conflict,
  onDismiss,
}: {
  conflict: KeybindingConflict;
  onDismiss: () => void;
}) {
  return (
    <div className="keybinding-conflict">
      <span className="keybinding-conflict-icon">⚠</span>
      <span className="keybinding-conflict-text">
        Replaced binding from &ldquo;{conflict.existingAction.label}&rdquo;
      </span>
      <button
        className="keybinding-conflict-dismiss"
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
}: {
  onCancel: () => void;
  onKeyDown: (combo: KeyCombo) => void;
}) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Always stop propagation to prevent settings panel from closing
      event.stopPropagation();

      // Ignore modifier-only presses
      if (["Control", "Alt", "Shift", "Meta"].includes(event.key)) {
        return;
      }

      // Cancel on Escape without modifiers
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
    <div ref={overlayRef} className="keybinding-recording-overlay">
      <div className="keybinding-recording-content">
        <p className="keybinding-recording-title">Press a key combination</p>
        <p className="keybinding-recording-hint">
          Press <span className="keybinding-recording-key">Esc</span> to cancel
        </p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Action Row Component
// ─────────────────────────────────────────────────────────────────────────────

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
      // Shift+Click: set as primary
      e.preventDefault();
      onSetPrimary(index);
    } else {
      // Normal click: start recording
      onStartRecording(index);
    }
  };

  return (
    <div className={`keybinding-row ${isRecording ? "keybinding-row-recording" : ""}`}>
      <div className="keybinding-label">{action.label}</div>
      <div className="keybinding-combos">
        {action.combos.map((combo, index) => (
          <div key={index} className="keybinding-combo-wrapper">
            <button
              className={`keybinding-combo-btn ${index === 0 ? "keybinding-combo-primary" : ""}`}
              onClick={(e) => handleComboClick(e, index)}
              disabled={isRecording}
              aria-label={`Edit keybinding ${index + 1} for ${action.label}${index === 0 ? " (primary)" : ""}`}
              title={index > 0 ? "Shift+Click to set as primary" : "Primary keybinding"}
            >
              <ComboDisplay combo={combo} />
            </button>
            {action.combos.length > 1 && (
              <button
                className="keybinding-combo-remove"
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
            className="keybinding-add-btn"
            onClick={() => onStartRecording(null)}
            disabled={isRecording}
            aria-label={`Add alternative keybinding for ${action.label}`}
          >
            +
          </button>
        )}
      </div>
      <div className="keybinding-actions">
        {isModified && (
          <button
            className="keybinding-reset-btn"
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

// ─────────────────────────────────────────────────────────────────────────────
// Context Section Component
// ─────────────────────────────────────────────────────────────────────────────

const CONTEXT_LABELS: Record<KeybindingContext, string> = {
  global: "Global",
  home: "Home",
  sheet: "Cheatsheet",
  "sheet-commands": "Commands",
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
    <div className="keybinding-context">
      <h4 className="keybinding-context-title">{CONTEXT_LABELS[context]}</h4>
      <div className="keybinding-list">
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

// ─────────────────────────────────────────────────────────────────────────────
// Main Editor Component
// ─────────────────────────────────────────────────────────────────────────────

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

  const handleStartRecording = useCallback(
    (context: KeybindingContext, actionId: string, comboIndex: number | null) => {
      setLastConflict(null);
      setRecording({ context, actionId, comboIndex });
    },
    []
  );

  const handleStopRecording = useCallback(() => {
    setRecording(null);
  }, []);

  const handleRecordKey = useCallback(
    (combo: KeyCombo) => {
      if (!recording) return;

      const { context, actionId, comboIndex } = recording;

      let conflict: KeybindingConflict | null = null;

      if (comboIndex === null) {
        // Adding new combo
        conflict = addCombo(context, actionId, combo);
      } else {
        // Replacing existing combo
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

      setRecording(null);
    },
    [recording, config, addCombo, setActionCombos]
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

  const contexts: KeybindingContext[] = ["global", "home", "sheet", "sheet-commands"];

  return (
    <div className="keybinding-editor">
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

      <div className="keybinding-footer">
        <button className="keybinding-reset-all-btn" onClick={handleResetAll}>
          Reset all keybindings
        </button>
      </div>

      {recording && (
        <RecordingOverlay
          onCancel={handleStopRecording}
          onKeyDown={handleRecordKey}
        />
      )}
    </div>
  );
}
