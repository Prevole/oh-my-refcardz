import { describe, it, expect } from "vitest";
import {
  pushScopeToStack,
  popScopeFromStack,
  isScopeActiveInStack,
  getActiveScope,
  type KeyboardScopeId,
} from "./keyboard-scope";

describe("keyboard-scope", () => {
  describe("pushScopeToStack", () => {
    it("adds scope to empty-like stack", () => {
      const stack: KeyboardScopeId[] = ["global"];
      const result = pushScopeToStack(stack, "help");
      expect(result).toEqual(["global", "help"]);
    });

    it("adds scope to stack with existing scopes", () => {
      const stack: KeyboardScopeId[] = ["global", "settings"];
      const result = pushScopeToStack(stack, "help");
      expect(result).toEqual(["global", "settings", "help"]);
    });

    it("does not add duplicate if already at top", () => {
      const stack: KeyboardScopeId[] = ["global", "help"];
      const result = pushScopeToStack(stack, "help");
      expect(result).toBe(stack); // Same reference
    });

    it("allows same scope deeper in stack", () => {
      const stack: KeyboardScopeId[] = ["global", "help", "settings"];
      const result = pushScopeToStack(stack, "help");
      expect(result).toEqual(["global", "help", "settings", "help"]);
    });

    it("returns new array when adding", () => {
      const stack: KeyboardScopeId[] = ["global"];
      const result = pushScopeToStack(stack, "help");
      expect(result).not.toBe(stack);
    });
  });

  describe("popScopeFromStack", () => {
    it("removes scope from stack by value", () => {
      const stack: KeyboardScopeId[] = ["global", "help"];
      const result = popScopeFromStack(stack, "help");
      expect(result).toEqual(["global"]);
    });

    it("removes last occurrence when scope appears multiple times", () => {
      const stack: KeyboardScopeId[] = ["global", "help", "settings", "help"];
      const result = popScopeFromStack(stack, "help");
      expect(result).toEqual(["global", "help", "settings"]);
    });

    it("does not remove base global scope", () => {
      const stack: KeyboardScopeId[] = ["global"];
      const result = popScopeFromStack(stack, "global");
      expect(result).toBe(stack); // Same reference
    });

    it("returns same array if scope not found", () => {
      const stack: KeyboardScopeId[] = ["global", "help"];
      const result = popScopeFromStack(stack, "settings");
      expect(result).toBe(stack);
    });

    it("removes scope from middle of stack", () => {
      const stack: KeyboardScopeId[] = ["global", "help", "settings", "info"];
      const result = popScopeFromStack(stack, "settings");
      expect(result).toEqual(["global", "help", "info"]);
    });

    it("returns new array when removing", () => {
      const stack: KeyboardScopeId[] = ["global", "help"];
      const result = popScopeFromStack(stack, "help");
      expect(result).not.toBe(stack);
    });

    it("handles stack with single non-global scope", () => {
      const stack: KeyboardScopeId[] = ["global", "help"];
      const result = popScopeFromStack(stack, "help");
      expect(result).toEqual(["global"]);
    });
  });

  describe("isScopeActiveInStack", () => {
    it("returns true for top scope", () => {
      const stack: KeyboardScopeId[] = ["global", "help"];
      expect(isScopeActiveInStack(stack, "help")).toBe(true);
    });

    it("returns false for non-top scope", () => {
      const stack: KeyboardScopeId[] = ["global", "help"];
      expect(isScopeActiveInStack(stack, "global")).toBe(false);
    });

    it("returns false for scope not in stack", () => {
      const stack: KeyboardScopeId[] = ["global"];
      expect(isScopeActiveInStack(stack, "help")).toBe(false);
    });

    it("returns true for global when it is the only scope", () => {
      const stack: KeyboardScopeId[] = ["global"];
      expect(isScopeActiveInStack(stack, "global")).toBe(true);
    });
  });

  describe("getActiveScope", () => {
    it("returns the top scope", () => {
      const stack: KeyboardScopeId[] = ["global", "help", "settings"];
      expect(getActiveScope(stack)).toBe("settings");
    });

    it("returns global for initial stack", () => {
      const stack: KeyboardScopeId[] = ["global"];
      expect(getActiveScope(stack)).toBe("global");
    });
  });

  describe("integration scenarios", () => {
    it("push then pop returns to original state", () => {
      let stack: KeyboardScopeId[] = ["global"];
      stack = pushScopeToStack(stack, "help");
      expect(getActiveScope(stack)).toBe("help");
      
      stack = popScopeFromStack(stack, "help");
      expect(getActiveScope(stack)).toBe("global");
    });

    it("nested scopes work correctly", () => {
      let stack: KeyboardScopeId[] = ["global"];
      
      stack = pushScopeToStack(stack, "settings");
      expect(isScopeActiveInStack(stack, "settings")).toBe(true);
      
      stack = pushScopeToStack(stack, "help");
      expect(isScopeActiveInStack(stack, "help")).toBe(true);
      expect(isScopeActiveInStack(stack, "settings")).toBe(false);
      
      stack = popScopeFromStack(stack, "help");
      expect(isScopeActiveInStack(stack, "settings")).toBe(true);
    });

    it("popping middle scope promotes next scope", () => {
      let stack: KeyboardScopeId[] = ["global", "settings", "help"];
      
      stack = popScopeFromStack(stack, "settings");
      expect(stack).toEqual(["global", "help"]);
      expect(getActiveScope(stack)).toBe("help");
    });
  });
});
