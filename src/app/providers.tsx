"use client";

import type { ReactNode } from "react";
import { KeyboardContextProvider } from "@/hooks/use-keyboard-context";
import { KeybindingsProvider } from "@/hooks/use-keybindings";
import { UISettingsProvider } from "@/hooks/use-ui-settings";
import { KeyboardDispatcher } from "@/components/keyboard/keyboard-dispatcher";

type Props = {
  children: ReactNode;
};

export function Providers({ children }: Props) {
  return (
    <UISettingsProvider>
      <KeybindingsProvider>
        <KeyboardContextProvider>
          <KeyboardDispatcher />
          {children}
        </KeyboardContextProvider>
      </KeybindingsProvider>
    </UISettingsProvider>
  );
}
