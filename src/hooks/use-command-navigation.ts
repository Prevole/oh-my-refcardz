"use client";

import { useEffect, useCallback, useRef } from "react";
import { useKeyboardContext } from "./use-keyboard-context";
import { useKeybindings } from "./use-keybindings";
import { ACTION_IDS } from "@/lib/keybindings";

type Direction = "up" | "down" | "left" | "right";

// One navigable node with its 4 pre-computed neighbours
type NavNode = {
  el: HTMLElement;
  up: HTMLElement | null;
  down: HTMLElement | null;
  left: HTMLElement | null;
  right: HTMLElement | null;
};

type NavGraph = Map<HTMLElement, NavNode>;

// ─── DOM helpers ────────────────────────────────────────────────────────────

function getCardOf(el: HTMLElement): HTMLElement | null {
  let node: HTMLElement | null = el;
  while (node) {
    if (node.tagName === "ARTICLE") return node;
    node = node.parentElement;
  }
  return null;
}

// ─── Grid geometry ──────────────────────────────────────────────────────────

type GridPos = { gridCol: number; gridRow: number };

/**
 * Given a list of cards, infer their grid column and row by clustering
 * their center-X (columns) and top-Y (rows) coordinates.
 */
function computeCardGridPositions(
  cards: HTMLElement[],
  threshold = 40
): Map<HTMLElement, GridPos> {
  const rects = cards.map((c) => ({ el: c, r: c.getBoundingClientRect() }));

  // Collect unique X centers → sort → assign col index
  const xs = rects.map((c) => c.r.left + c.r.width / 2);
  const colBuckets = cluster(xs, threshold);

  // Collect unique Y tops → sort → assign row index
  const ys = rects.map((c) => c.r.top);
  const rowBuckets = cluster(ys, threshold);

  const result = new Map<HTMLElement, GridPos>();
  rects.forEach(({ el, r }) => {
    const cx = r.left + r.width / 2;
    const top = r.top;
    result.set(el, {
      gridCol: colBuckets.findIndex((b) => Math.abs(b - cx) <= threshold),
      gridRow: rowBuckets.findIndex((b) => Math.abs(b - top) <= threshold),
    });
  });
  return result;
}

/** Returns sorted unique representatives of clusters */
function cluster(values: number[], threshold: number): number[] {
  const sorted = [...values].sort((a, b) => a - b);
  const buckets: number[] = [];
  for (const v of sorted) {
    if (buckets.length === 0 || Math.abs(v - buckets[buckets.length - 1]) > threshold) {
      buckets.push(v);
    }
  }
  return buckets;
}

// ─── Graph builder ──────────────────────────────────────────────────────────

/**
 * Builds a navigation graph for all [data-sheet-command] elements.
 *
 * Structure:
 *   - Elements are grouped by their parent SheetCard (article).
 *   - Cards are placed on a virtual grid (gridCol × gridRow).
 *   - Within a card, elements are sorted top-to-bottom by their Y center.
 *   - up/down: move within the same card; at the boundary, look in the card
 *     that is in the same gridCol but adjacent gridRow, targeting the same
 *     local index (clamped). If no such card exists → null.
 *   - left/right: move to the card in the same gridRow but adjacent gridCol,
 *     targeting the same local index (clamped). If the card in that direction
 *     has no navigable elements → keep looking further. If nothing found → null.
 */
