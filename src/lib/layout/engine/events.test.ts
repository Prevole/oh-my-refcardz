import { describe, expect, it, vi } from "vitest";
import { createEventEmitter, createNoopEmitter } from "./events";
import type { EngineEvent } from "./types";

const sampleEvent: EngineEvent = {
  type: "session.start",
  opId: "op-1",
  operation: { kind: "move", blockId: "b", dx: 1, dy: 0 },
  initial: [],
};

describe("createEventEmitter", () => {
  it("dispatches emitted events to subscribed listeners", () => {
    const emitter = createEventEmitter();
    const listener = vi.fn();

    emitter.on(listener);
    emitter.emit(sampleEvent);

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(sampleEvent);
  });

  it("supports multiple listeners", () => {
    const emitter = createEventEmitter();
    const a = vi.fn();
    const b = vi.fn();

    emitter.on(a);
    emitter.on(b);
    emitter.emit(sampleEvent);

    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
  });

  it("returns an unsubscribe function", () => {
    const emitter = createEventEmitter();
    const listener = vi.fn();

    const unsubscribe = emitter.on(listener);
    emitter.emit(sampleEvent);
    unsubscribe();
    emitter.emit(sampleEvent);

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("isolates listener errors so siblings still receive the event", () => {
    const emitter = createEventEmitter();
    const failing = vi.fn(() => {
      throw new Error("boom");
    });
    const sibling = vi.fn();
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    emitter.on(failing);
    emitter.on(sibling);
    emitter.emit(sampleEvent);

    expect(failing).toHaveBeenCalledTimes(1);
    expect(sibling).toHaveBeenCalledTimes(1);

    errorSpy.mockRestore();
  });
});

describe("createNoopEmitter", () => {
  it("accepts emit calls without invoking listeners", () => {
    const emitter = createNoopEmitter();
    expect(() => emitter.emit(sampleEvent)).not.toThrow();
  });

  it("returns an unsubscribe function from on()", () => {
    const emitter = createNoopEmitter();
    const unsubscribe = emitter.on(() => {});
    expect(() => unsubscribe()).not.toThrow();
  });
});
