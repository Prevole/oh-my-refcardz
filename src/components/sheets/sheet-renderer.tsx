"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SheetGrid, GRID_COLUMNS } from "@/components/sheets/sheet-grid";
import { EntryRenderer } from "@/components/sheets/entry-renderers";
import { ItemActions } from "@/components/sheets/item-actions";
import { getItemAnchorId } from "@/lib/anchors";
import { getRenderableBlocks, type CheatSheetItem, type YamlCheatSheetWithMeta } from "@/lib/cheatsheet-shared";
import { buildBlockAnchorId } from "@/lib/anchor-navigation";
import { migrateBlockLayouts, toOldBlockLayouts } from "@/lib/layout/migration";
import { syncLayoutToDev } from "@/lib/dev-layout-sync";
import { DevRecorderButton, createDevIdMap } from "@/components/dev-mode";
import { useDeveloperMode, debugRecorder } from "@/lib/dev-mode";
import { DevAxesOverlay, DevModeBar, DevLogsDropdown } from "@/components/sheets/dev-overlay";
import type { BlockConstraints, GridPosition, LayoutBlock, MoveOperation, ResizeOperation } from "@/lib/layout/engine";
import { useKeybindings } from "@/hooks/use-keybindings";
import { ACTION_IDS } from "@/lib/keybindings";
import {
  useLayoutPersistence,
  useLayoutEditor,
  useCardDragV2,
  useCardResizeV2,
  useCardKeyboardV2,
  BlockRenderer,
  FALLBACK_METRICS,
  getBlockConstraintsV2,
  type GridMetricsState,
  type ResizeHandleDirection,
} from "./layout";
import type { DragMove } from "./layout/use-card-drag-v2";
import type { ResizeMove } from "./layout/use-card-resize-v2";
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

  const initialBlocksV2 = useMemo(() => migrateBlockLayouts(blockLayouts), [blockLayouts]);

  const editor = useLayoutEditor({
    initialBlocks: initialBlocksV2,
    gridColumns: GRID_COLUMNS,
    onCommit: useCallback(
      (newBlocks: LayoutBlock[]) => {
        setBlockLayouts(toOldBlockLayouts(newBlocks));
      },
      [setBlockLayouts]
    ),
  });

  // Sync persistence -> editor when persistence changes (hydration, reset).
  useEffect(() => {
    const newBlocks = migrateBlockLayouts(blockLayouts);
    if (JSON.stringify(newBlocks) !== JSON.stringify(editor.committedBlocks)) {
      editor.setCommittedLayout(newBlocks);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blockLayouts]);

  // -- Drag ----------------------------------------------------------------
  const handleDragStart = useCallback(
    (blockId: string) => editor.startInteraction("drag", blockId),
    [editor]
  );
  const handleDragMove = useCallback(
    (move: DragMove) => {
      const op: MoveOperation = {
        kind: "move",
        blockId: move.blockId,
        dx: move.dx,
        dy: move.dy,
      };
      editor.applyInteractionOperation(op, {
        allowShrink: !move.strict,
        allowWrap: !move.strict,
      });
    },
    [editor]
  );
  const handleDragEnd = useCallback(() => editor.commitInteraction(), [editor]);
  const handleDragCancel = useCallback(() => editor.cancelInteraction(), [editor]);

  const { dragState, startBlockDrag } = useCardDragV2({
    blocks: editor.currentBlocks,
    gridMetrics,
    onDragStart: handleDragStart,
    onDragMove: handleDragMove,
    onDragEnd: handleDragEnd,
    onDragCancel: handleDragCancel,
  });

  // -- Resize --------------------------------------------------------------
  const handleResizeStart = useCallback(
    (blockId: string) => editor.startInteraction("resize", blockId),
    [editor]
  );
  const handleResizeMove = useCallback(
    (move: ResizeMove) => {
      const op: ResizeOperation = {
        kind: "resize",
        blockId: move.blockId,
        edge: move.edge,
        delta: move.delta,
      };
      editor.applyInteractionOperation(op, {
        compact: move.compact,
        allowShrink: !move.strict,
        allowWrap: !move.strict,
      });
    },
    [editor]
  );
  const handleResizeEnd = useCallback(() => editor.commitInteraction(), [editor]);
  const handleResizeCancel = useCallback(() => editor.cancelInteraction(), [editor]);

  const { resizeState, startBlockResize } = useCardResizeV2({
    blocks: editor.currentBlocks,
    gridMetrics,
    onResizeStart: handleResizeStart,
    onResizeMove: handleResizeMove,
    onResizeEnd: handleResizeEnd,
    onResizeCancel: handleResizeCancel,
  });

  // -- Keyboard (inert in step 5; step 5b will wire Zellij modes) ---------
  const { focusedCard, setFocusedCard, isManipulating } = useCardKeyboardV2({
    blocks: editor.currentBlocks,
  });

  // -- Dev save shortcut ---------------------------------------------------
  const { matchesAction } = useKeybindings();
  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;

    function onKeyDown(event: KeyboardEvent) {
      if (!matchesAction(event, ACTION_IDS.LAYOUT_DEV_SAVE)) return;
      event.preventDefault();
      syncLayoutToDev(sheetSlug, toOldBlockLayouts(editor.committedBlocks)).catch((err) => {
        console.warn(`[dev] Failed to save layout for ${sheetSlug}:`, err);
      });
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [editor.committedBlocks, matchesAction, sheetSlug]);

  const isLayoutActive = Boolean(dragState || resizeState || focusedCard);

  // -- Developer mode ------------------------------------------------------
  const { enabled: debugEnabled, toggle: toggleDeveloperMode } = useDeveloperMode();
  const [debugInitialPositions, setDebugInitialPositions] = useState<Map<string, GridPosition>>(
    () => new Map()
  );
  const prevDebugEnabledRef = useRef(false);

  useEffect(() => {
    if (debugEnabled && !prevDebugEnabledRef.current) {
      const snapshot = new Map<string, GridPosition>();
      for (const block of editor.currentBlocks) {
        snapshot.set(block.id, { ...block.position });
      }
      setDebugInitialPositions(snapshot);
    } else if (!debugEnabled && prevDebugEnabledRef.current) {
      // Auto-stop any active recording when dev mode is turned off so we don't
      // leak in-flight sessions. The promise is fire-and-forget; failures are
      // logged but should not block the UI transition.
      if (debugRecorder.getState().isRecording) {
        debugRecorder.stop("auto-stopped (dev mode off)").catch((err) => {
          console.warn("[dev] Failed to auto-stop recording:", err);
        });
      }
    }
    prevDebugEnabledRef.current = debugEnabled;
  }, [debugEnabled, editor.currentBlocks]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (!matchesAction(event, ACTION_IDS.TOGGLE_DEVELOPER_MODE)) return;
      event.preventDefault();
      toggleDeveloperMode();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [matchesAction, toggleDeveloperMode]);

  const debugMaxRow = useMemo(() => {
    let max = 0;
    for (const block of editor.currentBlocks) {
      const bottom = block.position.y + block.position.h;
      if (bottom > max) max = bottom;
    }
    return max;
  }, [editor.currentBlocks]);

  const currentBlocksById = useMemo(
    () => new Map(editor.currentBlocks.map((block) => [block.id, block])),
    [editor.currentBlocks]
  );

  const debugIdMap = useMemo(() => createDevIdMap(blocks), [blocks]);

  // Engine setup snapshot for the debug recorder.
  const debugEngineSetup = useMemo(() => {
    const constraints = new Map<string, BlockConstraints>();
    for (const block of editor.committedBlocks) {
      constraints.set(block.id, getBlockConstraintsV2(block.kind));
    }
    return { gridColumns: GRID_COLUMNS, constraints };
  }, [editor.committedBlocks]);

  // Anchor target sync effect.
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
    setGridMetrics((current) => {
      if (current.columns === nextMetrics.columns && current.unitSize === nextMetrics.unitSize) {
        return current;
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
    <>
      {isLayoutActive ? (
        <div className={cheatsheetStyles.layoutToolbar}>
          <div className={cheatsheetStyles.layoutToolbarMeta}>
            <span className={cheatsheetStyles.sectionLayoutLabel}>
              {gridMetrics.columns} cols · {Math.round(gridMetrics.unitSize)}px
            </span>
          </div>
        </div>
      ) : null}

      {debugEnabled ? (
        <DevModeBar
          slug={sheetSlug}
          blockCount={editor.currentBlocks.length}
          maxRow={debugMaxRow}
          hasSavedLayout={hydrated && hasSavedLayout}
          onReset={resetLayout}
          onSave={() => {
            syncLayoutToDev(sheetSlug, toOldBlockLayouts(editor.committedBlocks)).catch((err) => {
              console.warn(`[dev] Failed to save layout for ${sheetSlug}:`, err);
            });
          }}
          recordingSlot={
            <DevRecorderButton
              page={`cheatsheets/${sheetSlug}`}
              engine={debugEngineSetup}
              debugIdMap={debugIdMap}
            />
          }
          logsSlot={<DevLogsDropdown />}
        />
      ) : null}

      <SheetGrid editMode={isLayoutActive} debugMode={debugEnabled} onMetricsChange={updateGridMetrics}>
        {debugEnabled ? <DevAxesOverlay maxRow={debugMaxRow} /> : null}
        {blocks.map((block) => {
          const layoutBlock = currentBlocksById.get(block.id);
          if (!layoutBlock) return null;

          const pos = layoutBlock.position;
          const colStart = pos.x + 1;
          const rowStart = pos.y + 1;
          const colSpan = pos.w;
          const rowSpan = pos.h;

          const isDragging = Boolean(dragState && dragState.blockId === block.id);
          const isResizing = Boolean(resizeState && resizeState.blockId === block.id);
          const isKeyboardFocused = Boolean(focusedCard && focusedCard.blockId === block.id);
          const isDimmed =
            Boolean(dragState || resizeState || focusedCard) &&
            !isDragging &&
            !isResizing &&
            !isKeyboardFocused;

          const debugId = debugIdMap.get(block.id) ?? "?";
          const debugInitial = debugInitialPositions.get(block.id);
          const debugInfo = debugEnabled
            ? {
                debugId,
                blockId: block.id,
                current: pos,
                initial: debugInitial,
              }
            : undefined;

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
              onResizePointerDown={(direction, event) =>
                handleResizePointerDown(block.id, direction, event)
              }
              activeResizeDirection={isResizing && resizeState ? resizeState.edge : null}
              layoutLabel={`[${debugId}] ${colStart},${rowStart} · ${colSpan}x${rowSpan}`}
              debugInfo={debugInfo}
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
  const hasAliases = item.entries.some((entry) => "alias" in entry || "aliases" in entry);
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
      {hasDetailedEntries && <ItemActions hasExample={true} />}
      <div className={cheatsheetStyles.itemEntriesHeader}>
        {item.entries.map((entry, index) => (
          <EntryRenderer key={index} entry={entry} hasAliases={hasAliases} />
        ))}
      </div>
    </div>
  );
}