function buildGraph(allNodes: HTMLElement[]): NavGraph {
  if (allNodes.length === 0) return new Map();

  // 1. Group nodes by parent card, sort each group top-to-bottom
  const cardToNodes = new Map<HTMLElement, HTMLElement[]>();
  for (const node of allNodes) {
    const card = getCardOf(node);
    if (!card) continue;
    if (!cardToNodes.has(card)) cardToNodes.set(card, []);
    cardToNodes.get(card)!.push(node);
  }
  for (const [, nodes] of cardToNodes) {
    nodes.sort((a, b) => {
      const ra = a.getBoundingClientRect();
      const rb = b.getBoundingClientRect();
      return (ra.top + ra.height / 2) - (rb.top + rb.height / 2);
    });
  }

  // 2. Compute grid positions for all cards
  const cards = [...cardToNodes.keys()];
  const gridPos = computeCardGridPositions(cards);

  // 3. Build lookup: (gridCol, gridRow) → sorted node list
  type Key = string;
  const gridKey = (gc: number, gr: number): Key => `${gc},${gr}`;
  const gridToNodes = new Map<Key, HTMLElement[]>();
  for (const card of cards) {
    const pos = gridPos.get(card)!;
    const key = gridKey(pos.gridCol, pos.gridRow);
    gridToNodes.set(key, cardToNodes.get(card)!);
  }

  // Helper: get nodes in a grid cell
  const nodesAt = (gc: number, gr: number) =>
    gridToNodes.get(gridKey(gc, gr)) ?? null;

  // 4. Build the graph node for each element
  const graph: NavGraph = new Map();

  for (const card of cards) {
    const pos = gridPos.get(card)!;
    const { gridCol, gridRow } = pos;
    const siblings = cardToNodes.get(card)!;

    for (let localIdx = 0; localIdx < siblings.length; localIdx++) {
      const el = siblings[localIdx];

      // ── up ──────────────────────────────────────────────────────────────
      let upEl: HTMLElement | null = null;
      if (localIdx > 0) {
        // Previous sibling in same card
        upEl = siblings[localIdx - 1];
      } else {
        // Cross into card above — same col first, then adjacent cols
        const above = nodesAt(gridCol, gridRow - 1);
        if (above) {
          upEl = above[above.length - 1];
        } else {
          // Same row above doesn't exist — search adjacent cols on gridRow-1
          const maxCol = Math.max(...cards.map((c) => gridPos.get(c)!.gridCol));
          for (let gr = gridRow - 1; gr >= 0; gr--) {
            // Search outward from current col: right then left
            for (let offset = 1; offset <= maxCol; offset++) {
              for (const gc of [gridCol + offset, gridCol - offset]) {
                if (gc < 0 || gc > maxCol) continue;
                const candidate = nodesAt(gc, gr);
                if (candidate) {
                  upEl = candidate[candidate.length - 1];
                  break;
                }
              }
              if (upEl) break;
            }
            if (upEl) break;
          }
        }
      }

      // ── down ────────────────────────────────────────────────────────────
      let downEl: HTMLElement | null = null;
      if (localIdx < siblings.length - 1) {
        // Next sibling in same card
        downEl = siblings[localIdx + 1];
      } else {
        // Cross into card below — same col first, then adjacent cols
        const below = nodesAt(gridCol, gridRow + 1);
        if (below) {
          downEl = below[0];
        } else {
          // Same col below doesn't exist — search adjacent cols on gridRow+1
          const maxCol = Math.max(...cards.map((c) => gridPos.get(c)!.gridCol));
          const maxRow = Math.max(...cards.map((c) => gridPos.get(c)!.gridRow));
          for (let gr = gridRow + 1; gr <= maxRow; gr++) {
            // Search outward from current col: right then left
            for (let offset = 1; offset <= maxCol; offset++) {
              for (const gc of [gridCol + offset, gridCol - offset]) {
                if (gc < 0 || gc > maxCol) continue;
                const candidate = nodesAt(gc, gr);
                if (candidate) {
                  downEl = candidate[0];
                  break;
                }
              }
              if (downEl) break;
            }
            if (downEl) break;
          }
        }
      }

      // ── left ────────────────────────────────────────────────────────────
      let leftEl: HTMLElement | null = null;
      {
        const maxRow = Math.max(...cards.map((c) => gridPos.get(c)!.gridRow));

        // 1. Try same gridRow, columns to the left — skip empty cells
        for (let gc = gridCol - 1; gc >= 0; gc--) {
          const candidate = nodesAt(gc, gridRow);
          if (candidate) {
            leftEl = candidate[Math.min(localIdx, candidate.length - 1)];
            break;
          }
        }

        // 2. If nothing found on same row, look on the row below:
        //    try col gridCol-1 … 0 on gridRow+1, take first element
        if (!leftEl) {
          for (let gr = gridRow + 1; gr <= maxRow; gr++) {
            for (let gc = gridCol - 1; gc >= 0; gc--) {
              const candidate = nodesAt(gc, gr);
              if (candidate) {
                leftEl = candidate[0];
                break;
              }
            }
            if (leftEl) break;
          }
        }
      }

      // ── right ───────────────────────────────────────────────────────────
      let rightEl: HTMLElement | null = null;
      {
        const maxCol = Math.max(...cards.map((c) => gridPos.get(c)!.gridCol));

        // 1. Try same gridRow, columns to the right — skip empty cells
        for (let gc = gridCol + 1; gc <= maxCol; gc++) {
          const candidate = nodesAt(gc, gridRow);
          if (candidate) {
            rightEl = candidate[Math.min(localIdx, candidate.length - 1)];
            break;
          }
        }

        // 2. If nothing found on same row, look on the row above:
        //    try col gridCol+1 … maxCol on gridRow-1, take last element
        if (!rightEl) {
          for (let gr = gridRow - 1; gr >= 0; gr--) {
            for (let gc = gridCol + 1; gc <= maxCol; gc++) {
              const candidate = nodesAt(gc, gr);
              if (candidate) {
                rightEl = candidate[candidate.length - 1];
                break;
              }
            }
            if (rightEl) break;
          }
        }
      }

      graph.set(el, { el, up: upEl, down: downEl, left: leftEl, right: rightEl });
    }
  }

  return graph;
}

