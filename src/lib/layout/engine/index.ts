/**
 * Layout engine — public surface.
 *
 * See docs/layout-engine.md for the full contract.
 *
 * This barrel exports only what consumers (mouse hooks, keyboard hooks,
 * persistence, tests) actually need. Internal helpers (geometry primitives,
 * chain computation, step resolution) stay private to the engine module.
 */

// --- Core API ----------------------------------------------------------------

export { applyOperation } from "./engine";
export { createEventEmitter, createNoopEmitter } from "./events";
export { createSessionMemory } from "./session";

// --- Types: blocks and grid -------------------------------------------------

export type {
  BlockConstraints,
  GridPosition,
  LayoutBlock,
  LayoutBlockKind,
} from "./types";

// --- Types: operations -------------------------------------------------------

export type {
  MoveOperation,
  Operation,
  OperationOptions,
  OperationResult,
  ResizeOperation,
} from "./types";

// --- Types: directions ------------------------------------------------------

export type { Axis, Direction } from "./types";

// --- Types: events ----------------------------------------------------------

export type {
  EngineEvent,
  EngineEventEmitter,
  EngineEventListener,
  EngineEventType,
  EngineOptions,
  EventCause,
} from "./types";

// --- Types: session ---------------------------------------------------------

export type { SessionMemory } from "./session";
