"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { GridPosition, LayoutBlock } from "@/lib/layout/engine";

/**
 * Snapshot of the currently committed layout, keyed by block id.
 *
 * Carries only geometric information (no titles, no kinds). Consumers that
 * need richer metadata keep their own source of truth (e.g. YAML titles in
 * the navigation) and use the snapshot solely to reorder items.
 */
export type LayoutSnapshot = {
  blocks: ReadonlyMap<string, GridPosition>;
};

const EMPTY_SNAPSHOT: LayoutSnapshot = { blocks: new Map() };

type LayoutSnapshotContextValue = {
  snapshot: LayoutSnapshot;
  publishSnapshot: (blocks: readonly LayoutBlock[]) => void;
};

const LayoutSnapshotContext = createContext<LayoutSnapshotContextValue | null>(null);

type ProviderProps = {
  children: ReactNode;
};

/**
 * Provides a live layout snapshot to descendants. Designed to wrap both the
 * sheet renderer (which publishes on commit) and the heading navigation
 * (which reads to sort entries by current Y/X). Renderer and navigation are
 * rendered as siblings under this provider.
 */
export function LayoutSnapshotProvider({ children }: ProviderProps) {
  const [snapshot, setSnapshot] = useState<LayoutSnapshot>(EMPTY_SNAPSHOT);

  const publishSnapshot = useCallback((blocks: readonly LayoutBlock[]) => {
    const next = new Map<string, GridPosition>();
    for (const block of blocks) {
      next.set(block.id, { ...block.position });
    }
    setSnapshot({ blocks: next });
  }, []);

  const value = useMemo<LayoutSnapshotContextValue>(
    () => ({ snapshot, publishSnapshot }),
    [snapshot, publishSnapshot]
  );

  return (
    <LayoutSnapshotContext.Provider value={value}>
      {children}
    </LayoutSnapshotContext.Provider>
  );
}

/**
 * Read the current layout snapshot. Returns an empty snapshot when called
 * outside a provider (defensive default — consumers can render in initial
 * source order until the renderer publishes).
 */
export function useLayoutSnapshot(): LayoutSnapshot {
  const ctx = useContext(LayoutSnapshotContext);
  return ctx?.snapshot ?? EMPTY_SNAPSHOT;
}

/**
 * Write access to the layout snapshot. Returns a no-op when called outside
 * a provider. Intended for the sheet renderer only; other writers are a
 * convention violation, not a type-level error.
 */
export function usePublishLayoutSnapshot(): (blocks: readonly LayoutBlock[]) => void {
  const ctx = useContext(LayoutSnapshotContext);
  return ctx?.publishSnapshot ?? noopPublish;
}

function noopPublish() {
  /* no provider mounted — silently ignore */
}

/**
 * Stable sort of items by their current Y then X position in the snapshot.
 * Items whose id is not (yet) in the snapshot keep their original relative
 * order at the head of the list. Pure function — does not mutate input.
 */
export function sortByLayoutOrder<T extends { id: string }>(
  items: readonly T[],
  snapshot: LayoutSnapshot
): T[] {
  const positions = snapshot.blocks;
  const indexed = items.map((item, index) => ({ item, index }));

  indexed.sort((a, b) => {
    const posA = positions.get(a.item.id);
    const posB = positions.get(b.item.id);

    if (!posA && !posB) return a.index - b.index;
    if (!posA) return -1;
    if (!posB) return 1;

    if (posA.y !== posB.y) return posA.y - posB.y;
    if (posA.x !== posB.x) return posA.x - posB.x;
    return a.index - b.index;
  });

  return indexed.map((entry) => entry.item);
}
