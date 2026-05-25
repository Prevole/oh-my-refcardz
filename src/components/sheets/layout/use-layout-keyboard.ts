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
  BlockConstraints,
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
import { debugRecorder } from "@/lib/dev-mode";
import { getBlockConstraintsV2 } from "./block-types";
import type { UseLayoutEditorResult } from "./use-layout-editor";
import type { UseLayoutBufferStateResult } from "./use-layout-buffer-state";

export type LayoutSubMode = "navigation" | "move" | "resize";

export type LayoutKeyboardFocus = {
  blockId: string;
};

/**
 * Number of staged buffer changes from which exiting layout mode opens
 * the `LayoutDiscardConfirm` modal instead of silently throwing the
 * edits away. Below this threshold, `Esc` discards silently — the
 * user's investment is small enough that the safeguard is more noise
 * than help.
 */
export const DISCARD_CONFIRM_THRESHOLD = 5;

export type UseLayoutKeyboardResult = {
  /** Current sub-mode, or `null` when layout mode is not active. */
  mode: LayoutSubMode | null;
  /** Currently focused block in layout mode (drives keyboard ops). */
  focusedCard: LayoutKeyboardFocus | null;
  /** Backwards-compatible alias kept for the existing renderer surface. */
  setFocusedCard: Dispatch<SetStateAction<LayoutKeyboardFocus | null>>;
  /** True while a keystroke-driven move/resize is happening. */
  isManipulating: boolean;
  /** Whether the discard-confirm modal should be rendered. */
  discardConfirmOpen: boolean;
  /** Confirms the pending discard: clear the buffer and exit layout mode. */
  handleDiscardConfirm: () => void;
  /** Cancels the pending discard: close the modal, keep buffer + layout mode. */
  handleDiscardCancel: () => void;
};

