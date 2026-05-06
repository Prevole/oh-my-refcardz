import { describe, it, expect, beforeEach, vi } from "vitest";

const mockHandlers: Array<{
  key: string;
  render: (value: unknown, context: { hasAliases: boolean }) => unknown;
}> = [];

vi.mock("./entry-registry", async (importOriginal) => {
  const original = await importOriginal<typeof import("./entry-registry")>();
  return {
    ...original,
    registerHandler: <K extends string>(
      key: K,
      render: (value: unknown, context: { hasAliases: boolean }) => unknown
    ) => {
      mockHandlers.push({ key, render });
    },
    renderEntry: (
      entry: Record<string, unknown>,
      context: { hasAliases: boolean }
    ) => {
      for (const handler of mockHandlers) {
        if (handler.key in entry) {
          return handler.render(entry[handler.key], context);
        }
      }
      return null;
    },
  };
});

import { registerHandler, renderEntry } from "./entry-registry";

describe("entry-registry", () => {
  beforeEach(() => {
    mockHandlers.length = 0;
  });

  describe("registerHandler", () => {
    it("registers a handler for a key", () => {
      const render = vi.fn(() => "rendered");
      registerHandler("command", render);

      expect(mockHandlers).toHaveLength(1);
      expect(mockHandlers[0].key).toBe("command");
    });

    it("allows multiple handlers for different keys", () => {
      registerHandler("command", vi.fn());
      registerHandler("title", vi.fn());
      registerHandler("text", vi.fn());

      expect(mockHandlers).toHaveLength(3);
    });
  });

  describe("renderEntry", () => {
    it("returns null when no handler matches", () => {
      const entry = { unknownKey: "value" } as Record<string, unknown>;
      const context = { hasAliases: false };

      const result = renderEntry(entry as never, context);

      expect(result).toBeNull();
    });

    it("calls matching handler with value and context", () => {
      const render = vi.fn(() => "rendered command");
      registerHandler("command", render);

      const entry = { command: "git status" };
      const context = { hasAliases: true };

      const result = renderEntry(entry as never, context);

      expect(render).toHaveBeenCalledWith("git status", { hasAliases: true });
      expect(result).toBe("rendered command");
    });

    it("uses first matching handler when entry has multiple keys", () => {
      const commandRender = vi.fn(() => "command output");
      const titleRender = vi.fn(() => "title output");

      registerHandler("command", commandRender);
      registerHandler("title", titleRender);

      const entry = { command: "git status", title: "Git Status" };
      const context = { hasAliases: false };

      const result = renderEntry(entry as never, context);

      expect(commandRender).toHaveBeenCalled();
      expect(titleRender).not.toHaveBeenCalled();
      expect(result).toBe("command output");
    });

    it("passes hasAliases context correctly", () => {
      const render = vi.fn(() => null);
      registerHandler("text", render);

      renderEntry({ text: "some text" } as never, { hasAliases: true });
      expect(render).toHaveBeenCalledWith("some text", { hasAliases: true });

      render.mockClear();

      renderEntry({ text: "other text" } as never, { hasAliases: false });
      expect(render).toHaveBeenCalledWith("other text", { hasAliases: false });
    });
  });
});
