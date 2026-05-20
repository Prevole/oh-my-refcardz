"use client";

/**
 * Zellij-style modal keyboard control for the layout.
 *
 * Press `Ctrl+M` (LAYOUT_ENTER_MODE) from any sheet to enter layout mode.
 * The mode is entered in the `navigation` sub-mode by default. From there:
 *
 *   - `n` / `m` / `r` switch between navigation, move and resize sub-modes;
 *   - `Escape` exits the mode entirely;
 *   - `h` / `j` / `k` / `l` (and arrow keys) act on the focused block in a
 *     way that depends on the active sub-mode.
 *
 * Behavioural details (modifiers, strict moves, compact resize, etc.) are
 * defined exclusively by the keybindings registered in `src/lib/keybindings.ts`
 * — this hook only maps `actionId` → engine operation.
 *
 * Focus management: a single `focusedBlockId` is kept internally for the
 * duration of the layout mode. Spatial navigation picks the nearest block in
 * the requested direction whose projection on the perpendicular axis overlaps
 * the focused block. When no candidate is found the focus stays put.
 *
 * Engine integration: every keystroke that performs a layout edit submits a
 * `MoveOperation` or `ResizeOperation` to the editor through `applyOneShot`.
 * The engine is the sole authority on what is accepted, so all push / wrap /
 * shrink rules are inherited for free.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import type {
  Direction,
  LayoutBlock,
  MoveOperation,
  OperationOptions,
  ResizeOperation,
} from "@/lib/layout/engine";
import { ACTION_IDS } from "@/lib/keybindings";
import { useAction } from "@/hooks/use-action";
import { useKeyboardScope, useScopedKeyboardHandler } from "@/hooks/use-keyboard-context";
import { useKeybindings } from "@/hooks/use-keybindings";
import type { UseLayoutEditorResult } from "./use-layout-editor";

export type LayoutSubMode = "navigation" | "move" | "resize";

export type LayoutKeyboardFocus = {
  blockId: string;
};

export type UseLayoutKeyboardResult = {
  /** Current sub-mode, or `null` when layout mode is not active. */
  mode: LayoutSubMode | null;
  /** Currently focused block in layout mode (drives keyboard ops). */
  focusedCard: LayoutKeyboardFocus | null;
  /** Backwards-compatible alias kept for the existing renderer surface. */
  setFocusedCard: Dispatch<SetStateAction<LayoutKeyboardFocus | null>>;
  /** True while a keystroke-driven move/resize is happening. */
  isManipulating: boolean;
};

type UseLayoutKeyboardOptions = {
  blocks: LayoutBlock[];
  editor: UseLayoutEditorResult;
};

/* -------------------------------------------------------------------------- */
/* Spatial navigation                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Return the id of the block that is the nearest neighbour of `focusedId`
 * in `direction`, or `null` if no candidate has any overlap on the
 * perpendicular axis.
 */
export function findNeighbour(
  blocks: readonly LayoutBlock[],
  focusedId: string,
  direction: Direction,
): string | null {
  const focused = blocks.find((b) => b.id === focusedId);
  if (!focused) return null;
  const fx = focused.position.x;
  const fy = focused.position.y;
  const fw = focused.position.w;
  const fh = focused.position.h;
  const fRight = fx + fw;
  const fBottom = fy + fh;

  let best: { id: string; primary: number; secondary: number } | null = null;
  for (const candidate of blocks) {
    if (candidate.id === focusedId) continue;
    const cx = candidate.position.x;
    const cy = candidate.position.y;
    const cw = candidate.position.w;
    const ch = candidate.position.h;

    let primary: number;
    let secondary: number;
    let overlap: number;

    if (direction === "west") {
      if (cx + cw > fx) continue;
      primary = fx - (cx + cw);
      overlap = Math.min(fBottom, cy + ch) - Math.max(fy, cy);
      secondary = Math.abs(cy - fy);
    } else if (direction === "east") {
      if (cx < fRight) continue;
      primary = cx - fRight;
      overlap = Math.min(fBottom, cy + ch) - Math.max(fy, cy);
      secondary = Math.abs(cy - fy);
    } else if (direction === "north") {
      if (cy + ch > fy) continue;
      primary = fy - (cy + ch);
      overlap = Math.min(fRight, cx + cw) - Math.max(fx, cx);
      secondary = Math.abs(cx - fx);
    } else {
      if (cy < fBottom) continue;
      primary = cy - fBottom;
      overlap = Math.min(fRight, cx + cw) - Math.max(fx, cx);
      secondary = Math.abs(cx - fx);
    }

    if (overlap <= 0) continue;

    if (
      !best ||
      primary < best.primary ||
      (primary === best.primary && secondary < best.secondary)
    ) {
      best = { id: candidate.id, primary, secondary };
    }
  }
  return best?.id ?? null;
}

