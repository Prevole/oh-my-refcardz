"use client";

import { useEffect, useState } from "react";
import { SheetGrid } from "@/components/sheets/sheet-grid";
import { EntryRenderer } from "@/components/sheets/entry-renderers";
import { ItemActions } from "@/components/sheets/item-actions";
import { getItemAnchorId } from "@/lib/anchors";
import { getRenderableBlocks, type CheatSheetItem, type YamlCheatSheetWithMeta } from "@/lib/cheatsheet-shared";
import { buildBlockAnchorId } from "@/lib/anchor-navigation";
import {
  useLayoutPersistence,
  useCardDrag,
  useCardResize,
  useCardKeyboard,
  BlockRenderer,
  FALLBACK_METRICS,
  type GridMetricsState,
} from "./layout";
import cheatsheetStyles from "./cheatsheet-rendering.module.css";

type Props = {
  sheetSlug: string;
  sheet: YamlCheatSheetWithMeta;
};

export function YamlSheetRenderer({ sheetSlug, sheet }: Props) {
  const blocks = getRenderableBlocks(sheet);
  const [gridMetrics, setGridMetrics] = useState<GridMetricsState>(FALLBACK_METRICS);

  const { blockLayouts, setBlockLayouts, hydrated, hasSavedLayout, resetLayout } = useLayoutPersistence(
    sheetSlug,
    sheet
  );

  const { dragState, startBlockDrag } = useCardDrag(blockLayouts, setBlockLayouts, gridMetrics);
  const { resizeState, startBlockResize } = useCardResize(blockLayouts, setBlockLayouts, gridMetrics);

  const { focusedCard, setFocusedCard, isManipulating } = useCardKeyboard({
    blockLayouts,
    setBlockLayouts,
  });

  const isLayoutActive = Boolean(dragState || resizeState || focusedCard);
  const layoutMetrics = gridMetrics;
  const blockLayoutsById = new Map(blockLayouts.map((layout) => [layout.id, layout]));

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
    direction: "north" | "east" | "south" | "west" | "north-east" | "south-east" | "south-west" | "north-west",
    event: React.PointerEvent<HTMLElement>
  ) {
    setFocusedCard(null);
    startBlockResize(blockId, direction, event);
  }

  return (
    <>
      <div className={cheatsheetStyles.layoutToolbar}>
        <div className={cheatsheetStyles.layoutToolbarMeta}>
          <span className={cheatsheetStyles.layoutStorageStatus} suppressHydrationWarning>
            {hydrated && hasSavedLayout ? "Saved locally" : "Default layout"}
          </span>
          {isLayoutActive ? (
            <span className={cheatsheetStyles.sectionLayoutLabel}>
              {layoutMetrics.columns} cols · {Math.round(layoutMetrics.unitSize)}px
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
          const baseLayout = blockLayoutsById.get(block.id);
          if (!baseLayout) return null;

          const isDragging = Boolean(dragState && dragState.blockId === block.id);
          const isResizing = Boolean(resizeState && resizeState.blockId === block.id);
          const isKeyboardFocused = Boolean(focusedCard && focusedCard.blockId === block.id);
          const isDimmed = Boolean(dragState || resizeState || focusedCard) && !isDragging && !isResizing && !isKeyboardFocused;
          const previewLayout = isDragging && dragState
            ? {
                colStart: dragState.colStart,
                rowStart: dragState.rowStart,
                colSpan: dragState.colSpan,
                rowSpan: dragState.rowSpan,
              }
            : isResizing && resizeState
              ? {
                  colStart: resizeState.colStart,
                  rowStart: resizeState.rowStart,
                  colSpan: resizeState.colSpan,
                  rowSpan: resizeState.rowSpan,
                }
              : baseLayout;

          return (
            <BlockRenderer
              key={block.id}
              kind={block.kind}
              id={buildBlockAnchorId(block.kind === "heading" ? "sheet-heading" : "sheet-card", block.id)}
              title={block.title}
              text={block.kind === "heading" ? block.text : undefined}
              colStart={previewLayout.colStart}
              rowStart={previewLayout.rowStart}
              colSpan={previewLayout.colSpan}
              rowSpan={previewLayout.rowSpan}
              editMode={isLayoutActive}
              dragging={isDragging || isResizing}
              dimmed={isDimmed}
              keyboardFocused={isKeyboardFocused}
              manipulating={isKeyboardFocused && isManipulating}
              onHeaderPointerDown={(event) => handleHeaderPointerDown(block.id, event)}
              onResizePointerDown={(direction, event) => handleResizePointerDown(block.id, direction, event)}
              activeResizeDirection={isResizing && resizeState ? resizeState.direction : null}
              layoutLabel={`${previewLayout.colStart},${previewLayout.rowStart} · ${previewLayout.colSpan}x${previewLayout.rowSpan}`}
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
    </>
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
