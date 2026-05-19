import type { EngineEvent, EngineEventEmitter, EngineEventListener } from "./types";

/**
 * Creates an in-memory event emitter for engine events.
 *
 * Listener errors are caught and logged so a failing listener does not
 * prevent the others from receiving the event.
 */
export function createEventEmitter(): EngineEventEmitter {
  const listeners = new Set<EngineEventListener>();

  return {
    emit(event: EngineEvent): void {
      for (const listener of listeners) {
        try {
          listener(event);
        } catch (error) {
          console.error("[layout engine] listener threw on event", event.type, error);
        }
      }
    },
    on(listener: EngineEventListener): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

/**
 * Returns a no-op emitter that discards all events.
 *
 * Used as the default emitter when an engine call does not need observability.
 */
export function createNoopEmitter(): EngineEventEmitter {
  return {
    emit(): void {},
    on(): () => void {
      return () => {};
    },
  };
}