/**
 * Pick the top-left block in the supplied list. Deterministic order: lowest y,
 * then lowest x, then first id.
 */
export function pickTopLeftBlock(blocks: readonly LayoutBlock[]): string | null {
  if (blocks.length === 0) return null;
  let best = blocks[0];
  for (const block of blocks) {
    if (
      block.position.y < best.position.y ||
      (block.position.y === best.position.y && block.position.x < best.position.x)
    ) {
      best = block;
    }
  }
  return best.id;
}

/* -------------------------------------------------------------------------- */
/* Action → operation mapping                                                  */
/* -------------------------------------------------------------------------- */

type MoveSpec = { kind: "move"; direction: Direction; strict: boolean };
type ResizeSpec = {
  kind: "resize";
  edge: Direction;
  delta: 1 | -1;
  strict: boolean;
  compact: boolean;
};

const MOVE_ACTIONS: ReadonlyMap<string, MoveSpec> = new Map([
  [ACTION_IDS.LAYOUT_MOVE_LEFT, { kind: "move", direction: "west", strict: false }],
  [ACTION_IDS.LAYOUT_MOVE_RIGHT, { kind: "move", direction: "east", strict: false }],
  [ACTION_IDS.LAYOUT_MOVE_UP, { kind: "move", direction: "north", strict: false }],
  [ACTION_IDS.LAYOUT_MOVE_DOWN, { kind: "move", direction: "south", strict: false }],
  [ACTION_IDS.LAYOUT_MOVE_STRICT_LEFT, { kind: "move", direction: "west", strict: true }],
  [ACTION_IDS.LAYOUT_MOVE_STRICT_RIGHT, { kind: "move", direction: "east", strict: true }],
  [ACTION_IDS.LAYOUT_MOVE_STRICT_UP, { kind: "move", direction: "north", strict: true }],
  [ACTION_IDS.LAYOUT_MOVE_STRICT_DOWN, { kind: "move", direction: "south", strict: true }],
]);

