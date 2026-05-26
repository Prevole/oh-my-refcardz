import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { dispatchKeyEvent, isEditableTarget } from "./keyboard-dispatch";
import type {
  ActionHandler,
  BoundHandler,
} from "@/lib/action-handler-registry";
import type {
  KeybindingAction,
  KeybindingContext,
} from "@/lib/keybindings";
import { ACTION_IDS, key, combo } from "@/lib/keybindings";
import type { KeyboardScopeId, ScopeEntry } from "@/lib/keyboard-scope";

// `KeyboardEvent` is not available in the node test env; we use a structural
// mock that exposes the same surface the dispatch routine reads from.
type MockKeyboardEvent = {
  key: string;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  metaKey: boolean;
  target: unknown;
  defaultPrevented: boolean;
  preventDefault: () => void;
};

function makeEvent(
  key: string,
  modifiers: Partial<
    Pick<MockKeyboardEvent, "ctrlKey" | "shiftKey" | "altKey" | "metaKey">
  > = {},
  target: unknown = null,
): MockKeyboardEvent {
  const event: MockKeyboardEvent = {
    key,
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    metaKey: false,
    target,
    defaultPrevented: false,
    preventDefault() {
      this.defaultPrevented = true;
    },
    ...modifiers,
  };
  return event;
}

// `isEditableTarget` and the dispatcher narrow via `instanceof HTMLElement`.
// In the node env, `HTMLElement` is undefined, so we install a lightweight
// global shim for the duration of the tests.
class FakeHTMLElement {
  tagName: string;
  isContentEditable: boolean;
  constructor(tagName: string, isContentEditable = false) {
    this.tagName = tagName.toUpperCase();
    this.isContentEditable = isContentEditable;
  }
}

// Expose to the global scope so `target instanceof HTMLElement` works.
(globalThis as unknown as { HTMLElement: typeof FakeHTMLElement }).HTMLElement =
  FakeHTMLElement;

function el(tag: string, isContentEditable = false): FakeHTMLElement {
  return new FakeHTMLElement(tag, isContentEditable);
}

interface MockRegistry {
  bind: (
    actionId: string,
    scope: KeyboardScopeId,
    handler: ActionHandler,
  ) => void;
  getHandlersForScope: (scope: KeyboardScopeId) => BoundHandler[];
}

function makeRegistry(): MockRegistry {
  const store = new Map<KeyboardScopeId, Map<string, ActionHandler>>();
  return {
    bind(actionId, scope, handler) {
      let m = store.get(scope);
      if (!m) {
        m = new Map();
        store.set(scope, m);
      }
      m.set(actionId, handler);
    },
    getHandlersForScope(scope) {
      const m = store.get(scope);
      if (!m) return [];
      return [...m].map(([actionId, handler]) => ({
        actionId,
        scope,
        handler,
      }));
    },
  };
}

const ROOT: ScopeEntry = { scope: "global", modal: false };

function s(scope: KeyboardScopeId, modal = false): ScopeEntry {
  return { scope, modal };
}

function defaultActions(): Record<KeybindingContext, KeybindingAction[]> {
  return {
    global: [
      {
        id: ACTION_IDS.OPEN_COMMAND_PALETTE,
        label: "Open palette",
        combos: [combo("k", "ctrl")],
      },
      {
        id: ACTION_IDS.TOGGLE_HELP,
        label: "Toggle help",
        combos: [key("?")],
      },
      {
        id: ACTION_IDS.TOGGLE_SETTINGS,
        label: "Toggle settings",
        combos: [key(",")],
      },
    ],
    home: [],
    sheet: [],
    "sheet-layout": [],
    dev: [
      {
        id: ACTION_IDS.DEV_SAVE_LAYOUT,
        label: "Save",
        combos: [key("s")],
      },
      {
        id: ACTION_IDS.DEV_RESET_LAYOUT,
        label: "Reset",
        combos: [combo("R", "shift")],
      },
    ],
    "dev-logs": [
      {
        id: ACTION_IDS.DEV_LOGS_CURSOR_DOWN,
        label: "Down",
        combos: [key("j")],
      },
      {
        id: ACTION_IDS.DEV_LOGS_CLOSE,
        label: "Close",
        combos: [key("Escape")],
      },
    ],
    "dev-axes": [],
  };
}

