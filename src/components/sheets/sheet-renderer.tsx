"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { SheetGrid, GRID_COLUMNS } from "@/components/sheets/sheet-grid";
import { EntryRenderer } from "@/components/sheets/entry-renderers";
import { ItemActions } from "@/components/sheets/item-actions";
import { getItemAnchorId } from "@/lib/anchors";
import { getRenderableBlocks, type CheatSheetItem, type YamlCheatSheetWithMeta } from "@/lib/cheatsheet-shared";
import { buildBlockAnchorId } from "@/lib/anchor-navigation";
import { migrateBlockLayouts, toOldBlockLayouts } from "@/lib/layout/migration";
import { LayoutSnapshotProvider } from "@/lib/layout/layout-snapshot-context";
import type { LayoutBlock, MoveIntent, ResizeIntent } from "@/lib/layout/solver/types";
import {
  useLayoutPersistence,
  useLayoutEditor,
  useCardDragV2,
  useCardResizeV2,
  useCardKeyboardV2,
  BlockRenderer,
  FALLBACK_METRICS,
  type GridMetricsState,
  type ResizeHandleDirection,
} from "./layout";
import cheatsheetStyles from "./cheatsheet-rendering.module.css";

type Props = {
  sheetSlug: string;
  sheet: YamlCheatSheetWithMeta;
};