const RESIZE_ACTIONS: ReadonlyMap<string, ResizeSpec> = new Map([
  // grow: extend the edge outward (positive delta on west/east/north/south).
  [ACTION_IDS.LAYOUT_RESIZE_GROW_LEFT, { kind: "resize", edge: "west", delta: 1, strict: false, compact: false }],
  [ACTION_IDS.LAYOUT_RESIZE_GROW_RIGHT, { kind: "resize", edge: "east", delta: 1, strict: false, compact: false }],
  [ACTION_IDS.LAYOUT_RESIZE_GROW_UP, { kind: "resize", edge: "north", delta: 1, strict: false, compact: false }],
  [ACTION_IDS.LAYOUT_RESIZE_GROW_DOWN, { kind: "resize", edge: "south", delta: 1, strict: false, compact: false }],
  // shrink: pull the edge inward (negative delta on the same edge).
  [ACTION_IDS.LAYOUT_RESIZE_SHRINK_LEFT, { kind: "resize", edge: "west", delta: -1, strict: false, compact: false }],
  [ACTION_IDS.LAYOUT_RESIZE_SHRINK_RIGHT, { kind: "resize", edge: "east", delta: -1, strict: false, compact: false }],
  [ACTION_IDS.LAYOUT_RESIZE_SHRINK_UP, { kind: "resize", edge: "north", delta: -1, strict: false, compact: false }],
  [ACTION_IDS.LAYOUT_RESIZE_SHRINK_DOWN, { kind: "resize", edge: "south", delta: -1, strict: false, compact: false }],
  // grow strict
  [ACTION_IDS.LAYOUT_RESIZE_GROW_STRICT_LEFT, { kind: "resize", edge: "west", delta: 1, strict: true, compact: false }],
  [ACTION_IDS.LAYOUT_RESIZE_GROW_STRICT_RIGHT, { kind: "resize", edge: "east", delta: 1, strict: true, compact: false }],
  [ACTION_IDS.LAYOUT_RESIZE_GROW_STRICT_UP, { kind: "resize", edge: "north", delta: 1, strict: true, compact: false }],
  [ACTION_IDS.LAYOUT_RESIZE_GROW_STRICT_DOWN, { kind: "resize", edge: "south", delta: 1, strict: true, compact: false }],
  // shrink strict
  [ACTION_IDS.LAYOUT_RESIZE_SHRINK_STRICT_LEFT, { kind: "resize", edge: "west", delta: -1, strict: true, compact: false }],
  [ACTION_IDS.LAYOUT_RESIZE_SHRINK_STRICT_RIGHT, { kind: "resize", edge: "east", delta: -1, strict: true, compact: false }],
  [ACTION_IDS.LAYOUT_RESIZE_SHRINK_STRICT_UP, { kind: "resize", edge: "north", delta: -1, strict: true, compact: false }],
  [ACTION_IDS.LAYOUT_RESIZE_SHRINK_STRICT_DOWN, { kind: "resize", edge: "south", delta: -1, strict: true, compact: false }],
  // shrink compact (pulls neighbors in)
  [ACTION_IDS.LAYOUT_RESIZE_SHRINK_COMPACT_LEFT, { kind: "resize", edge: "west", delta: -1, strict: false, compact: true }],
  [ACTION_IDS.LAYOUT_RESIZE_SHRINK_COMPACT_RIGHT, { kind: "resize", edge: "east", delta: -1, strict: false, compact: true }],
  [ACTION_IDS.LAYOUT_RESIZE_SHRINK_COMPACT_UP, { kind: "resize", edge: "north", delta: -1, strict: false, compact: true }],
  [ACTION_IDS.LAYOUT_RESIZE_SHRINK_COMPACT_DOWN, { kind: "resize", edge: "south", delta: -1, strict: false, compact: true }],
]);

const NAV_ACTIONS: ReadonlyMap<string, Direction> = new Map([
  [ACTION_IDS.LAYOUT_NAV_LEFT, "west"],
  [ACTION_IDS.LAYOUT_NAV_RIGHT, "east"],
  [ACTION_IDS.LAYOUT_NAV_UP, "north"],
  [ACTION_IDS.LAYOUT_NAV_DOWN, "south"],
]);

export function moveSpecFromAction(actionId: string): MoveSpec | undefined {
  return MOVE_ACTIONS.get(actionId);
}

export function resizeSpecFromAction(actionId: string): ResizeSpec | undefined {
  return RESIZE_ACTIONS.get(actionId);
}

export function navDirectionFromAction(actionId: string): Direction | undefined {
  return NAV_ACTIONS.get(actionId);
}

export function buildMoveOperation(blockId: string, spec: MoveSpec): MoveOperation {
  const options: OperationOptions = spec.strict
    ? { allowWrap: false, allowShrink: false }
    : {};
  let dx = 0;
  let dy = 0;
  switch (spec.direction) {
    case "west":
      dx = -1;
      break;
    case "east":
      dx = 1;
      break;
    case "north":
      dy = -1;
      break;
    case "south":
      dy = 1;
      break;
  }
  return { kind: "move", blockId, dx, dy, options };
}

