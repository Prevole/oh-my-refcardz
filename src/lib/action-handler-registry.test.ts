import { describe, it, expect, vi, beforeEach } from "vitest";
import { ActionHandlerRegistry } from "./action-handler-registry";

describe("ActionHandlerRegistry", () => {
  let registry: ActionHandlerRegistry;

  beforeEach(() => {
    registry = new ActionHandlerRegistry();
  });

  it("binds a handler and retrieves it", () => {
    const handler = vi.fn();
    registry.bindHandler("dev.save-layout", "dev", handler);
    const bound = registry.getHandlersForScope("dev");
    expect(bound).toHaveLength(1);
    expect(bound[0].actionId).toBe("dev.save-layout");
    expect(bound[0].handler).toBe(handler);
  });

  it("returns empty array for unknown scope", () => {
    expect(registry.getHandlersForScope("dev")).toEqual([]);
  });

  it("throws when binding the same actionId twice in the same scope", () => {
    registry.bindHandler("dev.save-layout", "dev", vi.fn());
    expect(() =>
      registry.bindHandler("dev.save-layout", "dev", vi.fn()),
    ).toThrow(/already bound/);
  });

  it("allows the same actionId in different scopes", () => {
    registry.bindHandler("a.b", "dev", vi.fn());
    expect(() => registry.bindHandler("a.b", "dev-logs", vi.fn())).not.toThrow();
  });

  it("unbinds via returned function", () => {
    const unbind = registry.bindHandler("dev.save-layout", "dev", vi.fn());
    expect(registry.hasHandler("dev.save-layout", "dev")).toBe(true);
    unbind();
    expect(registry.hasHandler("dev.save-layout", "dev")).toBe(false);
    expect(registry.getHandlersForScope("dev")).toEqual([]);
  });

  it("unbind is idempotent", () => {
    const unbind = registry.bindHandler("a.b", "dev", vi.fn());
    unbind();
    expect(() => unbind()).not.toThrow();
  });

  it("allows rebinding after unbinding", () => {
    const unbind = registry.bindHandler("a.b", "dev", vi.fn());
    unbind();
    const handler2 = vi.fn();
    registry.bindHandler("a.b", "dev", handler2);
    expect(registry.getHandlersForScope("dev")[0].handler).toBe(handler2);
  });

  it("clear() removes all bindings", () => {
    registry.bindHandler("a", "dev", vi.fn());
    registry.bindHandler("b", "dev-logs", vi.fn());
    registry.clear();
    expect(registry.getHandlersForScope("dev")).toEqual([]);
    expect(registry.getHandlersForScope("dev-logs")).toEqual([]);
  });
});
