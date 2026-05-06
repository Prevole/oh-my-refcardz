"use client";

import { useSyncExternalStore } from "react";
import { InlineRichText } from "./inline-rich-text";

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

  return <InlineRichText text={text} />;
}