describe("dispatchKeyEvent", () => {
  let registry: MockRegistry;
  let actions: Record<KeybindingContext, KeybindingAction[]>;

  beforeEach(() => {
    registry = makeRegistry();
    actions = defaultActions();
  });

  function deps() {
    return {
      getActionsForContext: (ctx: KeybindingContext) => actions[ctx],
      getHandlersForScope: registry.getHandlersForScope,
    };
  }

  function dispatch(
    event: MockKeyboardEvent,
    stack: ScopeEntry[],
    onConflict?: (scope: KeyboardScopeId, ids: string[]) => void,
  ) {
    return dispatchKeyEvent(
      event as unknown as KeyboardEvent,
      stack,
      deps(),
      onConflict,
    );
  }

  it("returns no-match when no handler is bound", () => {
    const out = dispatch(makeEvent("s"), [ROOT, s("dev")]);
    expect(out).toEqual({ kind: "no-match" });
  });

  it("runs a matching handler in the top scope and stops", () => {
    const handler = vi.fn();
    registry.bind(ACTION_IDS.DEV_SAVE_LAYOUT, "dev", handler);
    const event = makeEvent("s");
    const out = dispatch(event, [ROOT, s("dev")]);
    expect(handler).toHaveBeenCalledOnce();
    expect(out).toMatchObject({
      kind: "matched",
      scope: "dev",
      actionId: ACTION_IDS.DEV_SAVE_LAYOUT,
    });
    expect(event.defaultPrevented).toBe(true);
  });

  it("ignores events targeting <input>", () => {
    const handler = vi.fn();
    registry.bind(ACTION_IDS.DEV_SAVE_LAYOUT, "dev", handler);
    const out = dispatch(makeEvent("s", {}, el("input")), [ROOT, s("dev")]);
    expect(handler).not.toHaveBeenCalled();
    expect(out).toEqual({ kind: "ignored-editable" });
  });

  it("ignores events targeting contenteditable", () => {
    const handler = vi.fn();
    registry.bind(ACTION_IDS.DEV_SAVE_LAYOUT, "dev", handler);
    const out = dispatch(makeEvent("s", {}, el("div", true)), [ROOT, s("dev")]);
    expect(handler).not.toHaveBeenCalled();
    expect(out).toEqual({ kind: "ignored-editable" });
  });

  describe("cascade", () => {
    it("falls through to a lower scope when top has no matches (non-modal)", () => {
      const globalHandler = vi.fn();
      registry.bind(ACTION_IDS.OPEN_COMMAND_PALETTE, "global", globalHandler);
      const stack: ScopeEntry[] = [ROOT, s("dev", false)];
      const out = dispatch(makeEvent("k", { ctrlKey: true }), stack);
      expect(globalHandler).toHaveBeenCalledOnce();
      expect(out).toMatchObject({ kind: "matched", scope: "global" });
    });

    it("falls through a scope that maps to no context (e.g. home, non-modal)", () => {
      const globalHandler = vi.fn();
      registry.bind(ACTION_IDS.OPEN_COMMAND_PALETTE, "global", globalHandler);
      const stack: ScopeEntry[] = [ROOT, s("home", false)];
      const out = dispatch(makeEvent("k", { ctrlKey: true }), stack);
      expect(globalHandler).toHaveBeenCalledOnce();
      expect(out).toMatchObject({ kind: "matched", scope: "global" });
    });
  });

  describe("modality", () => {
    it("blocks cascade when a modal scope has no matches", () => {
      const globalHandler = vi.fn();
      registry.bind(ACTION_IDS.OPEN_COMMAND_PALETTE, "global", globalHandler);
      const stack: ScopeEntry[] = [ROOT, s("dev", true)];
      const out = dispatch(makeEvent("k", { ctrlKey: true }), stack);
      expect(globalHandler).not.toHaveBeenCalled();
      expect(out).toEqual({ kind: "blocked-modal", scope: "dev" });
    });

    it("blocks cascade when a modal scope maps to null context", () => {
      const globalHandler = vi.fn();
      registry.bind(ACTION_IDS.OPEN_COMMAND_PALETTE, "global", globalHandler);
      const stack: ScopeEntry[] = [ROOT, s("home", true)];
      const out = dispatch(makeEvent("k", { ctrlKey: true }), stack);
      expect(globalHandler).not.toHaveBeenCalled();
      expect(out).toEqual({ kind: "blocked-modal", scope: "home" });
    });

    it("modal dev-logs blocks parent dev shortcuts (regression)", () => {
      const saveHandler = vi.fn();
      const cursorDownHandler = vi.fn();
      registry.bind(ACTION_IDS.DEV_SAVE_LAYOUT, "dev", saveHandler);
      registry.bind(
        ACTION_IDS.DEV_LOGS_CURSOR_DOWN,
        "dev-logs",
        cursorDownHandler,
      );
      const stack: ScopeEntry[] = [ROOT, s("dev", true), s("dev-logs", true)];

      const out1 = dispatch(makeEvent("w"), stack);
      expect(saveHandler).not.toHaveBeenCalled();
      expect(out1).toEqual({ kind: "blocked-modal", scope: "dev-logs" });

      const out2 = dispatch(makeEvent("j"), stack);
      expect(cursorDownHandler).toHaveBeenCalledOnce();
      expect(out2).toMatchObject({ kind: "matched", scope: "dev-logs" });
    });
  });

  describe("conflicts", () => {
    const originalEnv = process.env.NODE_ENV;
    beforeEach(() => {
      process.env.NODE_ENV = "development";
    });
    afterEach(() => {
      process.env.NODE_ENV = originalEnv;
    });

    it("throws in development when two handlers match the same event", () => {
      actions.dev = [
        ...actions.dev,
        {
          id: "dev.duplicate",
          label: "Duplicate",
          combos: [key("s")],
        },
      ];
      registry.bind(ACTION_IDS.DEV_SAVE_LAYOUT, "dev", vi.fn());
      registry.bind("dev.duplicate", "dev", vi.fn());
      const stack: ScopeEntry[] = [ROOT, s("dev", true)];
      expect(() => dispatch(makeEvent("s"), stack)).toThrow(
        /Conflicting key handlers/,
      );
    });

    it("calls onConflict and runs first match in non-dev environments", () => {
      process.env.NODE_ENV = "production";
      actions.dev = [
        ...actions.dev,
        {
          id: "dev.duplicate",
          label: "Duplicate",
          combos: [key("s")],
        },
      ];
      const firstHandler = vi.fn();
      const secondHandler = vi.fn();
      registry.bind(ACTION_IDS.DEV_SAVE_LAYOUT, "dev", firstHandler);
      registry.bind("dev.duplicate", "dev", secondHandler);
      const onConflict = vi.fn();
      const stack: ScopeEntry[] = [ROOT, s("dev", true)];

      const out = dispatch(makeEvent("s"), stack, onConflict);
      expect(onConflict).toHaveBeenCalledWith("dev", [
        ACTION_IDS.DEV_SAVE_LAYOUT,
        "dev.duplicate",
      ]);
      expect(firstHandler).toHaveBeenCalledOnce();
      expect(secondHandler).not.toHaveBeenCalled();
      expect(out).toMatchObject({
        kind: "matched",
        scope: "dev",
        actionId: ACTION_IDS.DEV_SAVE_LAYOUT,
      });
    });
  });

  describe("universals", () => {
    it("fires TOGGLE_HELP from a modal scope even when the cascade would be blocked", () => {
      const handler = vi.fn();
      registry.bind(ACTION_IDS.TOGGLE_HELP, "global", handler);
      const out = dispatch(makeEvent("?"), [ROOT, s("dev", true)]);
      expect(handler).toHaveBeenCalledOnce();
      expect(out).toMatchObject({
        kind: "matched",
        scope: "global",
        actionId: ACTION_IDS.TOGGLE_HELP,
      });
    });

    it("fires TOGGLE_SETTINGS from a deep modal stack", () => {
      const handler = vi.fn();
      registry.bind(ACTION_IDS.TOGGLE_SETTINGS, "global", handler);
      const out = dispatch(makeEvent(","), [
        ROOT,
        s("dev", true),
        s("dev-logs", true),
      ]);
      expect(handler).toHaveBeenCalledOnce();
      expect(out).toMatchObject({
        kind: "matched",
        scope: "global",
        actionId: ACTION_IDS.TOGGLE_SETTINGS,
      });
    });

    it("does not fire a universal when no global handler is bound", () => {
      const out = dispatch(makeEvent("?"), [ROOT, s("dev", true)]);
      expect(out).toEqual({ kind: "blocked-modal", scope: "dev" });
    });

    it("does not pierce modals for non-universal global actions", () => {
      const handler = vi.fn();
      registry.bind(ACTION_IDS.OPEN_COMMAND_PALETTE, "global", handler);
      const out = dispatch(makeEvent("k", { ctrlKey: true }), [
        ROOT,
        s("dev", true),
      ]);
      expect(handler).not.toHaveBeenCalled();
      expect(out).toEqual({ kind: "blocked-modal", scope: "dev" });
    });

    it("runs the universal only once, not the top-scope handler too", () => {
      const globalHandler = vi.fn();
      const devHandler = vi.fn();
      registry.bind(ACTION_IDS.TOGGLE_HELP, "global", globalHandler);
      // Hypothetical: dev also bound to ? (won't happen in practice but
      // verifies pre-pass short-circuits the cascade).
      registry.bind(ACTION_IDS.TOGGLE_HELP, "dev", devHandler);
      const out = dispatch(makeEvent("?"), [ROOT, s("dev", true)]);
      expect(globalHandler).toHaveBeenCalledOnce();
      expect(devHandler).not.toHaveBeenCalled();
      expect(out).toMatchObject({
        kind: "matched",
        scope: "global",
        actionId: ACTION_IDS.TOGGLE_HELP,
      });
    });
  });

  describe("isEditableTarget", () => {
    it("returns true for INPUT, TEXTAREA, SELECT", () => {
      expect(isEditableTarget(el("input"))).toBe(true);
      expect(isEditableTarget(el("textarea"))).toBe(true);
      expect(isEditableTarget(el("select"))).toBe(true);
    });

    it("returns true for contenteditable elements", () => {
      expect(isEditableTarget(el("div", true))).toBe(true);
    });

    it("returns false for plain non-editable elements", () => {
      expect(isEditableTarget(el("div"))).toBe(false);
    });

    it("returns false for null", () => {
      expect(isEditableTarget(null)).toBe(false);
    });

    it("returns false for non-HTMLElement targets", () => {
      expect(isEditableTarget({})).toBe(false);
    });
  });
});
