"use client";

import { useSyncExternalStore } from "react";
import { renderInlineCode } from "./render-inline-code";

type InlineCodeTextProps = {
  text: string;
};

export function InlineCodeText({ text }: InlineCodeTextProps) {
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

  if (!mounted) {
    return text;
  }

  return <>{renderInlineCode(text)}</>;
}
