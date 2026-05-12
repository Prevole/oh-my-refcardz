export { debugRecorder, type DebugRecorder } from "./recorder";
export { useDebugRecorder } from "./use-debug-recorder";
export { numberToDebugId, createDebugIdMap } from "./debug-id";
export type {
  DebugEvent,
  DebugSession,
  DebugSessionMeta,
  RecordingState,
  SolverIntentEvent,
  SolverCollisionEvent,
  SolverFinalPassEvent,
  InteractionStartEvent,
  InteractionEndEvent,
  StateChangeEvent,
  UserActionEvent,
} from "./types";
