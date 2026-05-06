import type { CheatSheetEntry } from "@/lib/yaml-cheatsheets";
import { renderEntry, type EntryContext } from "./entry-registry";

const handlersContext = require.context("./", false, /-entry\.tsx$/);
handlersContext.keys().forEach((key: string) => handlersContext(key));

type EntryRendererProps = {
  entry: CheatSheetEntry;
  hasAliases?: boolean;
};

export function EntryRenderer({ entry, hasAliases = false }: EntryRendererProps) {
  const context: EntryContext = { hasAliases };
  return renderEntry(entry, context);
}
