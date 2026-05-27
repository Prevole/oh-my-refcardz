import type { PointerEvent as ReactPointerEvent } from "react";
import type { ResizeHandleDirection } from "@/lib/layout/blocks";
import styles from "../../cheatsheet-rendering.module.css";

type ResizeHandlesProps = {
  enabledHandles: ResizeHandleDirection[];
  activeDirection?: ResizeHandleDirection | null;
  onPointerDown: (direction: ResizeHandleDirection, event: ReactPointerEvent<HTMLDivElement>) => void;
};

const HANDLE_CONFIG: { direction: ResizeHandleDirection; className: string; activatedBy: ResizeHandleDirection[] }[] = [
  {
    direction: "north",
    className: styles.cardResizeHandleNorth,
    activatedBy: ["north", "north-east", "north-west"],
  },
  {
    direction: "north-east",
    className: styles.cardResizeHandleNorthEast,
    activatedBy: ["north-east"],
  },
  {
    direction: "east",
    className: styles.cardResizeHandleEast,
    activatedBy: ["east", "north-east", "south-east"],
  },
  {
    direction: "south",
    className: styles.cardResizeHandleSouth,
    activatedBy: ["south", "south-east", "south-west"],
  },
  {
    direction: "south-east",
    className: styles.cardResizeHandleSouthEast,
    activatedBy: ["south-east"],
  },
  {
    direction: "south-west",
    className: styles.cardResizeHandleSouthWest,
    activatedBy: ["south-west"],
  },
  {
    direction: "west",
    className: styles.cardResizeHandleWest,
    activatedBy: ["west", "north-west", "south-west"],
  },
  {
    direction: "north-west",
    className: styles.cardResizeHandleNorthWest,
    activatedBy: ["north-west"],
  },
];

/**
 * Renders resize handles for a block.
 * Only handles in enabledHandles are rendered.
 */
export function ResizeHandles({ enabledHandles, activeDirection, onPointerDown }: ResizeHandlesProps) {
  return (
    <>
      {HANDLE_CONFIG.filter((config) => enabledHandles.includes(config.direction)).map((config) => (
        <div
          key={config.direction}
          className={`${styles.cardResizeHandle} ${config.className}`}
          data-card-resize-handle
          data-active={activeDirection ? config.activatedBy.includes(activeDirection) : false}
          onPointerDown={(event) => onPointerDown(config.direction, event)}
        />
      ))}
    </>
  );
}
