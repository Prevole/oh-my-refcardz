import { describe, it, expect } from "vitest";
import {
  pushScopeToStack,
  popScopeFromStack,
  isScopeActiveInStack,
  getActiveScope,
  type ScopeEntry,
} from "./keyboard-scope";

const ROOT: ScopeEntry = { scope: "global", modal: false };

function s(scope: ScopeEntry["scope"], modal = false): ScopeEntry {
  return { scope, modal };
}

describe("keyboard-scope", () => {
  describe("pushScopeToStack", () => {
    it("adds scope to root-only stack", () => {
      const result = pushScopeToStack([ROOT], "help", false);
      expect(result).toEqual([ROOT, s("help")]);
    });

    it("adds scope to stack with existing scopes", () => {
      const result = pushScopeToStack([ROOT, s("settings")], "help", false);
      expect(result).toEqual([ROOT, s("settings"), s("help")]);
    });

    it("does not add duplicate if same scope+modal already at top", () => {
      const stack: ScopeEntry[] = [ROOT, s("help", true)];
      const result = pushScopeToStack(stack, "help", true);
      expect(result).toBe(stack);
    });

    it("re-pushes if same scope but different modality at top", () => {
      const stack: ScopeEntry[] = [ROOT, s("help", false)];
      const result = pushScopeToStack(stack, "help", true);
      expect(result).toEqual([ROOT, s("help", false), s("help", true)]);
    });

    it("allows same scope deeper in stack", () => {
      const stack: ScopeEntry[] = [ROOT, s("help"), s("settings")];
      const result = pushScopeToStack(stack, "help", false);
      expect(result).toEqual([ROOT, s("help"), s("settings"), s("help")]);
    });

    it("returns new array when adding", () => {
      const stack: ScopeEntry[] = [ROOT];
      const result = pushScopeToStack(stack, "help", false);
      expect(result).not.toBe(stack);
    });

    it("records modality on the entry", () => {
      const result = pushScopeToStack([ROOT], "dev-logs", true);
      expect(result[1]).toEqual({ scope: "dev-logs", modal: true });
    });
  });

  describe("popScopeFromStack", () => {
    it("removes scope by value", () => {
      const result = popScopeFromStack([ROOT, s("help")], "help");
      expect(result).toEqual([ROOT]);
    });

    it("removes last occurrence when scope appears multiple times", () => {
      const stack: ScopeEntry[] = [ROOT, s("help"), s("settings"), s("help", true)];
      const result = popScopeFromStack(stack, "help");
      expect(result).toEqual([ROOT, s("help"), s("settings")]);
    });

    it("does not remove root entry", () => {
      const stack: ScopeEntry[] = [ROOT];
      const result = popScopeFromStack(stack, "global");
      expect(result).toBe(stack);
    });

    it("returns same array if scope not found", () => {
      const stack: ScopeEntry[] = [ROOT, s("help")];
      const result = popScopeFromStack(stack, "settings");
      expect(result).toBe(stack);
    });

    it("removes scope from middle of stack", () => {
      const stack: ScopeEntry[] = [ROOT, s("help"), s("settings"), s("info")];
      const result = popScopeFromStack(stack, "settings");
      expect(result).toEqual([ROOT, s("help"), s("info")]);
    });
  });

  describe("isScopeActiveInStack", () => {
    it("returns true for top scope", () => {
      expect(isScopeActiveInStack([ROOT, s("help")], "help")).toBe(true);
    });

    it("returns false for non-top scope", () => {
      expect(isScopeActiveInStack([ROOT, s("help")], "global")).toBe(false);
    });

    it("returns false for scope not in stack", () => {
      expect(isScopeActiveInStack([ROOT], "help")).toBe(false);
    });

    it("returns true for global when it is the only scope", () => {
      expect(isScopeActiveInStack([ROOT], "global")).toBe(true);
    });
  });

  describe("getActiveScope", () => {
    it("returns the top scope id", () => {
      const stack: ScopeEntry[] = [ROOT, s("help"), s("settings")];
      expect(getActiveScope(stack)).toBe("settings");
    });

    it("returns global for initial stack", () => {
      expect(getActiveScope([ROOT])).toBe("global");
    });
  });

  describe("integration scenarios", () => {
    it("push then pop returns to original state", () => {
      let stack: ScopeEntry[] = [ROOT];
      stack = pushScopeToStack(stack, "help", false);
      expect(getActiveScope(stack)).toBe("help");
      stack = popScopeFromStack(stack, "help");
      expect(getActiveScope(stack)).toBe("global");
    });

    it("nested scopes work correctly", () => {
      let stack: ScopeEntry[] = [ROOT];
      stack = pushScopeToStack(stack, "settings", false);
      expect(isScopeActiveInStack(stack, "settings")).toBe(true);
      stack = pushScopeToStack(stack, "help", false);
      expect(isScopeActiveInStack(stack, "help")).toBe(true);
      expect(isScopeActiveInStack(stack, "settings")).toBe(false);
      stack = popScopeFromStack(stack, "help");
      expect(isScopeActiveInStack(stack, "settings")).toBe(true);
    });

    it("supports nested dev scopes with mixed modality", () => {
      let stack: ScopeEntry[] = [ROOT];
      stack = pushScopeToStack(stack, "dev", true);
      stack = pushScopeToStack(stack, "dev-logs", true);
      expect(getActiveScope(stack)).toBe("dev-logs");
      expect(stack[stack.length - 1].modal).toBe(true);
      stack = popScopeFromStack(stack, "dev-logs");
      expect(getActiveScope(stack)).toBe("dev");
      expect(stack[stack.length - 1].modal).toBe(true);
    });

    it("supports dev-axes sub-mode (dev > dev-axes)", () => {
      let stack: ScopeEntry[] = [ROOT, s("dev", true)];
      stack = pushScopeToStack(stack, "dev-axes", true);
      expect(getActiveScope(stack)).toBe("dev-axes");
      stack = popScopeFromStack(stack, "dev-axes");
      expect(getActiveScope(stack)).toBe("dev");
    });
  });
});