// ─── Hook ───────────────────────────────────────────────────────────────────

type UseCommandNavigationOptions = {
  modalOpen: boolean;
};

export function useCommandNavigation({ modalOpen }: UseCommandNavigationOptions) {
  const { isScopeActive } = useKeyboardContext();
  const { matchesAction } = useKeybindings();
  const graphRef = useRef<NavGraph>(new Map());

  const rebuildGraph = useCallback(() => {
    const nodes = Array.from(
      document.querySelectorAll<HTMLElement>("[data-sheet-command]")
    );
    graphRef.current = buildGraph(nodes);
  }, []);

  useEffect(() => {
    const getFocused = (): HTMLElement | null => {
      const active = document.activeElement as HTMLElement | null;
      if (active?.dataset.sheetCommand !== undefined) return active;
      return null;
    };

    function setFocused(el: HTMLElement | null) {
      // Remove highlight from any previously focused command
      document.querySelectorAll<HTMLElement>("[data-sheet-command]").forEach((n) => {
        n.dataset.navFocused = "false";
      });
      if (el) {
        el.dataset.navFocused = "true";
        el.focus({ preventScroll: true });
        el.scrollIntoView({ block: "nearest", behavior: "smooth" });
      }
    }

    function move(direction: Direction) {
      if (graphRef.current.size === 0) rebuildGraph();
      if (graphRef.current.size === 0) return;

      const focused = getFocused();
      if (!focused) {
        // Focus first node in graph (top-left)
        const first = graphRef.current.keys().next().value;
        if (first) setFocused(first);
        return;
      }

      const node = graphRef.current.get(focused);
      if (!node) return;

      const target = node[direction];
      if (target) setFocused(target);
    }

    // Build on first use; rebuild on resize (layout may reflow)
    rebuildGraph();

    const onResize = () => rebuildGraph();
    window.addEventListener("resize", onResize);

    // Clean up highlight when focus leaves a command entirely
    const onFocusOut = (e: FocusEvent) => {
      const next = e.relatedTarget as HTMLElement | null;
      if (!next || next.dataset.sheetCommand === undefined) {
        document.querySelectorAll<HTMLElement>("[data-sheet-command]").forEach((n) => {
          n.dataset.navFocused = "false";
        });
      }
    };
    document.addEventListener("focusout", onFocusOut);

    const onKeyDown = (e: KeyboardEvent) => {
      // Only handle keys when global scope is active (no panels/modals open)
      if (!isScopeActive("global")) return;

      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return;
      if (modalOpen) return;

      if (matchesAction(e, ACTION_IDS.MOVE_UP)) {
        e.preventDefault();
        move("up");
      } else if (matchesAction(e, ACTION_IDS.MOVE_DOWN)) {
        e.preventDefault();
        move("down");
      } else if (matchesAction(e, ACTION_IDS.MOVE_LEFT)) {
        e.preventDefault();
        move("left");
      } else if (matchesAction(e, ACTION_IDS.MOVE_RIGHT)) {
        e.preventDefault();
        move("right");
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("focusout", onFocusOut);
    };
  }, [modalOpen, isScopeActive, matchesAction, rebuildGraph]);
}
