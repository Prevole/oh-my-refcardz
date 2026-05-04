import { describe, it, expect } from "vitest";
import {
  key,
  combo,
  sequence,
  matchesCombo,
  matchesAction,
  findMatchingAction,
  getKeyDisplay,
  getComboDisplay,
  getCombosDisplay,
  isArrowKey,
  getArrowDirection,
  scopeToContext,
  type KeyCombo,
  type KeybindingAction,
} from "./keybindings";

function mockKeyboardEvent(
  key: string,
  options: {
    code?: string;
    ctrlKey?: boolean;
    altKey?: boolean;
    shiftKey?: boolean;
    metaKey?: boolean;
  } = {}
): KeyboardEvent {
  return {
    key,
    code: options.code ?? "",
    ctrlKey: options.ctrlKey ?? false,
    altKey: options.altKey ?? false,
    shiftKey: options.shiftKey ?? false,
    metaKey: options.metaKey ?? false,
  } as KeyboardEvent;
}

describe("key", () => {
  it("creates a simple key combo without modifiers", () => {
    const result = key("k");

    expect(result).toEqual({ key: "k", modifiers: [] });
  });

  it("works with special keys", () => {
    const result = key("Enter");

    expect(result).toEqual({ key: "Enter", modifiers: [] });
  });

  it("works with arrow keys", () => {
    const result = key("ArrowUp");

    expect(result).toEqual({ key: "ArrowUp", modifiers: [] });
  });
});

describe("combo", () => {
  it("creates a key combo with a single modifier", () => {
    const result = combo("k", "ctrl");

    expect(result).toEqual({ key: "k", modifiers: ["ctrl"] });
  });

  it("creates a key combo with multiple modifiers", () => {
    const result = combo("s", "ctrl", "shift");

    expect(result).toEqual({ key: "s", modifiers: ["ctrl", "shift"] });
  });

  it("creates a key combo with all modifiers", () => {
    const result = combo("a", "ctrl", "alt", "shift", "meta");

    expect(result).toEqual({
      key: "a",
      modifiers: ["ctrl", "alt", "shift", "meta"],
    });
  });

  it("handles no modifiers like key()", () => {
    const result = combo("k");

    expect(result).toEqual({ key: "k", modifiers: [] });
  });
});

describe("sequence", () => {
  it("creates a sequence of two simple keys", () => {
    const first = key("g");
    const second = key("g");
    const result = sequence(first, second);

    expect(result).toEqual({
      key: "g",
      modifiers: [],
      next: { key: "g", modifiers: [] },
    });
  });

  it("creates a sequence with modifiers on first key", () => {
    const first = combo("x", "ctrl");
    const second = key("k");
    const result = sequence(first, second);

    expect(result).toEqual({
      key: "x",
      modifiers: ["ctrl"],
      next: { key: "k", modifiers: [] },
    });
  });

  it("creates a sequence with modifiers on both keys", () => {
    const first = combo("x", "ctrl");
    const second = combo("c", "ctrl");
    const result = sequence(first, second);

    expect(result).toEqual({
      key: "x",
      modifiers: ["ctrl"],
      next: { key: "c", modifiers: ["ctrl"] },
    });
  });
});