export function YamlSheetRenderer({ sheetSlug, sheet }: Props) {
  const blocks = getRenderableBlocks(sheet);
  const [gridMetrics, setGridMetrics] = useState<GridMetricsState>(FALLBACK_METRICS);

  // Use existing persistence hook (1-indexed format)
  const { blockLayouts, setBlockLayouts, hydrated, hasSavedLayout, resetLayout } = useLayoutPersistence(
    sheetSlug,
    sheet
  );

  // Convert to 0-indexed format for V2 hooks
  const initialBlocksV2 = useMemo(() => migrateBlockLayouts(blockLayouts), [blockLayouts]);

  // Layout editor hook (orchestrates the editing session)
  const editor = useLayoutEditor({
    initialBlocks: initialBlocksV2,
    gridColumns: GRID_COLUMNS,
    onCommit: useCallback(
      (newBlocks: LayoutBlock[]) => {
        // Convert back to 1-indexed format and persist
        setBlockLayouts(toOldBlockLayouts(newBlocks));
      },
      [setBlockLayouts]
    ),
  });

  // Sync from persistence to editor when persistence changes (e.g., hydration or reset)
  useEffect(() => {
    const newBlocks = migrateBlockLayouts(blockLayouts);
    // Only update if different to avoid infinite loops
    if (JSON.stringify(newBlocks) !== JSON.stringify(editor.committedBlocks)) {
      editor.setCommittedLayout(newBlocks);
    }
  }, [blockLayouts]); // eslint-disable-line react-hooks/exhaustive-deps

  // Drag hook
  const { dragState, startBlockDrag } = useCardDragV2({
    blocks: editor.currentBlocks,
    gridMetrics,
    onDragStart: useCallback(
      (blockId: string) => {
        editor.startInteraction("drag", blockId);
      },
      [editor]
    ),
    onDragMove: useCallback(
      (intent: MoveIntent) => {
        editor.applyIntent(intent);
      },
      [editor]
    ),
    onDragEnd: useCallback(() => {
      editor.commitInteraction();
    }, [editor]),
    onDragCancel: useCallback(() => {
      editor.cancelInteraction();
    }, [editor]),
  });

  // Resize hook
  const { resizeState, startBlockResize } = useCardResizeV2({
    blocks: editor.currentBlocks,
    gridMetrics,
    onResizeStart: useCallback(
      (blockId: string) => {
        editor.startInteraction("resize", blockId);
      },
      [editor]
    ),
    onResizeMove: useCallback(
      (intent: ResizeIntent) => {
        editor.applyIntent(intent);
      },
      [editor]
    ),
    onResizeEnd: useCallback(() => {
      editor.commitInteraction();
    }, [editor]),
    onResizeCancel: useCallback(() => {
      editor.cancelInteraction();
    }, [editor]),
  });

  // Keyboard hook
  const { focusedCard, setFocusedCard, isManipulating } = useCardKeyboardV2({
    blocks: editor.currentBlocks,
    onMoveIntent: useCallback(
      (intent: MoveIntent) => {
        editor.applyIntent(intent);
      },
      [editor]
    ),
    onResizeIntent: useCallback(
      (intent: ResizeIntent) => {
        editor.applyIntent(intent);
      },
      [editor]
    ),
  });

  const isLayoutActive = Boolean(dragState || resizeState || focusedCard);

  // Build a map of current blocks by ID for rendering
  const currentBlocksById = useMemo(
    () => new Map(editor.currentBlocks.map((block) => [block.id, block])),
    [editor.currentBlocks]
  );

  // Anchor target sync effect
  useEffect(() => {
    function syncAnchorTargetState() {
      const currentTarget = document.querySelector<HTMLElement>("[data-anchor-target='true']");
      currentTarget?.removeAttribute("data-anchor-target");

      const currentCard = document.querySelector<HTMLElement>("[data-anchor-target-card='true']");
      currentCard?.removeAttribute("data-anchor-target-card");

      const hash = window.location.hash;
      if (!hash.startsWith("#") || hash.length <= 1) {
        return;
      }

      const target = document.getElementById(decodeURIComponent(hash.slice(1)));
      if (!target?.matches("[data-item]")) {
        return;
      }

      target.setAttribute("data-anchor-target", "true");
      target.closest("article")?.setAttribute("data-anchor-target-card", "true");
    }

    syncAnchorTargetState();
    window.addEventListener("hashchange", syncAnchorTargetState);
    return () => window.removeEventListener("hashchange", syncAnchorTargetState);
  }, []);

  function updateGridMetrics(nextMetrics: GridMetricsState) {
    setGridMetrics((currentMetrics) => {
      if (currentMetrics.columns === nextMetrics.columns && currentMetrics.unitSize === nextMetrics.unitSize) {
        return currentMetrics;
      }
      return nextMetrics;
    });
  }

  function handleHeaderPointerDown(blockId: string, event: React.PointerEvent<HTMLElement>) {
    setFocusedCard(null);
    startBlockDrag(blockId, event);
  }

  function handleResizePointerDown(
    blockId: string,
    direction: ResizeHandleDirection,
    event: React.PointerEvent<HTMLElement>
  ) {
    setFocusedCard(null);
    startBlockResize(blockId, direction, event);
  }

  return (
    <LayoutSnapshotProvider snapshot={editor.snapshot}>
      <div className={cheatsheetStyles.layoutToolbar}>
        <div className={cheatsheetStyles.layoutToolbarMeta}>
          <span className={cheatsheetStyles.layoutStorageStatus} suppressHydrationWarning>
            {hydrated && hasSavedLayout ? "Saved locally" : "Default layout"}
          </span>
          {isLayoutActive ? (
            <span className={cheatsheetStyles.sectionLayoutLabel}>
              {gridMetrics.columns} cols · {Math.round(gridMetrics.unitSize)}px
            </span>
          ) : null}
          <button
            type="button"
            className={cheatsheetStyles.layoutSecondaryButton}
            onClick={resetLayout}
            disabled={!hydrated || !hasSavedLayout}
            suppressHydrationWarning
          >
            Reset layout
          </button>
        </div>
      </div>

      <SheetGrid editMode={isLayoutActive} onMetricsChange={updateGridMetrics}>
        {blocks.map((block) => {
          const layoutBlock = currentBlocksById.get(block.id);
          if (!layoutBlock) return null;

          // Convert 0-indexed position to 1-indexed for BlockRenderer
          const pos = layoutBlock.position;
          const colStart = pos.x + 1;
          const rowStart = pos.y + 1;
          const colSpan = pos.w;
          const rowSpan = pos.h;

          const isDragging = Boolean(dragState && dragState.blockId === block.id);
          const isResizing = Boolean(resizeState && resizeState.blockId === block.id);
          const isKeyboardFocused = Boolean(focusedCard && focusedCard.blockId === block.id);
          const isDimmed = Boolean(dragState || resizeState || focusedCard) && !isDragging && !isResizing && !isKeyboardFocused;

          return (
            <BlockRenderer
              key={block.id}
              kind={block.kind}
              id={buildBlockAnchorId(block.kind === "heading" ? "sheet-heading" : "sheet-card", block.id)}
              title={block.title}
              text={block.kind === "heading" ? block.text : undefined}
              colStart={colStart}
              rowStart={rowStart}
              colSpan={colSpan}
              rowSpan={rowSpan}
              editMode={isLayoutActive}
              dragging={isDragging || isResizing}
              dimmed={isDimmed}
              keyboardFocused={isKeyboardFocused}
              manipulating={isKeyboardFocused && isManipulating}
              onHeaderPointerDown={(event) => handleHeaderPointerDown(block.id, event)}
              onResizePointerDown={(direction, event) => handleResizePointerDown(block.id, direction, event)}
              activeResizeDirection={isResizing && resizeState ? resizeState.direction : null}
              layoutLabel={`${colStart},${rowStart} · ${colSpan}x${rowSpan}`}
            >
              {block.kind === "card" ? (
                <div className={cheatsheetStyles.itemList}>
                  {block.items.map((item, itemIndex) => (
                    <SheetItem key={itemIndex} item={item} />
                  ))}
                </div>
              ) : null}
            </BlockRenderer>
          );
        })}
      </SheetGrid>
    </LayoutSnapshotProvider>
  );
}

function SheetItem({ item }: { item: CheatSheetItem }) {
  const anchorId = getItemAnchorId(item.entries);
  const hasAliases = item.entries.some(
    (entry) => "alias" in entry || "aliases" in entry
  );
  const hasDetailedEntries = item.detailedEntries && item.detailedEntries.length > 0;

  const titleEntry = item.entries.find((entry) => "title" in entry);
  const title = titleEntry && "title" in titleEntry ? titleEntry.title : "Details";

  const itemData = hasDetailedEntries
    ? JSON.stringify({ title, detailedEntries: item.detailedEntries })
    : undefined;

  return (
    <div
      id={anchorId ?? undefined}
      className={cheatsheetStyles.itemEntries}
      data-item=""
      data-item-details={itemData}
    >
      {hasDetailedEntries && (
        <ItemActions hasExample={true} />
      )}
      <div className={cheatsheetStyles.itemEntriesHeader}>
        {item.entries.map((entry, index) => (
          <EntryRenderer key={index} entry={entry} hasAliases={hasAliases} />
        ))}
      </div>
    </div>
  );
}
