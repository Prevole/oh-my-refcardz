"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { SheetGrid, GRID_COLUMNS } from "@/components/sheets/sheet-grid";
import { EntryRenderer } from "@/components/sheets/entry-renderers";
import { ItemActions } from "@/components/sheets/item-actions";
import { getItemAnchorId } from "@/lib/anchors";
import { getRenderableBlocks, type CheatSheetItem, type YamlCheatSheetWithMeta } from "@/lib/cheatsheet-shared";
import { buildBlockAnchorId } from "@/lib/anchor-navigation";
import { migrateBlockLayouts, toOldBlockLayouts } from "@/lib/layout/migration";
import { syncLayoutToDev } from "@/lib/dev-layout-sync";
import { DevRecorderButton, createDevIdMap, type DevRecorderButtonHandle } from "@/components/dev-mode";
import { useDeveloperMode, debugRecorder } from "@/lib/dev-mode";
import {
  DevAxesOverlay,
  DevModeBar,
  DevLogsDropdown,
  type DevAxesOverlayHandle,
  type DevLogsDropdownHandle,
} from "@/components/sheets/dev-overlay";
import type { BlockConstraints, GridPosition, LayoutBlock, MoveOperation, ResizeOperation } from "@/lib/layout/engine";
import { useKeybindings } from "@/hooks/use-keybindings";
import { useKeyboardScope, useScopedKeyboardHandler } from "@/hooks/use-keyboard-context";
import { useAction } from "@/hooks/use-action";
import { ACTION_IDS } from "@/lib/keybindings";
import {
  useLayoutPersistence,
  useLayoutEditor,
  useLayoutBufferState,
  useLayoutHistory,
  useCardDragV2,
  useCardResizeV2,
  useLayoutKeyboard,
  usePublishLayoutSnapshot,
  BlockRenderer,
  FALLBACK_METRICS,
  getBlockConstraintsV2,
  type GridMetricsState,
  type ResizeHandleDirection,
} from "./layout";
import type { DragMove } from "./layout/use-card-drag-v2";
import type { ResizeMove } from "./layout/use-card-resize-v2";
import { LayoutBufferResetButton } from "./layout/layout-buffer-reset-button";
import { LayoutResetButton } from "./layout/layout-reset-button";
import { LayoutModePill, LAYOUT_MODE_COLORS } from "./layout/layout-mode-pill";
import { LayoutDiscardConfirm } from "./layout/layout-discard-confirm";
import cheatsheetStyles from "./cheatsheet-rendering.module.css";

type Props = {
  sheetSlug: string;
  sheet: YamlCheatSheetWithMeta;
};