describe("matchesCombo", () => {
  describe("simple keys without modifiers", () => {
    it("matches a simple key press", () => {
      const comboKey = key("k");
      const event = mockKeyboardEvent("k");

      expect(matchesCombo(event, comboKey)).toBe(true);
    });

    it("does not match different key", () => {
      const comboKey = key("k");
      const event = mockKeyboardEvent("j");

      expect(matchesCombo(event, comboKey)).toBe(false);
    });

    it("does not match when extra modifiers are pressed", () => {
      const comboKey = key("k");
      const event = mockKeyboardEvent("k", { ctrlKey: true });

      expect(matchesCombo(event, comboKey)).toBe(false);
    });
  });

  describe("keys with modifiers", () => {
    it("matches Ctrl+K", () => {
      const comboKey = combo("k", "ctrl");
      const event = mockKeyboardEvent("k", { ctrlKey: true });

      expect(matchesCombo(event, comboKey)).toBe(true);
    });

    it("does not match Ctrl+K when only K is pressed", () => {
      const comboKey = combo("k", "ctrl");
      const event = mockKeyboardEvent("k");

      expect(matchesCombo(event, comboKey)).toBe(false);
    });

    it("matches multiple modifiers", () => {
      const comboKey = combo("s", "ctrl", "shift");
      const event = mockKeyboardEvent("s", { ctrlKey: true, shiftKey: true });

      expect(matchesCombo(event, comboKey)).toBe(true);
    });

    it("does not match when missing a modifier", () => {
      const comboKey = combo("s", "ctrl", "shift");
      const event = mockKeyboardEvent("s", { ctrlKey: true });

      expect(matchesCombo(event, comboKey)).toBe(false);
    });

    it("matches meta modifier", () => {
      const comboKey = combo("c", "meta");
      const event = mockKeyboardEvent("c", { metaKey: true });

      expect(matchesCombo(event, comboKey)).toBe(true);
    });

    it("matches alt modifier", () => {
      const comboKey = combo("f", "alt");
      const event = mockKeyboardEvent("f", { altKey: true });

      expect(matchesCombo(event, comboKey)).toBe(true);
    });
  });

  describe("shift-produced characters", () => {
    it("ignores shift for ? character", () => {
      const comboKey = key("?");
      const event = mockKeyboardEvent("?", { shiftKey: true });

      expect(matchesCombo(event, comboKey)).toBe(true);
    });

    it("ignores shift for uppercase letters", () => {
      const comboKey = combo("G", "shift");
      const event = mockKeyboardEvent("G", { shiftKey: true });

      expect(matchesCombo(event, comboKey)).toBe(true);
    });

    it("matches uppercase letter without explicit shift modifier", () => {
      const comboKey = key("H");
      const event = mockKeyboardEvent("H", { shiftKey: true });

      expect(matchesCombo(event, comboKey)).toBe(true);
    });

    it("matches letter shortcuts from physical key code with alt+shift", () => {
      const comboKey = combo("H", "alt", "shift");
      const event = mockKeyboardEvent("Ó", {
        code: "KeyH",
        altKey: true,
        shiftKey: true,
      });

      expect(matchesCombo(event, comboKey)).toBe(true);
    });

    it("still requires other modifiers with shift-produced characters", () => {
      const comboKey = combo("?", "ctrl");
      const event = mockKeyboardEvent("?", { shiftKey: true });

      expect(matchesCombo(event, comboKey)).toBe(false);
    });

    it("matches shift-produced character with ctrl", () => {
      const comboKey = combo("?", "ctrl");
      const event = mockKeyboardEvent("?", { ctrlKey: true, shiftKey: true });

      expect(matchesCombo(event, comboKey)).toBe(true);
    });
  });
});

describe("matchesAction", () => {
  it("matches when event matches any combo in action", () => {
    const action: KeybindingAction = {
      id: "test.action",
      label: "Test Action",
      combos: [key("h"), key("ArrowLeft")],
    };
    const event = mockKeyboardEvent("ArrowLeft");

    expect(matchesAction(event, action)).toBe(true);
  });

  it("matches first combo in list", () => {
    const action: KeybindingAction = {
      id: "test.action",
      label: "Test Action",
      combos: [key("h"), key("ArrowLeft")],
    };
    const event = mockKeyboardEvent("h");

    expect(matchesAction(event, action)).toBe(true);
  });

  it("returns false when no combo matches", () => {
    const action: KeybindingAction = {
      id: "test.action",
      label: "Test Action",
      combos: [key("h"), key("ArrowLeft")],
    };
    const event = mockKeyboardEvent("j");

    expect(matchesAction(event, action)).toBe(false);
  });

  it("returns false for empty combos array", () => {
    const action: KeybindingAction = {
      id: "test.action",
      label: "Test Action",
      combos: [],
    };
    const event = mockKeyboardEvent("k");

    expect(matchesAction(event, action)).toBe(false);
  });
});

describe("findMatchingAction", () => {
  const actions: KeybindingAction[] = [
    { id: "move.left", label: "Move Left", combos: [key("h"), key("ArrowLeft")] },
    { id: "move.right", label: "Move Right", combos: [key("l"), key("ArrowRight")] },
    { id: "help", label: "Help", combos: [key("?")] },
  ];

  it("finds matching action", () => {
    const event = mockKeyboardEvent("h");
    const result = findMatchingAction(event, actions);

    expect(result).not.toBeNull();
    expect(result?.id).toBe("move.left");
  });

  it("finds action by alternative combo", () => {
    const event = mockKeyboardEvent("ArrowRight");
    const result = findMatchingAction(event, actions);

    expect(result).not.toBeNull();
    expect(result?.id).toBe("move.right");
  });

  it("returns first matching action when multiple could match", () => {
    const duplicateActions: KeybindingAction[] = [
      { id: "first", label: "First", combos: [key("k")] },
      { id: "second", label: "Second", combos: [key("k")] },
    ];
    const event = mockKeyboardEvent("k");
    const result = findMatchingAction(event, duplicateActions);

    expect(result?.id).toBe("first");
  });

  it("returns null when no action matches", () => {
    const event = mockKeyboardEvent("x");
    const result = findMatchingAction(event, actions);

    expect(result).toBeNull();
  });

  it("returns null for empty actions array", () => {
    const event = mockKeyboardEvent("k");
    const result = findMatchingAction(event, []);

    expect(result).toBeNull();
  });
});

