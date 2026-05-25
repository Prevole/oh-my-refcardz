import { describe, it, expect, vi } from "vitest";
import { createScopeStackManager } from "./scope-stack-manager";
import type { ScopeEntry } from "./keyboard-scope";

const ROOT: ScopeEntry = { scope: "global", modal: false };

describe("createScopeStackManager", () => {
  it("exposes the initial stack through `current`", () => {
    const mgr = createScopeStackManager([ROOT]);
    expect(mgr.current).toEqual([ROOT]);
  });

  it("updates `current` synchronously on push", () => {
    const mgr = createScopeStackManager([ROOT]);
    mgr.push("modal", true);
    expect(mgr.current).toEqual([
      ROOT,
      { scope: "modal", modal: true },
    ]);
  });

  it("updates `current` synchronously on pop", () => {
    const mgr = createScopeStackManager([ROOT]);
    mgr.push("modal", true);
    mgr.pop("modal");
    expect(mgr.current).toEqual([ROOT]);
  });

  it("notifies subscribers on push", () => {
    const mgr = createScopeStackManager([ROOT]);
    const listener = vi.fn();
    mgr.subscribe(listener);
    mgr.push("modal", true);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenLastCalledWith([
      ROOT,
      { scope: "modal", modal: true },
    ]);
  });

  it("notifies subscribers on pop", () => {
    const mgr = createScopeStackManager([ROOT]);
    mgr.push("modal", true);
    const listener = vi.fn();
    mgr.subscribe(listener);
    mgr.pop("modal");
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenLastCalledWith([ROOT]);
  });

  it("does not notify when push is a no-op (duplicate top)", () => {
    const mgr = createScopeStackManager([ROOT]);
    mgr.push("modal", true);
    const listener = vi.fn();
    mgr.subscribe(listener);
    mgr.push("modal", true);
    expect(listener).not.toHaveBeenCalled();
  });

  it("does not notify when pop targets an absent scope", () => {
    const mgr = createScopeStackManager([ROOT]);
    const listener = vi.fn();
    mgr.subscribe(listener);
    mgr.pop("modal");
    expect(listener).not.toHaveBeenCalled();
  });

  it("supports unsubscribe", () => {
    const mgr = createScopeStackManager([ROOT]);
    const listener = vi.fn();
    const unsubscribe = mgr.subscribe(listener);
    unsubscribe();
    mgr.push("modal", true);
    expect(listener).not.toHaveBeenCalled();
  });

  // Regression test for the FA5b race condition: a handler firing on a
  // keydown can push a modal scope; if a second event arrives before
  // any host re-render, reading `current` must already reflect the new
  // top of the stack (not the stale closed-over value the handler saw
  // on entry).
  it("reflects a push made between two synchronous reads", () => {
    const mgr = createScopeStackManager([ROOT]);
    expect(mgr.current).toEqual([ROOT]);
    mgr.push("modal", true);
    // Immediate read, no microtask, no React commit:
    expect(mgr.current).toEqual([
      ROOT,
      { scope: "modal", modal: true },
    ]);
  });
});
