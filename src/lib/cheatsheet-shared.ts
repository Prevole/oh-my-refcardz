import { GRID_COLUMNS } from "./layout/grid-constants";

export type SavedCardLayout = {
  colStart: number;
  rowStart: number;
  colSpan: number;
  rowSpan: number;
};

export type SavedBlockLayout = SavedCardLayout & {
  id: string;
  kind: "heading" | "card";
};

export type SavedSectionLayout = {
  cards: SavedCardLayout[];
};

export type TitleEntry = { title: string };
type CommandEntry = { command: string };
export type AliasEntry = { alias: { content: string; copy?: string } };
type CommandExampleEntry = { commandExample: string };
type CommandExamplesEntry = { commandExamples: string[] };
export type TextEntry = { text: string };
export type AnchorEntry = { anchor: string };
export type KeysEntry = { keys: string[] };
type FileEntry = { file: string };
type WhereEntry = { where: string };
export type ContentEntry = { content: string };
export type ContentExampleEntry = { contentExample: string };
export type SettingsEntry = { settings: string[] };
export type TableEntry = {
  table: {
    headers?: string[];
    rows: Array<{ cols: string[] }>;
  };
};
export type StepEntry = { step: string };
export type LinkEntry = {
  link: {
    type: "github" | "docs" | "website";
    url: string;
    label?: string;
  };
};

export type CheatSheetEntry =
  | TitleEntry
  | CommandEntry
  | AliasEntry
  | CommandExampleEntry
  | CommandExamplesEntry
  | TextEntry
  | AnchorEntry
  | KeysEntry
  | FileEntry
  | WhereEntry
  | ContentEntry
  | ContentExampleEntry
  | SettingsEntry
  | TableEntry
  | StepEntry
  | LinkEntry;

export type CheatSheetItem = {
  entries: CheatSheetEntry[];
  detailedEntries?: CheatSheetEntry[];
};

export type CheatSheetCard = {
  id: string;
  title: string;
  items: CheatSheetItem[];
};

export type CheatSheetHeading = {
  id: string;
  title: string;
  text?: string;
};

type CheatSheetHeadingBlock = { heading: CheatSheetHeading };
type CheatSheetCardBlock = { card: CheatSheetCard };
export type CheatSheetBlock = CheatSheetHeadingBlock | CheatSheetCardBlock;

export type YamlCheatSheet = {
  title: string;
  summary: string;
  color: string;
  icon?: string;
  blocks: CheatSheetBlock[];
};

export type YamlCheatSheetWithMeta = YamlCheatSheet & {
  colorFrom: string;
  categoryId: string;
  savedBlockLayout?: SavedBlockLayout[];
};

export type CheatSheetMeta = {
  slug: string;
  title: string;
  summary: string;
  color: string;
  colorFrom: string;
  categoryId: string;
  icon?: string;
};

type RenderableHeadingBlock = CheatSheetHeading & { kind: "heading" };
type RenderableCardBlock = CheatSheetCard & { kind: "card" };
export type RenderableBlock = RenderableHeadingBlock | RenderableCardBlock;

type HeadingGroup = {
  id: string;
  title: string;
  text?: string;
  cards: CheatSheetCard[];
};

const LAYOUT_GRID_COLUMNS = GRID_COLUMNS;
const HEADING_ROW_SPAN = 2;

export function getHeadingGroups(sheet: YamlCheatSheet): HeadingGroup[] {
  const groups: HeadingGroup[] = [];
  let currentGroup: HeadingGroup | null = null;

  sheet.blocks.forEach((block) => {
    if ("heading" in block) {
      currentGroup = {
        id: block.heading.id,
        title: block.heading.title,
        text: block.heading.text,
        cards: [],
      };
      groups.push(currentGroup);
      return;
    }

    if (currentGroup) {
      currentGroup.cards.push(block.card);
    }
  });

  return groups;
}

export function getRenderableBlocks(sheet: YamlCheatSheet): RenderableBlock[] {
  return sheet.blocks.map((block) =>
    "heading" in block
      ? { kind: "heading", ...block.heading }
      : { kind: "card", ...block.card }
  );
}

export function migrateSectionLayoutsToBlockLayouts(
  sheet: YamlCheatSheet,
  layouts: SavedSectionLayout[]
): SavedBlockLayout[] {
  const migratedLayouts: SavedBlockLayout[] = [];
  const groups = getHeadingGroups(sheet);
  let currentRowOffset = 1;

  groups.forEach((group, groupIndex) => {
    migratedLayouts.push({
      id: group.id,
      kind: "heading",
      colStart: 1,
      rowStart: currentRowOffset,
      colSpan: LAYOUT_GRID_COLUMNS,
      rowSpan: HEADING_ROW_SPAN,
    });

    let sectionBottom = currentRowOffset + HEADING_ROW_SPAN - 1;

    group.cards.forEach((card, cardIndex) => {
      const sectionLayout = layouts[groupIndex];
      const cardLayout = sectionLayout?.cards[cardIndex];

      if (!cardLayout) {
        return;
      }

      migratedLayouts.push({
        id: card.id,
        kind: "card",
        colStart: cardLayout.colStart,
        rowStart: currentRowOffset + cardLayout.rowStart + HEADING_ROW_SPAN - 1,
        colSpan: cardLayout.colSpan,
        rowSpan: cardLayout.rowSpan,
      });

      sectionBottom = Math.max(
        sectionBottom,
        currentRowOffset + cardLayout.rowStart + HEADING_ROW_SPAN - 1 + cardLayout.rowSpan - 1
      );
    });

    currentRowOffset = sectionBottom + 1;
  });

  return migratedLayouts;
}
