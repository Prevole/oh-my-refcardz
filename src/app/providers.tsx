"use client";

import type { ReactNode } from "react";
import { KeyboardContextProvider } from "@/hooks/use-keyboard-context";
import { UISettingsProvider } from "@/hooks/use-ui-settings";

type Props = {
  children: ReactNode;
};

export function Providers({ children }: Props) {
  return (
    <UISettingsProvider>
      <KeyboardContextProvider>{children}</KeyboardContextProvider>
    </UISettingsProvider>
  );
}