type UseLayoutKeyboardOptions = {
  blocks: LayoutBlock[];
  editor: UseLayoutEditorResult;
  bufferState: UseLayoutBufferStateResult;
  gridColumns: number;
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

/**
 * Pick the block whose rendered center is closest to `cursor` (viewport
 * coordinates). Returns `null` if no block has a known rect.
 *
 * `rectFor` is injected for testability — production code passes a closure
 * that reads `document.querySelector('[data-layout-block-id="…"]')`.
 */
export function pickClosestBlockByRects(
  blockIds: readonly string[],
  cursor: { x: number; y: number },
  rectFor: (id: string) => { left: number; top: number; width: number; height: number } | null,
): string | null {
  let best: { id: string; distSq: number } | null = null;
  for (const id of blockIds) {
    const rect = rectFor(id);
    if (!rect) continue;
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = cx - cursor.x;
    const dy = cy - cursor.y;
    const distSq = dx * dx + dy * dy;
    if (!best || distSq < best.distSq) {
      best = { id, distSq };
    }
  }
  return best?.id ?? null;
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
  bufferState,
  gridColumns,
}: UseLayoutKeyboardOptions): UseLayoutKeyboardResult {
  const [mode, setMode] = useState<LayoutSubMode | null>(null);
  const [focusedCard, setFocusedCard] = useState<LayoutKeyboardFocus | null>(null);
  const [isManipulating, setIsManipulating] = useState(false);
  const [discardConfirmOpen, setDiscardConfirmOpen] = useState(false);
  const manipulatingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep a live ref to blocks for handlers (they capture once per scope id).
  const blocksRef = useRef(blocks);
  useEffect(() => {
    blocksRef.current = blocks;
  }, [blocks]);

  // Track the last known mouse position so that entering layout mode focuses
  // the block closest to the user's pointer. Fallback to viewport center when
  // no mousemove has been observed yet (pure-keyboard sessions).
  const cursorRef = useRef<{ x: number; y: number } | null>(null);
  useEffect(() => {
    const onMove = (event: MouseEvent) => {
      cursorRef.current = { x: event.clientX, y: event.clientY };
    };
    window.addEventListener("mousemove", onMove, { passive: true });
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  // Cascade modal scopes: the parent `layout` scope holds shared bindings
  // (mode switching) while the sub-mode scopes are non-modal so that
  // unmatched events cascade up to `layout`. Mode-switch keys (`n`, `m`,
  // `b`) only live in `layout`; sub-scopes provide their movement and Exit
  // bindings exclusively. The dispatcher walks top-down so sub-mode wins
  // on conflicts.
  useKeyboardScope("layout", mode !== null, { modal: true });
  useKeyboardScope("layout-navigation", mode === "navigation");
  useKeyboardScope("layout-move", mode === "move");
  useKeyboardScope("layout-resize", mode === "resize");

  const enterMode = useCallback(() => {
    setMode("navigation");
    // Start a buffered session rooted at the currently committed layout.
    // All keyboard ops will land in the buffer until commit or exit.
    bufferState.start(editor.committedBlocks);
    setFocusedCard((current) => {
      if (current) return current;
      const blocks = blocksRef.current;
      const cursor = cursorRef.current ?? {
        x: window.innerWidth / 2,
        y: window.innerHeight / 2,
      };
      const closest = pickClosestBlockByRects(
        blocks.map((b) => b.id),
        cursor,
        (id) => {
          const el = document.querySelector(`[data-layout-block-id="${id}"]`);
          return el ? el.getBoundingClientRect() : null;
        },
      );
      const id = closest ?? pickTopLeftBlock(blocks);
      return id ? { blockId: id } : null;
    });
  }, [bufferState, editor.committedBlocks]);

  const commitMode = useCallback(() => {
    const blocks = bufferState.commit();
    if (blocks) {
      editor.commitLayout(blocks);
    }
    setMode(null);
    setFocusedCard(null);
  }, [bufferState, editor]);

  // Discard the staged edits and exit layout mode without persisting.
  // Used by the silent-discard path (changes count below the
  // threshold) and by the modal-confirm path once the user accepts.
  const discardMode = useCallback(() => {
    bufferState.clear();
    setMode(null);
    setFocusedCard(null);
  }, [bufferState]);

  // Routing entrypoint for `Esc` and (later) for the mouse-click
  // discard. Decides silent discard vs opening the confirm modal
  // based on the current `changesCount`.
  const requestDiscard = useCallback(() => {
    if (bufferState.changesCount >= DISCARD_CONFIRM_THRESHOLD) {
      setDiscardConfirmOpen(true);
      return;
    }
    discardMode();
  }, [bufferState.changesCount, discardMode]);

  const handleDiscardConfirm = useCallback(() => {
    setDiscardConfirmOpen(false);
    discardMode();
  }, [discardMode]);

  const handleDiscardCancel = useCallback(() => {
    setDiscardConfirmOpen(false);
  }, []);

  // `exitMode` is the public name used by the LAYOUT_EXIT action.
  // From FA5b onward it routes through `requestDiscard`, which opens
  // the confirm modal when the buffer holds enough staged changes.
  const exitMode = useCallback(() => {
    requestDiscard();
  }, [requestDiscard]);

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

  // Entry is bound to the `sheet` scope: layout mode is only reachable
  // from within a cheatsheet page.
  const { matchesAction } = useKeybindings();
  useScopedKeyboardHandler(
    "sheet",
    (event: KeyboardEvent) => {
      if (!matchesAction(event, ACTION_IDS.LAYOUT_ENTER_MODE)) return;
      event.preventDefault();
      enterMode();
    },
    [matchesAction, enterMode]
  );

  useAction(ACTION_IDS.LAYOUT_GOTO_NAVIGATION, "layout", () => {
    setMode("navigation");
  });
  useAction(ACTION_IDS.LAYOUT_GOTO_MOVE, "layout", () => {
    setMode("move");
  });
  useAction(ACTION_IDS.LAYOUT_GOTO_RESIZE, "layout", () => {
    setMode("resize");
  });

  useAction(ACTION_IDS.LAYOUT_EXIT, "layout", () => {
    exitMode();
  });

  useAction(ACTION_IDS.LAYOUT_COMMIT, "layout", () => {
    commitMode();
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

  const buildApplyContext = useCallback(
    (sourceBlocks: readonly LayoutBlock[]) => {
      const constraints = new Map<string, BlockConstraints>();
      for (const b of sourceBlocks) {
        constraints.set(b.id, getBlockConstraintsV2(b.kind));
      }
      return {
        gridColumns,
        constraints,
        emitter: debugRecorder.getEngineEmitter(),
      };
    },
    [gridColumns]
  );

  const submitMove = useCallback(
    (actionId: string) => {
      const spec = moveSpecFromAction(actionId);
      if (!spec) return;
      const target = focusedCard?.blockId ?? pickTopLeftBlock(blocksRef.current);
      if (!target) return;
      const op = buildMoveOperation(target, spec);
      bufferState.apply(op, buildApplyContext(blocksRef.current));
      flashManipulating();
    },
    [bufferState, buildApplyContext, focusedCard, flashManipulating]
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
      const op = buildResizeOperation(target, spec);
      bufferState.apply(op, buildApplyContext(blocksRef.current));
      flashManipulating();
    },
    [bufferState, buildApplyContext, focusedCard, flashManipulating]
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

  /* ---------------- viewport follow ---------------- */

  // Scroll the focused block into view whenever its identity OR its position
  // changes (navigation jumps to a new block, or move/resize displaces it).
  const focusedPos = useMemo(() => {
    if (!focusedCard) return null;
    const block = blocks.find((b) => b.id === focusedCard.blockId);
    if (!block) return null;
    return `${block.position.x},${block.position.y},${block.position.w},${block.position.h}`;
  }, [focusedCard, blocks]);

  useEffect(() => {
    if (!focusedCard || focusedPos === null) return;
    const el = document.querySelector(`[data-layout-block-id="${focusedCard.blockId}"]`);
    if (!(el instanceof HTMLElement)) return;
    el.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
  }, [focusedCard, focusedPos]);

  return useMemo(
    () => ({
      mode,
      focusedCard,
      setFocusedCard,
      isManipulating,
      discardConfirmOpen,
      handleDiscardConfirm,
      handleDiscardCancel,
    }),
    [mode, focusedCard, isManipulating, discardConfirmOpen, handleDiscardConfirm, handleDiscardCancel]
  );
}
