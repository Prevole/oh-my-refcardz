"use client";

import type { ReactNode } from "react";
import { KeyboardContextProvider } from "@/hooks/use-keyboard-context";

type Props = {
  children: ReactNode;
};

export function Providers({ children }: Props) {
  return <KeyboardContextProvider>{children}</KeyboardContextProvider>;
}