export function YamlSheetRenderer({ sheetSlug, sheet }: Props) {
  const blocks = getRenderableBlocks(sheet);
  const [gridMetrics, setGridMetrics] = useState<GridMetricsState>(FALLBACK_METRICS);

  const {
    blockLayouts,
    setBlockLayouts,
    hydrated,
    isModifiedFromOriginal,
    resetToOriginal,
    promoteCurrentAsBaseline,
  } = useLayoutPersistence(sheetSlug, sheet);

  const initialBlocksV2 = useMemo(() => migrateBlockLayouts(blockLayouts), [blockLayouts]);

  // Anti-loop guard for the history layer: when undo/redo writes via
  // `editor.commitLayout`, the `onCommit` -> `setBlockLayouts` chain would
  // schedule the persistence-sync effect below and reapply the same value
  // back through `setCommittedLayout`. The flag short-circuits that effect
  // for one microtask while history is in flight.
  const isApplyingHistoryRef = useRef(false);

  // History push callbacks are owned by `useLayoutHistory`, but the
  // editor / keyboard hooks below are constructed first to provide their
  // dependencies. We bridge through refs that are assigned right after
  // `useLayoutHistory` instantiation.
  const pushMouseRef = useRef<(snapshot: readonly LayoutBlock[]) => void>(() => {});
  const pushKeyboardRef = useRef<(snapshot: readonly LayoutBlock[]) => void>(() => {});

  const editor = useLayoutEditor({
    initialBlocks: initialBlocksV2,
    gridColumns: GRID_COLUMNS,
    onCommit: useCallback(
      (newBlocks: LayoutBlock[]) => {
        setBlockLayouts(toOldBlockLayouts(newBlocks));
      },
      [setBlockLayouts]
    ),
    onInteractionCommit: useCallback((newBlocks: LayoutBlock[]) => {
      pushMouseRef.current(newBlocks);
    }, []),
  });

  // Sync persistence -> editor when persistence changes (hydration, reset).
  useEffect(() => {
    if (isApplyingHistoryRef.current) return;
    const newBlocks = migrateBlockLayouts(blockLayouts);
    if (JSON.stringify(newBlocks) !== JSON.stringify(editor.committedBlocks)) {
      editor.setCommittedLayout(newBlocks);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blockLayouts]);

  // Publish the live committed layout to the LayoutSnapshotProvider so that
  // siblings (heading navigation today) can sort against the current
  // positions. Driven from `committedBlocks` rather than the `onCommit`
  // callback so that hydration and reset both flow through one branch.
  const publishLayoutSnapshot = usePublishLayoutSnapshot();
  useEffect(() => {
    publishLayoutSnapshot(editor.committedBlocks);
  }, [editor.committedBlocks, publishLayoutSnapshot]);

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

  // -- Keyboard buffered staging -------------------------------------------
  // Holds the in-memory edits produced by keyboard ops while layout mode
  // is active. The sheet renders the buffer whenever it's populated; the
  // persisted layout is only touched on commit (Return, FA3) or on the
  // pre-FA "always commit" path (Esc, until FA4 swaps it to discard).
  const bufferState = useLayoutBufferState();
  const displayedBlocks = bufferState.bufferBlocks ?? editor.currentBlocks;

  // History layer — must come after editor + bufferState since it depends on
  // both. The push callbacks are bridged through refs assigned right below
  // so the editor / keyboard hooks (declared earlier or below) can reach
  // them through stable closures.
  const history = useLayoutHistory({
    editor,
    bufferState,
    isApplyingHistoryRef,
  });
  useEffect(() => {
    pushMouseRef.current = history.pushMouse;
    pushKeyboardRef.current = history.pushKeyboard;
  }, [history.pushMouse, history.pushKeyboard]);

  // -- Keyboard (Zellij modal layout mode, entered via Ctrl+M) ------------
  const {
    mode: layoutMode,
    focusedCard,
    setFocusedCard,
    isManipulating,
    discardConfirmOpen,
    handleDiscardConfirm,
    handleDiscardCancel,
    exitLayoutMode,
  } = useLayoutKeyboard({
    blocks: displayedBlocks as LayoutBlock[],
    editor,
    bufferState,
    gridColumns: GRID_COLUMNS,
    onKeyboardMutation: useCallback((snapshot: readonly LayoutBlock[]) => {
      pushKeyboardRef.current(snapshot);
    }, []),
    onLayoutReset: useCallback((snapshot: readonly LayoutBlock[]) => {
      pushKeyboardRef.current(snapshot);
    }, []),
  });

  // Undo / redo actions — bound on both `sheet` and `layout` scopes so the
  // same shortcuts work whether the user is in mouse mode or inside the
  // Zellij-style buffered keyboard session.
  useAction(ACTION_IDS.LAYOUT_UNDO, "sheet", history.undo);
  useAction(ACTION_IDS.LAYOUT_REDO, "sheet", history.redo);
  useAction(ACTION_IDS.LAYOUT_UNDO, "layout", history.undo);
  useAction(ACTION_IDS.LAYOUT_REDO, "layout", history.redo);

  // -- Reset layout shortcut (user feature, Shift+R) -----------------------
  const { matchesAction } = useKeybindings();
  useScopedKeyboardHandler(
    "sheet",
    (event: KeyboardEvent) => {
      const tag = (event.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return;
      if (!matchesAction(event, ACTION_IDS.RESET_LAYOUT)) return;
      if (!isModifiedFromOriginal) return;
      event.preventDefault();
      resetToOriginal();
    },
    [matchesAction, isModifiedFromOriginal, resetToOriginal]
  );

  const isLayoutActive = Boolean(dragState || resizeState || focusedCard);

  // -- Developer mode ------------------------------------------------------
  const { enabled: debugEnabled, toggle: toggleDeveloperMode } = useDeveloperMode();
  const [debugInitialPositions, setDebugInitialPositions] = useState<Map<string, GridPosition>>(
    () => new Map()
  );
  const prevDebugEnabledRef = useRef(false);
  const recorderRef = useRef<DevRecorderButtonHandle>(null);
  const logsRef = useRef<DevLogsDropdownHandle>(null);
  const axesRef = useRef<DevAxesOverlayHandle>(null);

  // Push the dedicated `dev` scope while developer mode is on. This makes
  // every sheet-level keybinding inert (they are all gated on the `sheet`
  // scope or via `useScopedKeyboardHandler("sheet", …)`), so dev-mode keys
  // can be defined without conflicts.
  useKeyboardScope("dev", debugEnabled, { modal: true });

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

  // -- Dev mode keyboard actions ------------------------------------------
  // The `dev` scope is pushed while developer mode is on. These handlers are
  // therefore only active in that mode and never collide with sheet/global
  // bindings.
  const saveLayoutToDev = useCallback(() => {
    syncLayoutToDev(sheetSlug, toOldBlockLayouts(editor.committedBlocks))
      .then((response) => {
        if (!response.ok) {
          console.warn(
            `[dev] Save layout for ${sheetSlug} returned ${response.status}`
          );
          return;
        }
        // The server-side YAML is now in sync with the current committed
        // layout. Promote it locally so `isModifiedFromOriginal` flips back
        // to false and the user-facing reset button hides immediately,
        // without waiting for a page reload to rehydrate sheet props.
        promoteCurrentAsBaseline();
      })
      .catch((err) => {
        console.warn(`[dev] Failed to save layout for ${sheetSlug}:`, err);
      });
  }, [editor.committedBlocks, sheetSlug, promoteCurrentAsBaseline]);

  useAction(ACTION_IDS.DEV_SAVE_LAYOUT, "dev", () => {
    if (process.env.NODE_ENV === "development") saveLayoutToDev();
  });

  useAction(ACTION_IDS.DEV_RESET_LAYOUT, "dev", () => {
    if (isModifiedFromOriginal) resetToOriginal();
  });

  useAction(ACTION_IDS.DEV_TOGGLE_RECORDING, "dev", () => {
    recorderRef.current?.toggle();
  });

  useAction(ACTION_IDS.DEV_TOGGLE_LOGS, "dev", () => {
    logsRef.current?.toggle();
  });

  useAction(ACTION_IDS.DEV_ENTER_AXES_MODE, "dev", () => {
    axesRef.current?.enterAxesMode();
  });

  const debugMaxRow = useMemo(() => {
    let max = 0;
    for (const block of displayedBlocks) {
      const bottom = block.position.y + block.position.h;
      if (bottom > max) max = bottom;
    }
    return max;
  }, [displayedBlocks]);

  const currentBlocksById = useMemo(
    () => new Map(displayedBlocks.map((block) => [block.id, block])),
    [displayedBlocks]
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
    // During a buffered keyboard session, mouse drags would operate
    // on the persisted layout (out of sync with what's rendered).
    // FA6 routes the click through the same discard path as `Esc`:
    // silent below the threshold, modal at/above it. Drag is never
    // started in this case.
    if (bufferState.isActive) {
      exitLayoutMode();
      return;
    }
    setFocusedCard(null);
    startBlockDrag(blockId, event);
  }

  function handleResizePointerDown(
    blockId: string,
    direction: ResizeHandleDirection,
    event: React.PointerEvent<HTMLElement>
  ) {
    if (bufferState.isActive) {
      exitLayoutMode();
      return;
    }
    setFocusedCard(null);
    startBlockResize(blockId, direction, event);
  }

  return (
    <>
      {debugEnabled ? (
        <DevModeBar
          slug={sheetSlug}
          blockCount={editor.currentBlocks.length}
          maxRow={debugMaxRow}
          hasSavedLayout={hydrated && isModifiedFromOriginal}
          onReset={resetToOriginal}
          onSave={saveLayoutToDev}
          recordingSlot={
            <DevRecorderButton
              ref={recorderRef}
              page={`cheatsheets/${sheetSlug}`}
              engine={debugEngineSetup}
              debugIdMap={debugIdMap}
            />
          }
          logsSlot={<DevLogsDropdown ref={logsRef} />}
        />
      ) : null}

      <SheetGrid
        editMode={isLayoutActive}
        debugMode={debugEnabled}
        layoutReady={hydrated}
        onMetricsChange={updateGridMetrics}
        onEmptyPointerDown={
          bufferState.isActive
            ? () => {
                exitLayoutMode();
              }
            : undefined
        }
        style={
          layoutMode !== null
            ? ({ "--layout-mode-color": LAYOUT_MODE_COLORS[layoutMode] } as CSSProperties)
            : undefined
        }
      >
        {debugEnabled ? <DevAxesOverlay ref={axesRef} maxRow={debugMaxRow} /> : null}
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
              blockId={block.id}
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
      {layoutMode !== null && bufferState.changesCount > 0 && !debugEnabled ? (
        <LayoutBufferResetButton onClick={bufferState.reset} />
      ) : layoutMode === null && hydrated && isModifiedFromOriginal && !debugEnabled ? (
        <LayoutResetButton onClick={resetToOriginal} />
      ) : null}
      {layoutMode !== null && !debugEnabled ? (
        <LayoutModePill mode={layoutMode} changesCount={bufferState.changesCount} />
      ) : null}
      <LayoutDiscardConfirm
        open={discardConfirmOpen}
        onConfirm={handleDiscardConfirm}
        onCancel={handleDiscardCancel}
      />
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
