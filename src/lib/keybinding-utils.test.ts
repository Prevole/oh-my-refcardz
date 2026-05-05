import { describe, it, expect } from "vitest";
import { mergeWithDefaults, combosEqual, findConflict } from "./keybinding-utils";
import { DEFAULT_KEYBINDINGS, type KeybindingsConfig, type KeyCombo } from "./keybindings";

function key(k: string, modifiers: string[] = []): KeyCombo {
  return { key: k, modifiers };
}

function sequence(first: string, second: string): KeyCombo {
  return { key: first, modifiers: [], next: { key: second, modifiers: [] } };
}

describe("keybinding-utils", () => {
  describe("combosEqual", () => {
    it("returns true for identical simple combos", () => {
      expect(combosEqual(key("a"), key("a"))).toBe(true);
    });

    it("returns false for different keys", () => {
      expect(combosEqual(key("a"), key("b"))).toBe(false);
    });

    it("returns true for identical combos with modifiers", () => {
      expect(combosEqual(key("a", ["ctrl", "shift"]), key("a", ["shift", "ctrl"]))).toBe(true);
    });

    it("returns false when modifier count differs", () => {
      expect(combosEqual(key("a", ["ctrl"]), key("a", ["ctrl", "shift"]))).toBe(false);
    });

    it("returns false when modifiers differ", () => {
      expect(combosEqual(key("a", ["ctrl"]), key("a", ["alt"]))).toBe(false);
    });

    it("returns true for identical sequences", () => {
      expect(combosEqual(sequence("g", "g"), sequence("g", "g"))).toBe(true);
    });

    it("returns false for different sequences", () => {
      expect(combosEqual(sequence("g", "g"), sequence("g", "t"))).toBe(false);
    });

    it("returns false when one has next and other does not", () => {
      expect(combosEqual(key("g"), sequence("g", "g"))).toBe(false);
    });

    it("returns false when first has next but second does not", () => {
      expect(combosEqual(sequence("g", "g"), key("g"))).toBe(false);
    });

    it("handles nested sequences", () => {
      const triple1: KeyCombo = { key: "g", modifiers: [], next: { key: "g", modifiers: [], next: { key: "g", modifiers: [] } } };
      const triple2: KeyCombo = { key: "g", modifiers: [], next: { key: "g", modifiers: [], next: { key: "g", modifiers: [] } } };
      const triple3: KeyCombo = { key: "g", modifiers: [], next: { key: "g", modifiers: [], next: { key: "t", modifiers: [] } } };
      
      expect(combosEqual(triple1, triple2)).toBe(true);
      expect(combosEqual(triple1, triple3)).toBe(false);
    });

    it("handles sequence with modifiers", () => {
      const seq1: KeyCombo = { key: "g", modifiers: ["ctrl"], next: { key: "g", modifiers: ["shift"] } };
      const seq2: KeyCombo = { key: "g", modifiers: ["ctrl"], next: { key: "g", modifiers: ["shift"] } };
      const seq3: KeyCombo = { key: "g", modifiers: ["ctrl"], next: { key: "g", modifiers: ["alt"] } };
      
      expect(combosEqual(seq1, seq2)).toBe(true);
      expect(combosEqual(seq1, seq3)).toBe(false);
    });
  });

  describe("mergeWithDefaults", () => {
    it("returns defaults when stored is empty", () => {
      const result = mergeWithDefaults({});
      expect(result).toEqual(DEFAULT_KEYBINDINGS);
    });

    it("preserves stored combos for known actions", () => {
      const customCombo = key("x", ["ctrl"]);
      const stored: Partial<KeybindingsConfig> = {
        global: [{ id: "global.toggle-help", label: "", combos: [customCombo] }],
      };

      const result = mergeWithDefaults(stored);

      const helpAction = result.global.find((a) => a.id === "global.toggle-help");
      expect(helpAction).toBeDefined();
      expect(helpAction!.combos).toEqual([customCombo]);
    });

    it("uses default combos for actions not in stored", () => {
      const stored: Partial<KeybindingsConfig> = {
        global: [],
      };

      const result = mergeWithDefaults(stored);

      const helpAction = result.global.find((a) => a.id === "global.toggle-help");
      const defaultHelpAction = DEFAULT_KEYBINDINGS.global.find((a) => a.id === "global.toggle-help");
      expect(helpAction!.combos).toEqual(defaultHelpAction!.combos);
    });

    it("preserves default action metadata (label) when using stored combos", () => {
      const stored: Partial<KeybindingsConfig> = {
        global: [{ id: "global.toggle-help", label: "wrong label", combos: [key("x")] }],
      };

      const result = mergeWithDefaults(stored);

      const helpAction = result.global.find((a) => a.id === "global.toggle-help");
      const defaultHelpAction = DEFAULT_KEYBINDINGS.global.find((a) => a.id === "global.toggle-help");
      expect(helpAction!.label).toEqual(defaultHelpAction!.label);
      expect(helpAction!.combos).toEqual([key("x")]);
    });

    it("ignores stored actions not in defaults", () => {
      const stored: Partial<KeybindingsConfig> = {
        global: [
          { id: "global.toggle-help", label: "", combos: [key("?")] },
          { id: "unknown.action", label: "Unknown", combos: [key("z")] },
        ],
      };

      const result = mergeWithDefaults(stored);

      const unknownAction = result.global.find((a) => a.id === "unknown.action");
      expect(unknownAction).toBeUndefined();
    });

    it("handles all contexts", () => {
      const stored: Partial<KeybindingsConfig> = {
        global: [{ id: "global.toggle-help", label: "", combos: [key("1")] }],
        home: [{ id: "home.focus-search", label: "", combos: [key("2")] }],
        sheet: [{ id: "sheet.back-to-home", label: "", combos: [key("3")] }],
        "sheet-commands": [{ id: "sheet-commands.copy", label: "", combos: [key("4")] }],
        "sheet-layout": [{ id: "sheet-layout.nav-left", label: "", combos: [key("5")] }],
      };

      const result = mergeWithDefaults(stored);

      expect(result.global.find((a) => a.id === "global.toggle-help")!.combos).toEqual([key("1")]);
      expect(result.home.find((a) => a.id === "home.focus-search")!.combos).toEqual([key("2")]);
      expect(result.sheet.find((a) => a.id === "sheet.back-to-home")!.combos).toEqual([key("3")]);
      expect(result["sheet-commands"].find((a) => a.id === "sheet-commands.copy")!.combos).toEqual([key("4")]);
      expect(result["sheet-layout"].find((a) => a.id === "sheet-layout.nav-left")!.combos).toEqual([key("5")]);
    });

    it("returns all default actions even when stored has partial list", () => {
      const stored: Partial<KeybindingsConfig> = {
        global: [{ id: "global.toggle-help", label: "", combos: [key("x")] }],
      };

      const result = mergeWithDefaults(stored);

      expect(result.global.length).toBe(DEFAULT_KEYBINDINGS.global.length);
    });
  });

  describe("findConflict", () => {
    const baseConfig: KeybindingsConfig = {
      global: [
        { id: "global.toggle-help", label: "Help", combos: [key("?")] },
        { id: "global.toggle-settings", label: "Settings", combos: [key(",", ["ctrl"])] },
      ],
      home: [
        { id: "home.move-left", label: "Move left", combos: [key("h"), key("ArrowLeft")] },
        { id: "home.move-right", label: "Move right", combos: [key("l")] },
      ],
      sheet: [],
      "sheet-commands": [],
      "sheet-layout": [],
    };

    it("returns null when no conflict exists", () => {
      const result = findConflict(baseConfig, "home", "home.move-left", key("x"));
      expect(result).toBeNull();
    });

    it("finds conflict in same context", () => {
      const result = findConflict(baseConfig, "home", "home.move-left", key("l"));
      expect(result).not.toBeNull();
      expect(result!.existingAction.id).toBe("home.move-right");
      expect(result!.context).toBe("home");
    });

    it("finds conflict with global context from non-global", () => {
      const result = findConflict(baseConfig, "home", "home.move-left", key("?"));
      expect(result).not.toBeNull();
      expect(result!.existingAction.id).toBe("global.toggle-help");
      expect(result!.context).toBe("global");
    });

    it("does not check global when already in global context", () => {
      const configWithSameKey: KeybindingsConfig = {
        ...baseConfig,
        home: [{ id: "home.move-left", label: "Move left", combos: [key("?")] }],
      };

      const result = findConflict(configWithSameKey, "global", "global.toggle-help", key("?"));
      expect(result).toBeNull();
    });

    it("does not flag the same action as conflict", () => {
      const result = findConflict(baseConfig, "home", "home.move-left", key("h"));
      expect(result).toBeNull();
    });

    it("finds conflict with modifiers", () => {
      const result = findConflict(baseConfig, "home", "home.move-left", key(",", ["ctrl"]));
      expect(result).not.toBeNull();
      expect(result!.existingAction.id).toBe("global.toggle-settings");
    });

    it("does not conflict when modifiers differ", () => {
      const result = findConflict(baseConfig, "home", "home.move-left", key(",", ["alt"]));
      expect(result).toBeNull();
    });

    it("finds conflict with any combo of the conflicting action", () => {
      const result = findConflict(baseConfig, "home", "home.move-right", key("ArrowLeft"));
      expect(result).not.toBeNull();
      expect(result!.existingAction.id).toBe("home.move-left");
    });

    it("handles sequences correctly", () => {
      const configWithSequence: KeybindingsConfig = {
        ...baseConfig,
        home: [
          ...baseConfig.home,
          { id: "home.go-top", label: "Go top", combos: [sequence("g", "g")] },
        ],
      };

      expect(findConflict(configWithSequence, "home", "home.move-left", sequence("g", "g"))).not.toBeNull();
      expect(findConflict(configWithSequence, "home", "home.move-left", sequence("g", "t"))).toBeNull();
      expect(findConflict(configWithSequence, "home", "home.move-left", key("g"))).toBeNull();
    });

    it("returns first conflict found in context before checking global", () => {
      const configWithMultiple: KeybindingsConfig = {
        global: [{ id: "global.action", label: "Global", combos: [key("x")] }],
        home: [
          { id: "home.action1", label: "Action 1", combos: [key("x")] },
          { id: "home.action2", label: "Action 2", combos: [key("y")] },
        ],
        sheet: [],
        "sheet-commands": [],
        "sheet-layout": [],
      };

      const result = findConflict(configWithMultiple, "home", "home.action2", key("x"));
      expect(result!.existingAction.id).toBe("home.action1");
      expect(result!.context).toBe("home");
    });
  });
});
