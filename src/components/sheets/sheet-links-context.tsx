"use client";

import { createContext, useContext } from "react";

const SheetLinksContext = createContext<Set<string>>(new Set());

type SheetLinksProviderProps = {
  knownSlugs: string[];
  children: React.ReactNode;
};

export function SheetLinksProvider({ knownSlugs, children }: SheetLinksProviderProps) {
  return (
    <SheetLinksContext.Provider value={new Set(knownSlugs)}>
      {children}
    </SheetLinksContext.Provider>
  );
}

export function useKnownSheetSlugs() {
  return useContext(SheetLinksContext);
}
