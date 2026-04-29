"use client";

import { useEffect } from "react";

/**
 * Groups elements into visual columns by clustering their center-X positions.
 * Two elements are in the same column if their center-X values are within
 * `threshold` pixels of each other (accounts for minor layout jitter).
 *
 * Returns columns sorted left-to-right, each column sorted top-to-bottom.
 */
function buildGrid(elements: HTMLElement[], threshold = 40): HTMLElement[][] {
  if (elements.length === 0) return [];

  const withCoords = elements.map((el) => {
    const r = el.getBoundingClientRect();
    return { el, cx: r.left + r.width / 2, cy: r.top + r.height / 2 };
  });

  // Sort by center-X so we can cluster left-to-right
  withCoords.sort((a, b) => a.cx - b.cx);

  // Cluster into columns
  const columns: (typeof withCoords)[] = [];
  let currentCol: typeof withCoords = [withCoords[0]];

  for (let i = 1; i < withCoords.length; i++) {
    const prev = withCoords[i - 1];
    const curr = withCoords[i];
    if (Math.abs(curr.cx - prev.cx) <= threshold) {
      currentCol.push(curr);
    } else {
      columns.push(currentCol);
      currentCol = [curr];
    }
  }
  columns.push(currentCol);

  // Within each column, sort top-to-bottom
  for (const col of columns) {
    col.sort((a, b) => a.cy - b.cy);
  }

  return columns.map((col) => col.map((c) => c.el));
}

function findPosition(
  grid: HTMLElement[][],
  el: HTMLElement
): { col: number; row: number } | null {
  for (let col = 0; col < grid.length; col++) {
    const row = grid[col].indexOf(el);
    if (row !== -1) return { col, row };
  }
  return null;
}

function navigate(
  grid: HTMLElement[][],
  current: HTMLElement,
  direction: "up" | "down" | "left" | "right"
): HTMLElement | null {
  const pos = findPosition(grid, current);
  if (!pos) return null;

  const { col, row } = pos;

  switch (direction) {
    case "down": {
      const colArr = grid[col];
      if (row + 1 < colArr.length) {
        // Next element in same column
        return colArr[row + 1];
      }
      // At bottom of column — look in subsequent columns for one that has
      // an element at index >= current row. Take the first such column.
      for (let c = col + 1; c < grid.length; c++) {
        if (grid[c].length > row) {
          return grid[c][row];
        }
      }
      // No column has an element at that depth — stay put
      return null;
    }

    case "up": {
      const colArr = grid[col];
      if (row - 1 >= 0) {
        return colArr[row - 1];
      }
      // At top of column — look in preceding columns for one that has
      // an element at index >= current row (i.e. length > row).
      // We want the closest preceding column that qualifies.
      for (let c = col - 1; c >= 0; c--) {
        if (grid[c].length > row) {
          return grid[c][row];
        }
      }
      return null;
    }

    case "right": {
      if (col + 1 >= grid.length) {
        // No column to the right — wrap up: go to last element of current col
        // unless we're already the only column, then nothing
        return null;
      }
      const nextCol = grid[col + 1];
      // Same row clamped to next column length
      return nextCol[Math.min(row, nextCol.length - 1)];
    }

    case "left": {
      if (col - 1 < 0) {
        return null;
      }
      const prevCol = grid[col - 1];
      return prevCol[Math.min(row, prevCol.length - 1)];
    }
  }
}

type UseCommandNavigationOptions = {
  /** Set to true when any modal is open so navigation keys are suppressed. */
  modalOpen: boolean;
};

export function useCommandNavigation({ modalOpen }: UseCommandNavigationOptions) {
  useEffect(() => {
    const getCommands = (): HTMLElement[] =>
      Array.from(document.querySelectorAll<HTMLElement>("[data-sheet-command]"));

    const getFocused = (): HTMLElement | null => {
      const active = document.activeElement;
      if (active && (active as HTMLElement).dataset.sheetCommand !== undefined) {
        return active as HTMLElement;
      }
      return null;
    };

    function move(direction: "up" | "down" | "left" | "right") {
      const commands = getCommands();
      if (commands.length === 0) return;

      const focused = getFocused();
      if (!focused) {
        commands[0].focus();
        return;
      }

      const grid = buildGrid(commands);
      const target = navigate(grid, focused, direction);
      if (target) {
        target.focus();
        target.scrollIntoView({ block: "nearest", behavior: "smooth" });
      }
    }

    const onKeyDown = (e: KeyboardEvent) => {
      // Never hijack keys when focus is inside an input / textarea / select
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return;

      // Never hijack when a modal is open (modals handle their own keys)
      if (modalOpen) return;

      switch (e.key) {
        case "ArrowUp":
        case "k":
          e.preventDefault();
          move("up");
          break;
        case "ArrowDown":
        case "j":
          e.preventDefault();
          move("down");
          break;
        case "ArrowLeft":
        case "h":
          e.preventDefault();
          move("left");
          break;
        case "ArrowRight":
        case "l":
          e.preventDefault();
          move("right");
          break;
        default:
          break;
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [modalOpen]);
}
