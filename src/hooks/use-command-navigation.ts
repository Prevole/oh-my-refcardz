"use client";

import { useEffect, useCallback, useRef } from "react";
import { useKeyboardContext } from "./use-keyboard-context";
import { useKeybindings } from "./use-keybindings";
import { ACTION_IDS } from "@/lib/keybindings";
import { computeGridPositions, type GridPos } from "@/lib/grid-clustering";

type Direction = "up" | "down" | "left" | "right";

type NavNode = {
  el: HTMLElement;
  up: HTMLElement | null;
  down: HTMLElement | null;
  left: HTMLElement | null;
  right: HTMLElement | null;
};

type NavGraph = Map<HTMLElement, NavNode>;

function getCardOf(el: HTMLElement): HTMLElement | null {
  let node: HTMLElement | null = el;
  while (node) {
    if (node.tagName === "ARTICLE") return node;
    node = node.parentElement;
  }
  return null;
}

/**
 * Given a list of cards, infer their grid column and row by clustering
 * their center-X (columns) and top-Y (rows) coordinates.
 */
function computeCardGridPositions(
  cards: HTMLElement[],
  threshold = 40
): Map<HTMLElement, GridPos> {
  const rects = cards.map((c) => c.getBoundingClientRect());
  const positions = computeGridPositions(rects, threshold);

  const result = new Map<HTMLElement, GridPos>();
  cards.forEach((card, i) => {
    result.set(card, positions[i]);
  });
  return result;
}

/**
 * Builds a navigation graph for all [data-copyable] elements.
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

  const cards = [...cardToNodes.keys()];
  const gridPos = computeCardGridPositions(cards);

  type Key = string;
  const gridKey = (gc: number, gr: number): Key => `${gc},${gr}`;
  const gridToNodes = new Map<Key, HTMLElement[]>();
  for (const card of cards) {
    const pos = gridPos.get(card)!;
    const key = gridKey(pos.gridCol, pos.gridRow);
    gridToNodes.set(key, cardToNodes.get(card)!);
  }

  const nodesAt = (gc: number, gr: number) =>
    gridToNodes.get(gridKey(gc, gr)) ?? null;

  const graph: NavGraph = new Map();

  for (const card of cards) {
    const pos = gridPos.get(card)!;
    const { gridCol, gridRow } = pos;
    const siblings = cardToNodes.get(card)!;

    for (let localIdx = 0; localIdx < siblings.length; localIdx++) {
      const el = siblings[localIdx];

      let upEl: HTMLElement | null = null;
      if (localIdx > 0) {
        upEl = siblings[localIdx - 1];
      } else {
        const above = nodesAt(gridCol, gridRow - 1);
        if (above) {
          upEl = above[above.length - 1];
        } else {
          const maxCol = Math.max(...cards.map((c) => gridPos.get(c)!.gridCol));
          for (let gr = gridRow - 1; gr >= 0; gr--) {
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

      let downEl: HTMLElement | null = null;
      if (localIdx < siblings.length - 1) {
        downEl = siblings[localIdx + 1];
      } else {
        const below = nodesAt(gridCol, gridRow + 1);
        if (below) {
          downEl = below[0];
        } else {
          const maxCol = Math.max(...cards.map((c) => gridPos.get(c)!.gridCol));
          const maxRow = Math.max(...cards.map((c) => gridPos.get(c)!.gridRow));
          for (let gr = gridRow + 1; gr <= maxRow; gr++) {
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

      let leftEl: HTMLElement | null = null;
      {
        const maxRow = Math.max(...cards.map((c) => gridPos.get(c)!.gridRow));

        for (let gc = gridCol - 1; gc >= 0; gc--) {
          const candidate = nodesAt(gc, gridRow);
          if (candidate) {
            leftEl = candidate[Math.min(localIdx, candidate.length - 1)];
            break;
          }
        }

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

      let rightEl: HTMLElement | null = null;
      {
        const maxCol = Math.max(...cards.map((c) => gridPos.get(c)!.gridCol));

        for (let gc = gridCol + 1; gc <= maxCol; gc++) {
          const candidate = nodesAt(gc, gridRow);
          if (candidate) {
            rightEl = candidate[Math.min(localIdx, candidate.length - 1)];
            break;
          }
        }

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

type UseCommandNavigationOptions = {
  modalOpen: boolean;
};

export function useCommandNavigation({ modalOpen }: UseCommandNavigationOptions) {
  const { isScopeActive } = useKeyboardContext();
  const { matchesAction } = useKeybindings();
  const graphRef = useRef<NavGraph>(new Map());
  const lastMousePos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const rebuildGraph = useCallback(() => {
    const nodes = Array.from(
      document.querySelectorAll<HTMLElement>("[data-copyable]")
    );
    graphRef.current = buildGraph(nodes);
  }, []);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      lastMousePos.current = { x: e.clientX, y: e.clientY };
    };
    window.addEventListener("mousemove", onMouseMove);
    return () => window.removeEventListener("mousemove", onMouseMove);
  }, []);

  useEffect(() => {
    const getFocused = (): HTMLElement | null => {
      const focused = document.querySelector<HTMLElement>("[data-copyable][data-nav-focused='true']");
      return focused;
    };

    function setFocused(el: HTMLElement | null) {
      document.querySelectorAll<HTMLElement>("[data-copyable]").forEach((n) => {
        n.dataset.navFocused = "false";
      });
      if (el) {
        el.dataset.navFocused = "true";
        el.scrollIntoView({ block: "nearest", behavior: "smooth" });
      }
    }

    function findClosestToMouse(): HTMLElement | null {
      const nodes = Array.from(graphRef.current.keys());
      if (nodes.length === 0) return null;

      const { x, y } = lastMousePos.current;
      let closest: HTMLElement | null = null;
      let minDist = Infinity;

      for (const node of nodes) {
        const rect = node.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const dist = Math.hypot(centerX - x, centerY - y);
        if (dist < minDist) {
          minDist = dist;
          closest = node;
        }
      }

      return closest;
    }

    function move(direction: Direction) {
      if (graphRef.current.size === 0) rebuildGraph();
      if (graphRef.current.size === 0) return;

      const focused = getFocused();
      if (!focused) {
        const closest = findClosestToMouse();
        if (closest) setFocused(closest);
        return;
      }

      const node = graphRef.current.get(focused);
      if (!node) return;

      const target = node[direction];
      if (target) setFocused(target);
    }

    rebuildGraph();

    const onResize = () => rebuildGraph();
    window.addEventListener("resize", onResize);

    const onFocusOut = (e: FocusEvent) => {
      const next = e.relatedTarget as HTMLElement | null;
      if (!next || next.dataset.copyable === undefined) {
        document.querySelectorAll<HTMLElement>("[data-copyable]").forEach((n) => {
          n.dataset.navFocused = "false";
        });
      }
    };
    document.addEventListener("focusout", onFocusOut);

    function clearFocus() {
      document.querySelectorAll<HTMLElement>("[data-copyable]").forEach((n) => {
        n.dataset.navFocused = "false";
      });
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (!isScopeActive("global")) return;

      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return;
      if (modalOpen) return;

      if (matchesAction(e, ACTION_IDS.CLEAR_COMMAND_FOCUS)) {
        const hasFocused = document.querySelector("[data-copyable][data-nav-focused='true']");
        if (hasFocused) {
          e.preventDefault();
          clearFocus();
        }
      } else if (matchesAction(e, ACTION_IDS.MOVE_UP)) {
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
