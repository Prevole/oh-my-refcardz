"use client";

import { createContext, useContext, useState, useCallback } from "react";
import { useCommandNavigation } from "@/hooks/use-command-navigation";

type CommandNavigationContextValue = {
  registerModalOpen: () => () => void;
};

const CommandNavigationContext = createContext<CommandNavigationContextValue>({
  registerModalOpen: () => () => {},
});

export function useRegisterModalOpen() {
  return useContext(CommandNavigationContext).registerModalOpen;
}

type SheetCommandsShellProps = {
  children: React.ReactNode;
};

export function SheetCommandsShell({ children }: SheetCommandsShellProps) {
  const [openModalCount, setOpenModalCount] = useState(0);

  const registerModalOpen = useCallback(() => {
    setOpenModalCount((n) => n + 1);
    return () => setOpenModalCount((n) => n - 1);
  }, []);

  useCommandNavigation({ modalOpen: openModalCount > 0 });

  return (
    <CommandNavigationContext.Provider value={{ registerModalOpen }}>
      {children}
    </CommandNavigationContext.Provider>
  );
}
