"use client";

import { createContext, useContext, useState, useCallback, useRef } from "react";
import { useEntryCopy } from "@/hooks/use-entry-copy";
import { ItemDetailModal } from "./item-detail-modal";
import { CommandCopyModal } from "./command-copy-modal";
import type { CheatSheetEntry } from "@/lib/yaml-cheatsheets";
// TODO: Re-enable after entry-based navigation is implemented
// import { useCommandNavigation } from "@/hooks/use-command-navigation";

type DetailData = {
  title: string;
  detailedEntries: CheatSheetEntry[];
  accentColor: string | null;
};

type CopyData = {
  command: string;
  accentColor: string | null;
};

type CommandNavigationContextValue = {
  registerModalOpen: () => () => void;
  showDetail: (data: Omit<DetailData, "accentColor">) => void;
  showCopyModal: (data: Omit<CopyData, "accentColor">) => void;
};

const CommandNavigationContext = createContext<CommandNavigationContextValue>({
  registerModalOpen: () => () => {},
  showDetail: () => {},
  showCopyModal: () => {},
});

export function useRegisterModalOpen() {
  return useContext(CommandNavigationContext).registerModalOpen;
}

export function useShowDetail() {
  return useContext(CommandNavigationContext).showDetail;
}

export function useShowCopyModal() {
  return useContext(CommandNavigationContext).showCopyModal;
}

type SheetCommandsShellProps = {
  children: React.ReactNode;
};

export function SheetCommandsShell({ children }: SheetCommandsShellProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [openModalCount, setOpenModalCount] = useState(0);
  const [detailData, setDetailData] = useState<DetailData | null>(null);
  const [copyData, setCopyData] = useState<CopyData | null>(null);

  const getAccentColor = useCallback(() => {
    return containerRef.current
      ? getComputedStyle(containerRef.current).getPropertyValue("--sheet-accent").trim() || null
      : null;
  }, []);

  const registerModalOpen = useCallback(() => {
    setOpenModalCount((n) => n + 1);
    return () => setOpenModalCount((n) => n - 1);
  }, []);

  const showDetail = useCallback((data: Omit<DetailData, "accentColor">) => {
    setDetailData({ ...data, accentColor: getAccentColor() });
  }, [getAccentColor]);

  const closeDetail = useCallback(() => {
    setDetailData(null);
  }, []);

  const showCopyModal = useCallback((data: Omit<CopyData, "accentColor">) => {
    setCopyData({ ...data, accentColor: getAccentColor() });
  }, [getAccentColor]);

  const closeCopyModal = useCallback(() => {
    setCopyData(null);
  }, []);

  const modalOpen = openModalCount > 0 || detailData !== null || copyData !== null;

  useEntryCopy({ modalOpen });

  // TODO: Re-enable after entry-based navigation is implemented
  // useCommandNavigation({ modalOpen });

  return (
    <CommandNavigationContext.Provider value={{ registerModalOpen, showDetail, showCopyModal }}>
      <div ref={containerRef}>
        {children}
      </div>
      {detailData && (
        <ItemDetailModal
          title={detailData.title}
          detailedEntries={detailData.detailedEntries}
          accentColor={detailData.accentColor}
          onClose={closeDetail}
        />
      )}
      {copyData && (
        <CommandCopyModal
          title="Copy Command"
          command={copyData.command}
          accentColor={copyData.accentColor}
          onClose={closeCopyModal}
        />
      )}
    </CommandNavigationContext.Provider>
  );
}
