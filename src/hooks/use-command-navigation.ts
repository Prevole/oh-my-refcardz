"use client";

import { useEffect, useCallback, useRef } from "react";
import { useKeyboardContext } from "./use-keyboard-context";
import { useKeybindings } from "./use-keybindings";
import { ACTION_IDS } from "@/lib/keybindings";
import { computeGridPositions, type GridPos } from "@/lib/grid-clustering";

type Direction = "up" | "down" | "left" | "right";

type NavNode = {
  el: HTMLElement;
  type: "item" | "copyable";
  item: HTMLElement; // Parent item (self if type is "item")
  up: NavNode | null;
  down: NavNode | null;
  left: NavNode | null;
  right: NavNode | null;
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

function getItemOf(el: HTMLElement): HTMLElement | null {
  return el.closest<HTMLElement>("[data-item]");
}

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
 * Structure for each item: the item element + its copyables in order
 */
type ItemWithCopyables = {
  item: HTMLElement;
  copyables: HTMLElement[];
};

/**
 * Builds a unified navigation graph where:
 * - Items (blocks) and copyables are both navigable
 * - ↓ from item → first copyable (or next item if none)
 * - ↓ from last copyable → next item
 * - ↑ from first copyable → item
 * - ↑ from item → previous item's last copyable (or previous item if none)
 * - ←/→ always navigate between items at block level
 */
function buildUnifiedGraph(allItems: HTMLElement[]): NavGraph {
  if (allItems.length === 0) return new Map();

  // Group items by card and collect their copyables
  const cardToItemsWithCopyables = new Map<HTMLElement, ItemWithCopyables[]>();
  
  for (const item of allItems) {
    const card = getCardOf(item);
    if (!card) continue;
    
    const copyables = Array.from(item.querySelectorAll<HTMLElement>("[data-copyable]"));
    // Sort copyables by vertical position
    copyables.sort((a, b) => {
      const ra = a.getBoundingClientRect();
      const rb = b.getBoundingClientRect();
      return ra.top - rb.top;
    });
    
    if (!cardToItemsWithCopyables.has(card)) {
      cardToItemsWithCopyables.set(card, []);
    }
    cardToItemsWithCopyables.get(card)!.push({ item, copyables });
  }

  // Sort items within each card by vertical position
  for (const [, items] of cardToItemsWithCopyables) {
    items.sort((a, b) => {
      const ra = a.item.getBoundingClientRect();
      const rb = b.item.getBoundingClientRect();
      return ra.top - rb.top;
    });
  }

  const cards = [...cardToItemsWithCopyables.keys()];
  const gridPos = computeCardGridPositions(cards);

  type Key = string;
  const gridKey = (gc: number, gr: number): Key => `${gc},${gr}`;
  const gridToItems = new Map<Key, ItemWithCopyables[]>();
  
  for (const card of cards) {
    const pos = gridPos.get(card)!;
    const key = gridKey(pos.gridCol, pos.gridRow);
    gridToItems.set(key, cardToItemsWithCopyables.get(card)!);
  }

  const itemsAt = (gc: number, gr: number) => gridToItems.get(gridKey(gc, gr)) ?? null;

  // Create nodes for all items and copyables
  const graph: NavGraph = new Map();
  const nodeMap = new Map<HTMLElement, NavNode>();

  // First pass: create all nodes
  for (const card of cards) {
    const items = cardToItemsWithCopyables.get(card)!;
    for (const { item, copyables } of items) {
      const itemNode: NavNode = {
        el: item,
        type: "item",
        item,
        up: null,
        down: null,
        left: null,
        right: null,
      };
      nodeMap.set(item, itemNode);
      graph.set(item, itemNode);

      for (const copyable of copyables) {
        const copyableNode: NavNode = {
          el: copyable,
          type: "copyable",
          item,
          up: null,
          down: null,
          left: null,
          right: null,
        };
        nodeMap.set(copyable, copyableNode);
        graph.set(copyable, copyableNode);
      }
    }
  }

  // Second pass: link nodes
  for (const card of cards) {
    const pos = gridPos.get(card)!;
    const { gridCol, gridRow } = pos;
    const items = cardToItemsWithCopyables.get(card)!;

    for (let itemIdx = 0; itemIdx < items.length; itemIdx++) {
      const { item, copyables } = items[itemIdx];
      const itemNode = nodeMap.get(item)!;

      // Link item ↓ → first copyable or next item
      if (copyables.length > 0) {
        itemNode.down = nodeMap.get(copyables[0])!;
      } else if (itemIdx < items.length - 1) {
        itemNode.down = nodeMap.get(items[itemIdx + 1].item)!;
      } else {
        // Look for next item in card below
        itemNode.down = findNextItemBelow(gridCol, gridRow, 0, gridPos, itemsAt, nodeMap);
      }

      // Link item ↑ → previous item's last copyable or previous item
      if (itemIdx > 0) {
        const prevItem = items[itemIdx - 1];
        if (prevItem.copyables.length > 0) {
          itemNode.up = nodeMap.get(prevItem.copyables[prevItem.copyables.length - 1])!;
        } else {
          itemNode.up = nodeMap.get(prevItem.item)!;
        }
      } else {
        // Look for last item in card above
        itemNode.up = findPrevItemAbove(gridCol, gridRow, -1, gridPos, itemsAt, nodeMap);
      }

      // Link item ←/→ to adjacent cards' items
      itemNode.left = findAdjacentItem(gridCol, gridRow, itemIdx, -1, gridPos, itemsAt, nodeMap, cards);
      itemNode.right = findAdjacentItem(gridCol, gridRow, itemIdx, 1, gridPos, itemsAt, nodeMap, cards);

      // Link copyables within item
      for (let copyIdx = 0; copyIdx < copyables.length; copyIdx++) {
        const copyable = copyables[copyIdx];
        const copyableNode = nodeMap.get(copyable)!;

        // ↓ from copyable
        if (copyIdx < copyables.length - 1) {
          copyableNode.down = nodeMap.get(copyables[copyIdx + 1])!;
        } else if (itemIdx < items.length - 1) {
          // Next item in same card
          copyableNode.down = nodeMap.get(items[itemIdx + 1].item)!;
        } else {
          // Look for next item in card below
          copyableNode.down = findNextItemBelow(gridCol, gridRow, 0, gridPos, itemsAt, nodeMap);
        }

        // ↑ from copyable
        if (copyIdx > 0) {
          copyableNode.up = nodeMap.get(copyables[copyIdx - 1])!;
        } else {
          // First copyable → back to item
          copyableNode.up = itemNode;
        }

        // ←/→ from copyable → adjacent card's item (same as item's ←/→)
        copyableNode.left = itemNode.left;
        copyableNode.right = itemNode.right;
      }
    }
  }

  return graph;
}

function findNextItemBelow(
  gridCol: number,
  gridRow: number,
  targetIdx: number,
  gridPos: Map<HTMLElement, GridPos>,
  itemsAt: (gc: number, gr: number) => ItemWithCopyables[] | null,
  nodeMap: Map<HTMLElement, NavNode>
): NavNode | null {
  const cards = [...gridPos.keys()];
  const maxCol = Math.max(...cards.map((c) => gridPos.get(c)!.gridCol));
  const maxRow = Math.max(...cards.map((c) => gridPos.get(c)!.gridRow));

  // First try same column below
  const below = itemsAt(gridCol, gridRow + 1);
  if (below && below.length > 0) {
    const idx = Math.min(targetIdx, below.length - 1);
    return nodeMap.get(below[idx].item) ?? null;
  }

  // Look in adjacent columns at lower rows
  for (let gr = gridRow + 1; gr <= maxRow; gr++) {
    for (let offset = 1; offset <= maxCol; offset++) {
      for (const gc of [gridCol + offset, gridCol - offset]) {
        if (gc < 0 || gc > maxCol) continue;
        const candidate = itemsAt(gc, gr);
        if (candidate && candidate.length > 0) {
          return nodeMap.get(candidate[0].item) ?? null;
        }
      }
    }
  }

  return null;
}

function findPrevItemAbove(
  gridCol: number,
  gridRow: number,
  _targetIdx: number,
  gridPos: Map<HTMLElement, GridPos>,
  itemsAt: (gc: number, gr: number) => ItemWithCopyables[] | null,
  nodeMap: Map<HTMLElement, NavNode>
): NavNode | null {
  const cards = [...gridPos.keys()];
  const maxCol = Math.max(...cards.map((c) => gridPos.get(c)!.gridCol));

  // First try same column above
  const above = itemsAt(gridCol, gridRow - 1);
  if (above && above.length > 0) {
    const lastItem = above[above.length - 1];
    if (lastItem.copyables.length > 0) {
      return nodeMap.get(lastItem.copyables[lastItem.copyables.length - 1]) ?? null;
    }
    return nodeMap.get(lastItem.item) ?? null;
  }

  // Look in adjacent columns at upper rows
  for (let gr = gridRow - 1; gr >= 0; gr--) {
    for (let offset = 1; offset <= maxCol; offset++) {
      for (const gc of [gridCol + offset, gridCol - offset]) {
        if (gc < 0 || gc > maxCol) continue;
        const candidate = itemsAt(gc, gr);
        if (candidate && candidate.length > 0) {
          const lastItem = candidate[candidate.length - 1];
          if (lastItem.copyables.length > 0) {
            return nodeMap.get(lastItem.copyables[lastItem.copyables.length - 1]) ?? null;
          }
          return nodeMap.get(lastItem.item) ?? null;
        }
      }
    }
  }

  return null;
}

function findAdjacentItem(
  gridCol: number,
  gridRow: number,
  localIdx: number,
  direction: -1 | 1, // -1 for left, 1 for right
  gridPos: Map<HTMLElement, GridPos>,
  itemsAt: (gc: number, gr: number) => ItemWithCopyables[] | null,
  nodeMap: Map<HTMLElement, NavNode>,
  cards: HTMLElement[]
): NavNode | null {
  const maxCol = Math.max(...cards.map((c) => gridPos.get(c)!.gridCol));
  const maxRow = Math.max(...cards.map((c) => gridPos.get(c)!.gridRow));

  // Try same row first
  for (let gc = gridCol + direction; gc >= 0 && gc <= maxCol; gc += direction) {
    const candidate = itemsAt(gc, gridRow);
    if (candidate && candidate.length > 0) {
      const idx = Math.min(localIdx, candidate.length - 1);
      return nodeMap.get(candidate[idx].item) ?? null;
    }
  }

  // Try other rows
  if (direction === -1) {
    // Left: look at lower rows
    for (let gr = gridRow + 1; gr <= maxRow; gr++) {
      for (let gc = gridCol - 1; gc >= 0; gc--) {
        const candidate = itemsAt(gc, gr);
        if (candidate && candidate.length > 0) {
          return nodeMap.get(candidate[0].item) ?? null;
        }
      }
    }
  } else {
    // Right: look at upper rows
    for (let gr = gridRow - 1; gr >= 0; gr--) {
      for (let gc = gridCol + 1; gc <= maxCol; gc++) {
        const candidate = itemsAt(gc, gr);
        if (candidate && candidate.length > 0) {
          const lastItem = candidate[candidate.length - 1];
          return nodeMap.get(lastItem.item) ?? null;
        }
      }
    }
  }

  return null;
}

type UseCommandNavigationOptions = {
  modalOpen: boolean;
  onShowDetails?: (data: { title: string; detailedEntries: unknown[] }) => void;
};

export function useCommandNavigation({ modalOpen, onShowDetails }: UseCommandNavigationOptions) {
  const { isScopeActive } = useKeyboardContext();
  const { matchesAction } = useKeybindings();
  
  const graphRef = useRef<NavGraph>(new Map());
  const lastMousePos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const rebuildGraph = useCallback(() => {
    const items = Array.from(document.querySelectorAll<HTMLElement>("[data-item]"));
    graphRef.current = buildUnifiedGraph(items);
  }, []);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      lastMousePos.current = { x: e.clientX, y: e.clientY };
    };
    window.addEventListener("mousemove", onMouseMove);
    return () => window.removeEventListener("mousemove", onMouseMove);
  }, []);

  useEffect(() => {
    function getFocused(): HTMLElement | null {
      // Check copyables first (more specific)
      const copyable = document.querySelector<HTMLElement>("[data-copyable][data-nav-focused='true']");
      if (copyable) return copyable;
      
      const item = document.querySelector<HTMLElement>("[data-item][data-nav-focused='true']");
      return item;
    }

    function clearAllFocus() {
      document.querySelectorAll<HTMLElement>("[data-item], [data-copyable]").forEach((n) => {
        n.dataset.navFocused = "false";
      });
    }

    function setFocused(el: HTMLElement | null) {
      clearAllFocus();
      if (el) {
        el.dataset.navFocused = "true";
        el.scrollIntoView({ block: "nearest", behavior: "smooth" });
      }
    }

    function findClosestItemToMouse(): HTMLElement | null {
      const items = Array.from(document.querySelectorAll<HTMLElement>("[data-item]"));
      if (items.length === 0) return null;

      const { x, y } = lastMousePos.current;
      let closest: HTMLElement | null = null;
      let minDist = Infinity;

      for (const item of items) {
        const rect = item.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const dist = Math.hypot(centerX - x, centerY - y);
        if (dist < minDist) {
          minDist = dist;
          closest = item;
        }
      }

      return closest;
    }

    function move(direction: Direction) {
      if (graphRef.current.size === 0) rebuildGraph();
      if (graphRef.current.size === 0) return;

      const focused = getFocused();
      if (!focused) {
        const closest = findClosestItemToMouse();
        if (closest) setFocused(closest);
        return;
      }

      let node = graphRef.current.get(focused);
      
      // If focused element not in graph, rebuild and try again
      if (!node) {
        rebuildGraph();
        node = graphRef.current.get(focused);
        if (!node) return;
      }

      const target = node[direction];
      if (target) setFocused(target.el);
    }

    function showDetailsForFocused(): boolean {
      const focused = getFocused();
      if (!focused) return false;

      // Get the parent item
      const item = focused.dataset.item !== undefined ? focused : getItemOf(focused);
      if (!item) return false;

      const detailsJson = item.dataset.itemDetails;
      if (!detailsJson || !onShowDetails) return false;

      try {
        const data = JSON.parse(detailsJson);
        onShowDetails(data);
        return true;
      } catch {
        return false;
      }
    }

    function handleClick(e: MouseEvent) {
      const target = e.target as HTMLElement;
      
      // Click on details button
      if (target.closest("[data-show-details-button]")) {
        const item = target.closest<HTMLElement>("[data-item]");
        if (item) {
          setFocused(item);
          showDetailsForFocused();
        }
        return;
      }

      // Click on copyable
      const copyable = target.closest<HTMLElement>("[data-copyable]");
      if (copyable) {
        setFocused(copyable);
        return;
      }

      // Click on item
      const item = target.closest<HTMLElement>("[data-item]");
      if (item) {
        setFocused(item);
        return;
      }

      // Click on non-navigable element: clear focus
      clearAllFocus();
    }

    rebuildGraph();

    const observer = new MutationObserver((mutations) => {
      const shouldRebuild = mutations.some((mutation) => {
        return Array.from(mutation.addedNodes).some((node) => {
          if (!(node instanceof HTMLElement)) {
            return false;
          }

          return (
            node.matches("[data-item], [data-copyable]") ||
            node.querySelector("[data-item], [data-copyable]") !== null
          );
        });
      });

      if (shouldRebuild) {
        rebuildGraph();
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });

    const onResize = () => rebuildGraph();
    window.addEventListener("resize", onResize);
    document.addEventListener("click", handleClick);

    const onKeyDown = (e: KeyboardEvent) => {
      if (!isScopeActive("sheet")) return;

      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return;
      if (modalOpen) return;

      if (matchesAction(e, ACTION_IDS.CLEAR_COMMAND_FOCUS)) {
        const hasFocused = getFocused();
        if (hasFocused) {
          e.preventDefault();
          clearAllFocus();
        }
        return;
      }

      if (matchesAction(e, ACTION_IDS.SHOW_EXAMPLE)) {
        if (showDetailsForFocused()) {
          e.preventDefault();
        }
        return;
      }

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
      document.removeEventListener("click", handleClick);
      observer.disconnect();
    };
  }, [modalOpen, isScopeActive, matchesAction, rebuildGraph, onShowDetails]);
}
