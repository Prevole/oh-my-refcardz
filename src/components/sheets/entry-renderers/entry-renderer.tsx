import type { CheatSheetEntry } from "@/lib/yaml-cheatsheets";
import { renderEntry, type EntryContext } from "./entry-registry";

import "./command-entry";
import "./content-entry";
import "./keys-entry";
import "./path-entry";
import "./settings-entry";
import "./table-entry";
import "./text-entry";
import "./title-entry";

type EntryRendererProps = {
  entry: CheatSheetEntry;
  hasAliases?: boolean;
};

export function EntryRenderer({ entry, hasAliases = false }: EntryRendererProps) {
  const context: EntryContext = { hasAliases };
  return renderEntry(entry, context);
}