export function buildResizeOperation(blockId: string, spec: ResizeSpec): ResizeOperation {
  const options: OperationOptions = {};
  if (spec.strict) {
    options.allowShrink = false;
    options.allowWrap = false;
  }
  if (spec.compact) {
    options.compact = true;
  }
  return {
    kind: "resize",
    blockId,
    edge: spec.edge,
    delta: spec.delta,
    options,
  };
}

/* -------------------------------------------------------------------------- */
/* Hook                                                                        */
/* -------------------------------------------------------------------------- */

export function useLayoutKeyboard({
  blocks,
  editor,
}: UseLayoutKeyboardOptions): UseLayoutKeyboardResult {
  const [mode, setMode] = useState<LayoutSubMode | null>(null);
  const [focusedCard, setFocusedCard] = useState<LayoutKeyboardFocus | null>(null);
  const [isManipulating, setIsManipulating] = useState(false);
  const manipulatingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep a live ref to blocks for handlers (they capture once per scope id).
  const blocksRef = useRef(blocks);
  useEffect(() => {
    blocksRef.current = blocks;
  }, [blocks]);

  // Cascade modal scopes: parent `layout` while the mode is active, plus the
  // active sub-mode scope. The dispatcher walks top-down so the sub-mode wins
  // on conflicts, then falls through to `layout` (currently empty).
  useKeyboardScope("layout", mode !== null, { modal: true });
  useKeyboardScope("layout-navigation", mode === "navigation", { modal: true });
  useKeyboardScope("layout-move", mode === "move", { modal: true });
  useKeyboardScope("layout-resize", mode === "resize", { modal: true });

  const enterMode = useCallback(() => {
    setMode("navigation");
    setFocusedCard((current) => {
      if (current) return current;
      const id = pickTopLeftBlock(blocksRef.current);
      return id ? { blockId: id } : null;
    });
  }, []);

  const exitMode = useCallback(() => {
    setMode(null);
    setFocusedCard(null);
  }, []);

  const flashManipulating = useCallback(() => {
    setIsManipulating(true);
    if (manipulatingTimerRef.current) clearTimeout(manipulatingTimerRef.current);
    manipulatingTimerRef.current = setTimeout(() => {
      setIsManipulating(false);
      manipulatingTimerRef.current = null;
    }, 120);
  }, []);

  useEffect(() => {
    return () => {
      if (manipulatingTimerRef.current) clearTimeout(manipulatingTimerRef.current);
    };
  }, []);

  /* ---------------- entry / sub-mode switching ---------------- */

  // The `sheet` context has no dedicated scope (it lives under `global`), so
  // the entry shortcut is matched manually like other sheet-level bindings.
  const { matchesAction } = useKeybindings();
  useScopedKeyboardHandler(
    "global",
    (event: KeyboardEvent) => {
      if (!matchesAction(event, ACTION_IDS.LAYOUT_ENTER_MODE)) return;
      event.preventDefault();
      enterMode();
    },
    [matchesAction, enterMode]
  );

  useAction(ACTION_IDS.LAYOUT_NAV_TO_MOVE, "layout-navigation", () => {
    setMode("move");
  });
  useAction(ACTION_IDS.LAYOUT_NAV_TO_RESIZE, "layout-navigation", () => {
    setMode("resize");
  });
  useAction(ACTION_IDS.LAYOUT_NAV_EXIT, "layout-navigation", () => {
    exitMode();
  });

  useAction(ACTION_IDS.LAYOUT_MOVE_TO_NAV, "layout-move", () => {
    setMode("navigation");
  });
  useAction(ACTION_IDS.LAYOUT_MOVE_TO_RESIZE, "layout-move", () => {
    setMode("resize");
  });
  useAction(ACTION_IDS.LAYOUT_MOVE_EXIT, "layout-move", () => {
    exitMode();
  });

  useAction(ACTION_IDS.LAYOUT_RESIZE_TO_NAV, "layout-resize", () => {
    setMode("navigation");
  });
  useAction(ACTION_IDS.LAYOUT_RESIZE_TO_MOVE, "layout-resize", () => {
    setMode("move");
  });
  useAction(ACTION_IDS.LAYOUT_RESIZE_EXIT, "layout-resize", () => {
    exitMode();
  });

  /* ---------------- navigation ---------------- */

  const navigateTo = useCallback((direction: Direction) => {
    setFocusedCard((current) => {
      if (!current) {
        const id = pickTopLeftBlock(blocksRef.current);
        return id ? { blockId: id } : null;
      }
      const nextId = findNeighbour(blocksRef.current, current.blockId, direction);
      return nextId ? { blockId: nextId } : current;
    });
  }, []);

  useAction(ACTION_IDS.LAYOUT_NAV_LEFT, "layout-navigation", () => navigateTo("west"));
  useAction(ACTION_IDS.LAYOUT_NAV_RIGHT, "layout-navigation", () => navigateTo("east"));
  useAction(ACTION_IDS.LAYOUT_NAV_UP, "layout-navigation", () => navigateTo("north"));
  useAction(ACTION_IDS.LAYOUT_NAV_DOWN, "layout-navigation", () => navigateTo("south"));

  /* ---------------- move ---------------- */

  const submitMove = useCallback(
    (actionId: string) => {
      const spec = moveSpecFromAction(actionId);
      if (!spec) return;
      const target = focusedCard?.blockId ?? pickTopLeftBlock(blocksRef.current);
      if (!target) return;
      editor.applyOneShot(buildMoveOperation(target, spec));
      flashManipulating();
    },
    [editor, focusedCard, flashManipulating]
  );

  useAction(ACTION_IDS.LAYOUT_MOVE_LEFT, "layout-move", () => submitMove(ACTION_IDS.LAYOUT_MOVE_LEFT));
  useAction(ACTION_IDS.LAYOUT_MOVE_RIGHT, "layout-move", () => submitMove(ACTION_IDS.LAYOUT_MOVE_RIGHT));
  useAction(ACTION_IDS.LAYOUT_MOVE_UP, "layout-move", () => submitMove(ACTION_IDS.LAYOUT_MOVE_UP));
  useAction(ACTION_IDS.LAYOUT_MOVE_DOWN, "layout-move", () => submitMove(ACTION_IDS.LAYOUT_MOVE_DOWN));
  useAction(ACTION_IDS.LAYOUT_MOVE_STRICT_LEFT, "layout-move", () => submitMove(ACTION_IDS.LAYOUT_MOVE_STRICT_LEFT));
  useAction(ACTION_IDS.LAYOUT_MOVE_STRICT_RIGHT, "layout-move", () => submitMove(ACTION_IDS.LAYOUT_MOVE_STRICT_RIGHT));
  useAction(ACTION_IDS.LAYOUT_MOVE_STRICT_UP, "layout-move", () => submitMove(ACTION_IDS.LAYOUT_MOVE_STRICT_UP));
  useAction(ACTION_IDS.LAYOUT_MOVE_STRICT_DOWN, "layout-move", () => submitMove(ACTION_IDS.LAYOUT_MOVE_STRICT_DOWN));

  /* ---------------- resize ---------------- */

  const submitResize = useCallback(
    (actionId: string) => {
      const spec = resizeSpecFromAction(actionId);
      if (!spec) return;
      const target = focusedCard?.blockId ?? pickTopLeftBlock(blocksRef.current);
      if (!target) return;
      editor.applyOneShot(buildResizeOperation(target, spec));
      flashManipulating();
    },
    [editor, focusedCard, flashManipulating]
  );

  useAction(ACTION_IDS.LAYOUT_RESIZE_GROW_LEFT, "layout-resize", () => submitResize(ACTION_IDS.LAYOUT_RESIZE_GROW_LEFT));
  useAction(ACTION_IDS.LAYOUT_RESIZE_GROW_RIGHT, "layout-resize", () => submitResize(ACTION_IDS.LAYOUT_RESIZE_GROW_RIGHT));
  useAction(ACTION_IDS.LAYOUT_RESIZE_GROW_UP, "layout-resize", () => submitResize(ACTION_IDS.LAYOUT_RESIZE_GROW_UP));
  useAction(ACTION_IDS.LAYOUT_RESIZE_GROW_DOWN, "layout-resize", () => submitResize(ACTION_IDS.LAYOUT_RESIZE_GROW_DOWN));
  useAction(ACTION_IDS.LAYOUT_RESIZE_SHRINK_LEFT, "layout-resize", () => submitResize(ACTION_IDS.LAYOUT_RESIZE_SHRINK_LEFT));
  useAction(ACTION_IDS.LAYOUT_RESIZE_SHRINK_RIGHT, "layout-resize", () => submitResize(ACTION_IDS.LAYOUT_RESIZE_SHRINK_RIGHT));
  useAction(ACTION_IDS.LAYOUT_RESIZE_SHRINK_UP, "layout-resize", () => submitResize(ACTION_IDS.LAYOUT_RESIZE_SHRINK_UP));
  useAction(ACTION_IDS.LAYOUT_RESIZE_SHRINK_DOWN, "layout-resize", () => submitResize(ACTION_IDS.LAYOUT_RESIZE_SHRINK_DOWN));
  useAction(ACTION_IDS.LAYOUT_RESIZE_GROW_STRICT_LEFT, "layout-resize", () => submitResize(ACTION_IDS.LAYOUT_RESIZE_GROW_STRICT_LEFT));
  useAction(ACTION_IDS.LAYOUT_RESIZE_GROW_STRICT_RIGHT, "layout-resize", () => submitResize(ACTION_IDS.LAYOUT_RESIZE_GROW_STRICT_RIGHT));
  useAction(ACTION_IDS.LAYOUT_RESIZE_GROW_STRICT_UP, "layout-resize", () => submitResize(ACTION_IDS.LAYOUT_RESIZE_GROW_STRICT_UP));
  useAction(ACTION_IDS.LAYOUT_RESIZE_GROW_STRICT_DOWN, "layout-resize", () => submitResize(ACTION_IDS.LAYOUT_RESIZE_GROW_STRICT_DOWN));
  useAction(ACTION_IDS.LAYOUT_RESIZE_SHRINK_STRICT_LEFT, "layout-resize", () => submitResize(ACTION_IDS.LAYOUT_RESIZE_SHRINK_STRICT_LEFT));
  useAction(ACTION_IDS.LAYOUT_RESIZE_SHRINK_STRICT_RIGHT, "layout-resize", () => submitResize(ACTION_IDS.LAYOUT_RESIZE_SHRINK_STRICT_RIGHT));
  useAction(ACTION_IDS.LAYOUT_RESIZE_SHRINK_STRICT_UP, "layout-resize", () => submitResize(ACTION_IDS.LAYOUT_RESIZE_SHRINK_STRICT_UP));
  useAction(ACTION_IDS.LAYOUT_RESIZE_SHRINK_STRICT_DOWN, "layout-resize", () => submitResize(ACTION_IDS.LAYOUT_RESIZE_SHRINK_STRICT_DOWN));
  useAction(ACTION_IDS.LAYOUT_RESIZE_SHRINK_COMPACT_LEFT, "layout-resize", () => submitResize(ACTION_IDS.LAYOUT_RESIZE_SHRINK_COMPACT_LEFT));
  useAction(ACTION_IDS.LAYOUT_RESIZE_SHRINK_COMPACT_RIGHT, "layout-resize", () => submitResize(ACTION_IDS.LAYOUT_RESIZE_SHRINK_COMPACT_RIGHT));
  useAction(ACTION_IDS.LAYOUT_RESIZE_SHRINK_COMPACT_UP, "layout-resize", () => submitResize(ACTION_IDS.LAYOUT_RESIZE_SHRINK_COMPACT_UP));
  useAction(ACTION_IDS.LAYOUT_RESIZE_SHRINK_COMPACT_DOWN, "layout-resize", () => submitResize(ACTION_IDS.LAYOUT_RESIZE_SHRINK_COMPACT_DOWN));

  return useMemo(
    () => ({
      mode,
      focusedCard,
      setFocusedCard,
      isManipulating,
    }),
    [mode, focusedCard, isManipulating]
  );
}
