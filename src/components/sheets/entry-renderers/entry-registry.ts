import type { ReactNode } from "react";
import type { CheatSheetEntry } from "@/lib/cheatsheet-shared";

export type EntryContext = {
  hasAliases: boolean;
};

export type CheatSheetEntryMap = {
  title: string;
  command: string;
  alias: { content: string; copy?: string };
  commandExample: string;
  commandExamples: string[];
  text: string;
  anchor: string;
  keys: string[];
  file: string;
  where: string;
  content: string;
  contentExample: string;
  settings: string[];
  table: { headers?: string[]; rows: { cols: string[] }[] };
  step: string;
  link: { type: "github" | "docs" | "website"; url: string; label?: string };
};

type EntryHandler<K extends keyof CheatSheetEntryMap> = {
  key: K;
  render: (value: CheatSheetEntryMap[K], context: EntryContext) => ReactNode;
};

type AnyEntryHandler = EntryHandler<keyof CheatSheetEntryMap>;

const handlers: AnyEntryHandler[] = [];

export function registerHandler<K extends keyof CheatSheetEntryMap>(
  key: K,
  render: (value: CheatSheetEntryMap[K], context: EntryContext) => ReactNode
): void {
  handlers.push({ key, render } as AnyEntryHandler);
}

export function renderEntry(
  entry: CheatSheetEntry,
  context: EntryContext
): ReactNode {
  for (const handler of handlers) {
    if (handler.key in entry) {
      const value = (entry as Record<string, unknown>)[handler.key];
      return handler.render(value as never, context);
    }
  }
  return null;
}