describe("getKeyDisplay", () => {
  it("converts space to symbol", () => {
    expect(getKeyDisplay(" ")).toBe("␣");
  });

  it("converts Enter to symbol", () => {
    expect(getKeyDisplay("Enter")).toBe("↩");
  });

  it("converts Escape to esc", () => {
    expect(getKeyDisplay("Escape")).toBe("esc");
  });

  it("converts Backspace to symbol", () => {
    expect(getKeyDisplay("Backspace")).toBe("⌫");
  });

  it("converts arrow keys to symbols", () => {
    expect(getKeyDisplay("ArrowLeft")).toBe("←");
    expect(getKeyDisplay("ArrowRight")).toBe("→");
    expect(getKeyDisplay("ArrowUp")).toBe("↑");
    expect(getKeyDisplay("ArrowDown")).toBe("↓");
  });

  it("converts Tab to symbol", () => {
    expect(getKeyDisplay("Tab")).toBe("⇥");
  });

  it("converts Delete to symbol", () => {
    expect(getKeyDisplay("Delete")).toBe("⌦");
  });

  it("returns regular keys unchanged", () => {
    expect(getKeyDisplay("k")).toBe("k");
    expect(getKeyDisplay("a")).toBe("a");
    expect(getKeyDisplay("?")).toBe("?");
  });
});

describe("getComboDisplay", () => {
  it("displays simple key", () => {
    expect(getComboDisplay(key("k"))).toBe("k");
  });

  it("displays key with ctrl modifier", () => {
    expect(getComboDisplay(combo("k", "ctrl"))).toBe("^k");
  });

  it("displays key with alt modifier", () => {
    expect(getComboDisplay(combo("f", "alt"))).toBe("⌥f");
  });

  it("displays key with meta modifier", () => {
    expect(getComboDisplay(combo("c", "meta"))).toBe("⌘c");
  });

  it("displays key with multiple modifiers", () => {
    const result = getComboDisplay(combo("s", "ctrl", "shift"));

    expect(result).toBe("^⇧s");
  });

  it("displays uppercase letter with shift as just the letter", () => {
    const result = getComboDisplay(combo("G", "shift"));

    expect(result).toBe("G");
  });

  it("displays special keys with symbols", () => {
    expect(getComboDisplay(key("ArrowUp"))).toBe("↑");
    expect(getComboDisplay(key("Enter"))).toBe("↩");
  });

  it("displays sequence of simple single chars concatenated", () => {
    const seq = sequence(key("g"), key("g"));

    expect(getComboDisplay(seq)).toBe("gg");
  });

  it("displays sequence with modifiers with space", () => {
    const seq = sequence(combo("x", "ctrl"), key("k"));

    expect(getComboDisplay(seq)).toBe("^x k");
  });

  it("displays sequence of non-single-char keys with space", () => {
    const seq = sequence(key("Enter"), key("Enter"));

    expect(getComboDisplay(seq)).toBe("↩ ↩");
  });
});

// ---------------------------------------------------------------------------
// getCombosDisplay()
// ---------------------------------------------------------------------------

describe("getCombosDisplay", () => {
  it("returns array of display strings", () => {
    const combos: KeyCombo[] = [key("h"), key("ArrowLeft")];
    const result = getCombosDisplay(combos);

    expect(result).toEqual(["h", "←"]);
  });

  it("handles empty array", () => {
    expect(getCombosDisplay([])).toEqual([]);
  });

  it("handles complex combos", () => {
    const combos: KeyCombo[] = [combo("s", "ctrl"), key("Enter")];
    const result = getCombosDisplay(combos);

    expect(result).toEqual(["^s", "↩"]);
  });
});

// ---------------------------------------------------------------------------
// isArrowKey()
// ---------------------------------------------------------------------------

describe("isArrowKey", () => {
  it("returns true for arrow symbols", () => {
    expect(isArrowKey("←")).toBe(true);
    expect(isArrowKey("→")).toBe(true);
    expect(isArrowKey("↑")).toBe(true);
    expect(isArrowKey("↓")).toBe(true);
  });

  it("returns false for non-arrow symbols", () => {
    expect(isArrowKey("k")).toBe(false);
    expect(isArrowKey("↩")).toBe(false);
    expect(isArrowKey("ArrowLeft")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// getArrowDirection()
// ---------------------------------------------------------------------------

describe("getArrowDirection", () => {
  it("returns left for left arrow", () => {
    expect(getArrowDirection("←")).toBe("left");
  });

  it("returns right for right arrow", () => {
    expect(getArrowDirection("→")).toBe("right");
  });

  it("returns up for up arrow", () => {
    expect(getArrowDirection("↑")).toBe("up");
  });

  it("returns down for down arrow", () => {
    expect(getArrowDirection("↓")).toBe("down");
  });

  it("returns null for non-arrow", () => {
    expect(getArrowDirection("k")).toBeNull();
    expect(getArrowDirection("ArrowUp")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// scopeToContext()
// ---------------------------------------------------------------------------

describe("scopeToContext", () => {
  it("maps global scope to global context", () => {
    expect(scopeToContext("global")).toBe("global");
  });

  it("maps sheet-commands scope to sheet-commands context", () => {
    expect(scopeToContext("sheet-commands")).toBe("sheet-commands");
  });

  it("returns null for unknown scope", () => {
    expect(scopeToContext("home" as "global")).toBeNull();
    expect(scopeToContext("sheet" as "global")).toBeNull();
  });
});
